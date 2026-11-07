/**
 * POST /api/account/returns - Customer creates a return request
 * GET  /api/account/returns - Customer lists their return requests
 *
 * Uses the same `return_requests` table as the admin panel so requests show
 * up immediately in /admin/returns.
 */

import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getAuthToken } from "@/lib/auth";
import { medusa } from "@/lib/medusa";

const DATABASE_URL =
  process.env.DATABASE_URL ||
  "postgresql://medusa:medusa@localhost:5432/medusa";

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
        { error: "Order and reason are required" },
        { status: 400 }
      );
    }

    // Verify the order belongs to the signed-in customer. The Store API
    // scopes order reads to the bearer token, so this doubles as an
    // ownership check.
    let order: any;
    try {
      order = await medusa.getOrder(order_id, token);
    } catch {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    let customer: any = null;
    try {
      const result = await medusa.getCurrentCustomer(token);
      customer = result.customer;
    } catch {
      customer = null;
    }

    const customerEmail =
      order.email || customer?.email || order.customer?.email || "";
    if (!customerEmail) {
      return NextResponse.json(
        { error: "No email is associated with this order" },
        { status: 400 }
      );
    }

    await ensureTable();

    const id = `ret_${randomUUID().slice(0, 8)}`;
    const rows = await query(
      `INSERT INTO return_requests
         (id, order_id, customer_id, customer_email, reason, status, items,
          created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, 'pending', $6, now(), now())
       RETURNING *`,
      [
        id,
        order_id,
        order.customer_id || customer?.id || null,
        customerEmail,
        reason,
        JSON.stringify(items || []),
      ]
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

    let customer: any = null;
    try {
      const result = await medusa.getCurrentCustomer(token);
      customer = result.customer;
    } catch {
      customer = null;
    }

    await ensureTable();

    const rows = customer?.id
      ? await query(
          `SELECT * FROM return_requests
           WHERE customer_id = $1 OR customer_email = $2
           ORDER BY created_at DESC LIMIT 100`,
          [customer.id, customer.email || ""]
        )
      : [];

    return NextResponse.json({ returns: rows });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to load returns" },
      { status: 500 }
    );
  }
}
