/**
 * GET /api/admin/reviews — moderation queue for product reviews.
 *
 * Reads from the shared Postgres `product_review` table (the backend module
 * writes rows here too), newest first. Staff approve or reject through the
 * [id] route. Only approved rows are ever served to the public store.
 */

import { NextResponse } from "next/server";
import { requireAdmin } from "@/app/admin/actions";
import { query } from "@/lib/db";

export async function GET(req: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") || "";
  const productId = searchParams.get("product_id") || "";
  const limit = Math.min(Number(searchParams.get("limit") || 100), 500);
  const offset = Math.max(Number(searchParams.get("offset") || 0), 0);

  try {
    await query(`
      CREATE TABLE IF NOT EXISTS product_review (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        product_id text NOT NULL,
        variant_id text,
        customer_id text,
        author_name text,
        rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
        title text,
        body text NOT NULL,
        verified boolean NOT NULL DEFAULT false,
        verification_order_id text,
        photos jsonb,
        status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
        admin_note text,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    const where: string[] = [];
    const params: any[] = [];
    if (status) {
      params.push(status);
      where.push(`status = $${params.length}`);
    }
    if (productId) {
      params.push(productId);
      where.push(`product_id = $${params.length}`);
    }
    const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";

    const rows = await query(
      `SELECT id, product_id, variant_id, customer_id, author_name, rating,
              title, body, verified, verification_order_id, photos, status,
              admin_note, created_at, updated_at
       FROM product_review ${whereSql}
       ORDER BY created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );

    const countRows = await query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM product_review ${whereSql}`,
      params
    );

    return NextResponse.json({
      reviews: rows,
      count: Number(countRows[0]?.count ?? 0),
    });
  } catch (err: any) {
    console.error("Failed to list reviews", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}