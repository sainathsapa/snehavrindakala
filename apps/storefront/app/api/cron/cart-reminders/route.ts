/**
 * GET|POST /api/cron/cart-reminders
 *
 * Works the unfinished-checkout queue without anyone opening the admin page.
 * Nothing here is new: it calls the same `listAbandonedCarts` and
 * `sendCartReminder` the page uses, so the rules (quiet for N hours, once per
 * cart, `skipped` when mail is not configured) are identical wherever the work
 * is triggered from.
 *
 * Guarded by CRON_SECRET. When it is unset the endpoint refuses with 503 and says
 * why, rather than running for anyone who finds the URL.
 *
 * Idempotent by construction: `cart_reminders` has one row per cart, so running
 * this every hour sends each reminder once and costs a query afterwards.
 */

import { NextResponse } from "next/server";
import {
  listAbandonedCarts,
  sendCartReminder,
} from "@/lib/abandoned-carts";
import { authoriseCron } from "@/lib/cron-auth";

export const dynamic = "force-dynamic";

/** A cap per run keeps one unlucky hour from mailing hundreds of people. */
const MAX_PER_RUN = 25;

async function handle(req: Request) {
  const url = new URL(req.url);
  const auth = authoriseCron({
    secret: process.env.CRON_SECRET,
    authorization: req.headers.get("authorization"),
    querySecret: url.searchParams.get("secret"),
  });

  if (!auth.ok) {
    const status = process.env.CRON_SECRET ? 401 : 503;
    return NextResponse.json({ error: auth.reason }, { status });
  }

  try {
    const carts = await listAbandonedCarts({ limit: MAX_PER_RUN * 4 });
    // Carts that were already reminded are skipped here rather than re-sent:
    // the queue is derived from Medusa's carts and would otherwise repeat daily.
    const pending = carts.filter((cart) => !cart.reminded_at).slice(0, MAX_PER_RUN);

    const results: Array<{ cart_id: string; status: string }> = [];
    for (const cart of pending) {
      const result = await sendCartReminder(cart);
      results.push({ cart_id: cart.id, status: result.status });
    }

    const counted = (status: string) =>
      results.filter((result) => result.status === status).length;

    return NextResponse.json({
      considered: carts.length,
      attempted: results.length,
      sent: counted("sent"),
      skipped: counted("skipped"),
      failed: counted("failed"),
      // Said plainly, because a run full of `skipped` is a configuration problem
      // rather than a quiet success.
      note:
        counted("skipped") > 0
          ? "Some reminders were recorded but not sent: no mail transport is configured."
          : undefined,
      results,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "The reminder run failed";
    console.error("[cron] cart reminders failed", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(req: Request) {
  return handle(req);
}

export async function POST(req: Request) {
  return handle(req);
}
