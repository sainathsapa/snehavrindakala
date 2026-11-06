/**
 * GET /api/tickets/[id] - Get ticket detail with replies
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

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

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

    await query(
      `CREATE TABLE IF NOT EXISTS ticket_replies (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
        ticket_id TEXT NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
        message TEXT NOT NULL,
        author TEXT,
        author_type TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT now()
      )`
    );

    const ticketRows = await query(
      "SELECT * FROM support_tickets WHERE id = $1",
      [id]
    );

    if (ticketRows.length === 0) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    const replyRows = await query(
      "SELECT * FROM ticket_replies WHERE ticket_id = $1 ORDER BY created_at ASC",
      [id]
    );

    return NextResponse.json({
      ticket: ticketRows[0],
      replies: replyRows,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
