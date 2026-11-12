/**
 * PATCH /api/admin/commissions/[id] - Update payout status (pending/paid)
 * DELETE /api/admin/commissions/[id] - Delete a payout record
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
    const { status } = body;

    if (!status) {
      return NextResponse.json({ error: "Missing status field" }, { status: 400 });
    }

    await query(`
      CREATE TABLE IF NOT EXISTS commission_payouts (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
        artist_id TEXT NOT NULL,
        artist_name TEXT NOT NULL,
        amount INTEGER NOT NULL,
        currency_code TEXT NOT NULL DEFAULT 'inr',
        status TEXT NOT NULL DEFAULT 'pending',
        paid_at TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT now(),
        updated_at TIMESTAMP NOT NULL DEFAULT now()
      )
    `);

    const rows = await query(
      `UPDATE commission_payouts SET status = $1, updated_at = now(),
        paid_at = CASE WHEN $1 = 'paid' THEN now() ELSE paid_at END
        WHERE id = $2 RETURNING *`,
      [status, id]
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: "Payout not found" }, { status: 404 });
    }

    return NextResponse.json({ payout: rows[0] });
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
      CREATE TABLE IF NOT EXISTS commission_payouts (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
        artist_id TEXT NOT NULL,
        artist_name TEXT NOT NULL,
        amount INTEGER NOT NULL,
        currency_code TEXT NOT NULL DEFAULT 'inr',
        status TEXT NOT NULL DEFAULT 'pending',
        paid_at TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT now(),
        updated_at TIMESTAMP NOT NULL DEFAULT now()
      )
    `);

    const rows = await query(
      `DELETE FROM commission_payouts WHERE id = $1 RETURNING *`,
      [id]
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: "Payout not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
