/**
 * GET /api/admin/discounts - List discount codes
 * POST /api/admin/discounts - Create discount code
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

export async function GET() {
  await requireAdmin();
  try {
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
      "SELECT * FROM discount_codes ORDER BY created_at DESC LIMIT 100"
    );
    return NextResponse.json({ discounts: rows });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  await requireAdmin();
  try {
    const body = await req.json();
    const {
      code,
      type,
      value,
      min_order_amount,
      usage_limit,
      starts_at,
      ends_at,
    } = body;

    if (!code || !type || !value) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
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

    const { v4: uuidv4 } = require("uuid");
    const id = `disc_${uuidv4().slice(0, 8)}`;

    const rows = await query(
      `INSERT INTO discount_codes (id, code, type, value, min_order_amount, usage_limit, starts_at, ends_at, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, now(), now())
       RETURNING *`,
      [
        id,
        code,
        type,
        value,
        min_order_amount || "0",
        usage_limit || 0,
        starts_at || null,
        ends_at || null,
      ]
    );

    return NextResponse.json({ discount: rows[0] }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
