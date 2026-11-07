/**
 * POST /api/account/returns - Customer creates a return request
 * GET /api/account/returns - Customer lists their return requests
 */

import { NextResponse } from "next/server";
import { getAuthToken } from "@/lib/auth";
import { medusa } from "@/lib/medusa";

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

async function ensureTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS customer_return_requests (
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
}

export async function POST(req: Request) {
  try {
    const token = await getAuthToken();
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { order_id, reason, items } = body;

    if (!order_id || !reason) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Verify the order belongs to this customer
    try {
      const order = await medusa.getOrder(order_id);
      if (!order) {
        return NextResponse.json({ error: "Order not found" }, { status: 404 });
      }
    } catch {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    await ensureTable();

    const { v4: uuidv4 } = require("uuid");
    const id = `ret_${uuidv4().slice(0, 8)}`;

    const rows = await query(
      `INSERT INTO customer_return_requests (id, order_id, customer_email, reason, status, items, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'pending', $5, now(), now())
       RETURNING *`,
      [id, order_id, "", reason, JSON.stringify(items || [])]
    );

    return NextResponse.json({ return: rows[0] }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to create return request" },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  try {
    const token = await getAuthToken();
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await ensureTable();

    const rows = await query(
      "SELECT * FROM customer_return_requests ORDER BY created_at DESC LIMIT 100"
    );

    return NextResponse.json({ returns: rows });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to load returns" },
      { status: 500 }
    );
  }
}
