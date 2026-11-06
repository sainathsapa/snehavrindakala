/**
 * GET /api/admin/analytics/dashboard - Dashboard analytics data
 * Returns revenue, orders, top products, monthly trends
 */

import { NextResponse } from "next/server";
import { requireAdmin } from "@/app/admin/actions";

const DATABASE_URL =
  process.env.DATABASE_URL || "postgresql://medusa:medusa@localhost:5432/medusa";

async function query(sql: string, params: any[] = []) {
  const { Pool } = require("pg");
  const pool = new Pool({ connectionString: DATABASE_URL });
  const client = await pool.connect();
  try {
    const res = await client.query(sql, params);
    return res.rows;
  } finally {
    client.release();
    pool.end();
  }
}

export async function GET(req: Request) {
  await requireAdmin();
  try {
    const { searchParams } = new URL(req.url);
    const period = searchParams.get("period") || "30"; // days

    // Total revenue
    const revenueRows = await query(`
      SELECT COALESCE(SUM(total), 0) as total_revenue,
             COUNT(*) as total_orders,
             COUNT(DISTINCT customer_email) as unique_customers
      FROM "order"
      WHERE payment_status = 'paid'
        AND created_at >= NOW() - INTERVAL '${period} days'
    `);

    // Monthly revenue trend
    const monthlyRows = await query(`
      SELECT DATE_TRUNC('month', created_at) as month,
             COALESCE(SUM(total), 0) as revenue,
             COUNT(*) as orders
      FROM "order"
      WHERE payment_status = 'paid'
        AND created_at >= NOW() - INTERVAL '12 months'
      GROUP BY DATE_TRUNC('month', created_at)
      ORDER BY month ASC
    `);

    // Top products
    const topProductsRows = await query(`
      SELECT p.title, p.handle, COALESCE(SUM(oi.quantity), 0) as units_sold,
             COALESCE(SUM(oi.unit_price * oi.quantity), 0) as revenue
      FROM product p
      LEFT JOIN order_item oi ON oi.product_id = p.id
      LEFT JOIN "order" o ON o.id = oi.order_id AND o.payment_status = 'paid'
      GROUP BY p.id, p.title, p.handle
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

    // Recent orders
    const recentRows = await query(`
      SELECT id, customer_email, total, status, payment_status, created_at
      FROM "order"
      ORDER BY created_at DESC
      LIMIT 10
    `);

    return NextResponse.json({
      summary: revenueRows[0] || { total_revenue: 0, total_orders: 0, unique_customers: 0 },
      monthly_trend: monthlyRows,
      top_products: topProductsRows,
      status_distribution: statusRows,
      recent_orders: recentRows,
      period_days: parseInt(period),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
