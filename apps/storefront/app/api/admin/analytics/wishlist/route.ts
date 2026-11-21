/**
 * GET /api/admin/analytics/wishlist — what people save and do not buy.
 *
 * The wishlist has been collected since it was first written and never read.
 * On a shop where every work is unique, "saved but never sold" is the most
 * useful signal there is: it separates a work that is priced or photographed
 * wrong from one nobody has seen, and it says so without a survey.
 *
 * `sold` is derived from order line items, so a work that has since been
 * purchased drops out of the "waiting" list on its own. Nothing here is a
 * prediction; it is a count of what visitors did.
 */

import { NextResponse } from "next/server";
import { requireAdmin } from "@/app/admin/actions";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const rows = await query<{
      handle: string;
      title: string | null;
      price: string | null;
      saves: string;
      sold: boolean;
      last_saved: string | null;
    }>(
      `
      WITH saved AS (
        SELECT handle,
               MAX(title)           AS title,
               MAX(price)           AS price,
               COUNT(*)             AS saves,
               MAX(created_at)      AS last_saved
          FROM customer_wishlist
         GROUP BY handle
      ),
      sold AS (
        SELECT DISTINCT product_handle AS handle
          FROM order_line_item
         WHERE deleted_at IS NULL
           AND product_handle IS NOT NULL
           AND product_handle <> ''
      )
      SELECT s.handle,
             s.title,
             s.price,
             s.saves,
             s.last_saved,
             (sold.handle IS NOT NULL) AS sold
        FROM saved s
        LEFT JOIN sold ON sold.handle = s.handle
       ORDER BY s.saves DESC, s.last_saved DESC
      `
    );

    // Kept in the response rather than computed in the page so the rule lives in
    // one place: a saved work that has sold is not "waiting for anything".
    const waiting = rows.filter((row) => !row.sold);
    const purchased = rows.filter((row) => row.sold);

    return NextResponse.json({
      waiting: waiting.map(shape),
      purchased: purchased.map(shape),
      total_saves: rows.reduce((sum, row) => sum + Number(row.saves), 0),
    });
  } catch (error) {
    console.error("wishlist insights failed", error);
    return NextResponse.json(
      { error: "Could not read the saved-works list" },
      { status: 500 }
    );
  }
}

function shape(row: {
  handle: string;
  title: string | null;
  price: string | null;
  saves: string;
  last_saved: string | null;
}) {
  return {
    handle: row.handle,
    title: row.title || row.handle,
    price: row.price === null ? null : Number(row.price),
    saves: Number(row.saves),
    last_saved: row.last_saved,
  };
}
