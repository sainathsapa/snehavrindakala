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
    const [
      totalOrders,
      totalProducts,
      totalCustomers,
      totalArtists,
      totalRooms,
      totalNews,
    ] = await Promise.all([
      count(`SELECT COUNT(*)::int AS count FROM "order" WHERE deleted_at IS NULL`),
      count(`SELECT COUNT(*)::int AS count FROM product WHERE deleted_at IS NULL`),
      count(`SELECT COUNT(*)::int AS count FROM customer WHERE deleted_at IS NULL`),
      count(`SELECT COUNT(*)::int AS count FROM artist WHERE deleted_at IS NULL`),
      // Editorial counts. A room or a press mention that is drafted but not
      // published is the state that gets forgotten, so both are counted here
      // where the owner looks first.
      count(`SELECT COUNT(*)::int AS count FROM site_room`).catch(() => 0),
      count(`SELECT COUNT(*)::int AS count FROM site_news`).catch(() => 0),
    ]);

    return NextResponse.json({
      total_orders: totalOrders,
      total_products: totalProducts,
      total_customers: totalCustomers,
      total_artists: totalArtists,
      total_rooms: totalRooms,
      total_news: totalNews,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
