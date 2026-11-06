/**
 * PATCH /api/tickets/[id] - Update ticket status
 */

import { NextResponse } from "next/server";

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

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { status } = body;

    if (!status) {
      return NextResponse.json({ error: "Missing status" }, { status: 400 });
    }

    await query(
      `CREATE TABLE IF NOT EXISTS support_tickets (
        id TEXT PRIMARY KEY,
        subject TEXT NOT NULL,
        message TEXT NOT NULL,
        email TEXT NOT NULL,
        name TEXT,
        status TEXT NOT NULL DEFAULT 'open',
        priority TEXT NOT NULL DEFAULT 'medium',
        assigned_to TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT now(),
        updated_at TIMESTAMP NOT NULL DEFAULT now()
      )`
    );

    const rows = await query(
      `UPDATE support_tickets SET status = $1, updated_at = now() WHERE id = $2 RETURNING *`,
      [status, id]
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    return NextResponse.json({ ticket: rows[0] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
