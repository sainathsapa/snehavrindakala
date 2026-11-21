/**
 * POST /api/admin/carts/remind — send the one reminder for a cart.
 *
 * One row per cart in `cart_reminders` is the rate limit: a second call for the
 * same cart is refused rather than quietly sending again. The admin sees the
 * truth afterwards — `sent` only when a transport actually accepted it, and
 * `skipped` when email is not configured yet.
 */

import { NextResponse } from "next/server";
import { requireAdmin } from "@/app/admin/actions";
import {
  listAbandonedCarts,
  recordReminder,
  sendCartReminder,
} from "@/lib/abandoned-carts";
import { queryResult } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const cartId = typeof body.cart_id === "string" ? body.cart_id : "";
  if (!cartId) {
    return NextResponse.json({ error: "Missing cart_id" }, { status: 400 });
  }

  const existing = await queryResult<{ status: string; sent_at: string }>(
    `SELECT status, sent_at FROM cart_reminders WHERE cart_id = $1`,
    [cartId]
  );
  if (existing.rows[0]) {
    return NextResponse.json(
      {
        error:
          "This cart has already been reminded. One reminder per cart, on purpose.",
        status: existing.rows[0].status,
        sent_at: existing.rows[0].sent_at,
      },
      { status: 409 }
    );
  }

  const carts = await listAbandonedCarts({ limit: 200 });
  const cart = carts.find((candidate) => candidate.id === cartId);
  if (!cart) {
    // Either it became an order, the buyer came back, or it is still too new.
    // All three are reasons not to email, so none of them is an error state.
    const recorded = await queryResult<{ status: string }>(
      `SELECT status FROM cart_reminders WHERE cart_id = $1`,
      [cartId]
    );
    if (!recorded.rows[0]) {
      await recordReminder(cartId, "failed");
    }
    return NextResponse.json(
      {
        error:
          "This cart is no longer an abandoned checkout — it may have become an order, or the buyer has just come back.",
      },
      { status: 404 }
    );
  }

  const result = await sendCartReminder(cart);
  return NextResponse.json({
    cart_id: cartId,
    ...result,
    note:
      result.status === "sent"
        ? "Reminder sent."
        : result.status === "skipped"
          ? "Recorded, but no email left the building: no mail transport is configured yet. The cart will not be reminded again."
          : "The reminder could not be sent. It is recorded as failed so it can be retried by hand.",
  });
}
