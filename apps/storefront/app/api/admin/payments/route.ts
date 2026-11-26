import { NextResponse } from "next/server";
import { requirePermission } from "@/app/admin/actions";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/payments
 *
 * Every payment event the shop has recorded, newest first, with what it was
 * worth. The webhook writes these rows for `payment.captured`, `payment.failed`
 * and every `refund.*` state, so this is the list that answers "did we take the
 * money, did it fail, did we give it back".
 *
 * Read-only by design: money never moves from a listing. A refund goes through
 * the approval queue, which requires a second admin.
 */
export async function GET(req: Request) {
  if (!(await requirePermission("orders:read"))) {
    return NextResponse.json({ error: "Not permitted" }, { status: 403 });
  }

  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 100), 500);

  try {
    const rows = await query<any>(
      `SELECT id, provider, event_type, order_id, payment_id, amount, currency,
              status, attempts, last_error, received_at, processed_at
         FROM payment_event
        ${status ? "WHERE status = $2" : ""}
        ORDER BY received_at DESC
        LIMIT $1`,
      status ? [limit, status] : [limit]
    );

    // One grouped read rather than a query per row: this page is looked at when
    // something has gone wrong, which is the worst moment to be slow.
    const summary = await query<any>(
      `SELECT
         count(*)::int AS events,
         count(*) FILTER (WHERE event_type = 'payment.captured')::int AS captured,
         count(*) FILTER (WHERE event_type = 'payment.failed')::int AS failed,
         count(*) FILTER (WHERE event_type LIKE 'refund.%')::int AS refunds,
         count(*) FILTER (WHERE status = 'failed')::int AS needs_attention,
         coalesce(sum(amount) FILTER (WHERE event_type = 'payment.captured'), 0)::bigint AS captured_minor,
         coalesce(sum(amount) FILTER (WHERE event_type LIKE 'refund.%'), 0)::bigint AS refunded_minor
       FROM payment_event`
    );

    return NextResponse.json({
      events: rows,
      summary: summary[0] ?? null,
      provider: (process.env.RAZORPAY_KEY_ID || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "").startsWith("rzp_live")
        ? "live"
        : "test",
    });
  } catch (error) {
    console.error("[admin/payments] could not read payment events", error);
    return NextResponse.json(
      { error: "Could not read the payment log. The table may not be migrated." },
      { status: 500 }
    );
  }
}
