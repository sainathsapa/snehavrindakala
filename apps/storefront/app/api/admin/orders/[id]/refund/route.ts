/**
 * POST /api/admin/orders/[id]/refund - Refund an order
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

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const { id } = await params;
    const body = await req.json();
    const { amount, reason } = body;

    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: "Valid refund amount required" },
        { status: 400 }
      );
    }

    await query(`
      CREATE TABLE IF NOT EXISTS order_refunds (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
        order_id TEXT NOT NULL,
        amount INTEGER NOT NULL,
        reason TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at TIMESTAMP NOT NULL DEFAULT now(),
        updated_at TIMESTAMP NOT NULL DEFAULT now()
      )
    `);

    const { v4: uuidv4 } = require("uuid");
    const refundId = `refund_${uuidv4().slice(0, 8)}`;

    const rows = await query(
      `INSERT INTO order_refunds (id, order_id, amount, reason, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'pending', now(), now())
       RETURNING *`,
      [refundId, id, amount, reason || ""]
    );

    return NextResponse.json({ refund: rows[0] }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const { id } = await params;

    await query(`
      CREATE TABLE IF NOT EXISTS order_refunds (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
        order_id TEXT NOT NULL,
        amount INTEGER NOT NULL,
        reason TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at TIMESTAMP NOT NULL DEFAULT now(),
        updated_at TIMESTAMP NOT NULL DEFAULT now()
      )
    `);

    const rows = await query(
      "SELECT * FROM order_refunds WHERE order_id = $1 ORDER BY created_at DESC",
      [id]
    );

    return NextResponse.json({ refunds: rows });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
