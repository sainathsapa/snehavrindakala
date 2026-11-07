/**
 * GET /api/admin/returns - List return requests
 * POST /api/admin/returns - Create a return request
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
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS return_requests (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
        order_id TEXT NOT NULL,
        customer_id TEXT,
        customer_email TEXT NOT NULL,
        reason TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        items TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT now(),
        updated_at TIMESTAMP NOT NULL DEFAULT now()
      )
    `);

    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100);
    const offset = parseInt(searchParams.get("offset") || "0") || 0;
    const status = searchParams.get("status") || "";
    const orderId = searchParams.get("order_id") || "";
    const q = (searchParams.get("q") || "").trim();

    const conditions: string[] = [];
    const params: any[] = [];

    if (status) {
      params.push(status);
      conditions.push(`status = $${params.length}`);
    }
    if (orderId) {
      params.push(orderId);
      conditions.push(`order_id = $${params.length}`);
    }
    if (q) {
      params.push(`%${q}%`);
      const ref = `$${params.length}`;
      conditions.push(
        `(id ILIKE ${ref} OR order_id ILIKE ${ref} OR customer_email ILIKE ${ref} OR reason ILIKE ${ref})`
      );
    }

    const where = conditions.length
      ? `WHERE ${conditions.join(" AND ")}`
      : "";

    const countRows = await query(
      `SELECT COUNT(*)::int AS count FROM return_requests ${where}`,
      params
    );

    const rows = await query(
      `SELECT * FROM return_requests ${where}
       ORDER BY created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );

    return NextResponse.json({
      returns: rows,
      count: countRows[0]?.count ?? rows.length,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = await req.json();
    const { order_id, customer_id, customer_email, reason, items } = body;

    if (!order_id || !customer_email || !reason) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    await query(`
      CREATE TABLE IF NOT EXISTS return_requests (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
        order_id TEXT NOT NULL,
        customer_id TEXT,
        customer_email TEXT NOT NULL,
        reason TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        items TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT now(),
        updated_at TIMESTAMP NOT NULL DEFAULT now()
      )
    `);

    const { v4: uuidv4 } = require("uuid");
    const id = `ret_${uuidv4().slice(0, 8)}`;

    const rows = await query(
      `INSERT INTO return_requests (id, order_id, customer_id, customer_email, reason, status, items, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, 'pending', $6, now(), now())
       RETURNING *`,
      [id, order_id, customer_id, customer_email, reason, items || "[]"]
    );

    return NextResponse.json({ return: rows[0] }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
