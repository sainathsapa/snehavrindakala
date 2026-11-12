/**
 * GET /api/admin/stats - Aggregate counts for the admin dashboard.
 */

import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireAdmin } from "@/app/admin/actions";



async function count(sql: string): Promise<number> {
  try {
    const rows = await query(sql);
    return Number(rows[0]?.count ?? 0);
  } catch {
    return 0;
  }
}

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const [totalOrders, totalProducts, totalCustomers, totalArtists] =
      await Promise.all([
        count(`SELECT COUNT(*)::int AS count FROM "order" WHERE deleted_at IS NULL`),
        count(`SELECT COUNT(*)::int AS count FROM product WHERE deleted_at IS NULL`),
        count(`SELECT COUNT(*)::int AS count FROM customer WHERE deleted_at IS NULL`),
        count(`SELECT COUNT(*)::int AS count FROM artist WHERE deleted_at IS NULL`),
      ]);

    return NextResponse.json({
      total_orders: totalOrders,
      total_products: totalProducts,
      total_customers: totalCustomers,
      total_artists: totalArtists,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
