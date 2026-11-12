/**
 * PATCH /api/admin/discounts/[id] - Toggle discount active status
 * DELETE /api/admin/discounts/[id] - Delete a discount code
 */

import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireAdmin } from "@/app/admin/actions";



export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const { id } = await params;
    const body = await req.json();
    const { is_active } = body;

    if (is_active === undefined) {
      return NextResponse.json({ error: "Missing is_active field" }, { status: 400 });
    }

    await query(`
      CREATE TABLE IF NOT EXISTS discount_codes (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
        code TEXT UNIQUE NOT NULL,
        type TEXT NOT NULL DEFAULT 'percentage',
        value TEXT NOT NULL,
        min_order_amount TEXT DEFAULT '0',
        usage_limit INTEGER DEFAULT 0,
        used_count INTEGER DEFAULT 0,
        starts_at TIMESTAMP,
        ends_at TIMESTAMP,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP NOT NULL DEFAULT now(),
        updated_at TIMESTAMP NOT NULL DEFAULT now()
      )
    `);

    const rows = await query(
      `UPDATE discount_codes SET is_active = $1, updated_at = now() WHERE id = $2 RETURNING *`,
      [is_active, id]
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: "Discount not found" }, { status: 404 });
    }

    return NextResponse.json({ discount: rows[0] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const { id } = await params;

    await query(`
      CREATE TABLE IF NOT EXISTS discount_codes (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
        code TEXT UNIQUE NOT NULL,
        type TEXT NOT NULL DEFAULT 'percentage',
        value TEXT NOT NULL,
        min_order_amount TEXT DEFAULT '0',
        usage_limit INTEGER DEFAULT 0,
        used_count INTEGER DEFAULT 0,
        starts_at TIMESTAMP,
        ends_at TIMESTAMP,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP NOT NULL DEFAULT now(),
        updated_at TIMESTAMP NOT NULL DEFAULT now()
      )
    `);

    const rows = await query(
      `DELETE FROM discount_codes WHERE id = $1 RETURNING *`,
      [id]
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: "Discount not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
