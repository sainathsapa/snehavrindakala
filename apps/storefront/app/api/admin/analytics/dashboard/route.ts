/**
 * GET /api/admin/analytics/dashboard - Dashboard analytics data
 * Returns revenue, orders, top products, monthly trends
 *
 * Medusa v2 stores order totals on the line items / order summary rather
 * than a `total` column on the `order` table, and customer email on
 * `order.email`. The queries below use the v2 schema.
 */

import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireAdmin } from "@/app/admin/actions";



export async function GET(req: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const { searchParams } = new URL(req.url);
    const requested = parseInt(searchParams.get("period") || "30", 10);
    // Keep the interval numeric before interpolating it into SQL.
    const period = Math.max(1, Math.min(3650, Number.isFinite(requested) ? requested : 30));

    // Total revenue / orders / customers. Totals come from current-version
    // line items; cancelled orders are excluded.
    const revenueRows = await query(`
      SELECT COALESCE(SUM(li.unit_price * oi.quantity), 0) as total_revenue,
             COUNT(DISTINCT o.id) as total_orders,
             COUNT(DISTINCT o.customer_id) as unique_customers
      FROM "order" o
      JOIN order_item oi ON oi.order_id = o.id AND oi.version = o.version
      JOIN order_line_item li ON li.id = oi.item_id
      WHERE o.canceled_at IS NULL
        AND o.created_at >= NOW() - INTERVAL '${period} days'
    `);

    // Monthly revenue trend
    const monthlyRows = await query(`
      SELECT DATE_TRUNC('month', o.created_at) as month,
             COALESCE(SUM(li.unit_price * oi.quantity), 0) as revenue,
             COUNT(DISTINCT o.id) as orders
      FROM "order" o
      JOIN order_item oi ON oi.order_id = o.id AND oi.version = o.version
      JOIN order_line_item li ON li.id = oi.item_id
      WHERE o.canceled_at IS NULL
        AND o.created_at >= NOW() - INTERVAL '12 months'
      GROUP BY DATE_TRUNC('month', o.created_at)
      ORDER BY month ASC
    `);

    // Top products
    const topProductsRows = await query(`
      SELECT li.product_title as title,
             li.product_handle as handle,
             COALESCE(SUM(oi.quantity), 0) as units_sold,
             COALESCE(SUM(li.unit_price * oi.quantity), 0) as revenue
      FROM order_line_item li
      JOIN order_item oi ON oi.item_id = li.id
      JOIN "order" o ON o.id = oi.order_id AND oi.version = o.version
      WHERE o.canceled_at IS NULL
      GROUP BY li.product_id, li.product_title, li.product_handle
      ORDER BY units_sold DESC
      LIMIT 10
    `);

    // Order status distribution
    const statusRows = await query(`
      SELECT status, COUNT(*) as count
      FROM "order"
      GROUP BY status
      ORDER BY count DESC
    `);

    // Recent orders, with a computed total per order
    const recentRows = await query(`
      SELECT o.id,
             o.email as customer_email,
             o.status,
             o.created_at,
             COALESCE((
               SELECT SUM(li.unit_price * oi.quantity)
               FROM order_item oi
               JOIN order_line_item li ON li.id = oi.item_id
               WHERE oi.order_id = o.id AND oi.version = o.version
             ), 0) as total
      FROM "order" o
      ORDER BY o.created_at DESC
      LIMIT 10
    `);

    return NextResponse.json({
      summary: revenueRows[0] || { total_revenue: 0, total_orders: 0, unique_customers: 0 },
      monthly_trend: monthlyRows,
      top_products: topProductsRows,
      status_distribution: statusRows,
      recent_orders: recentRows,
      period_days: period,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
