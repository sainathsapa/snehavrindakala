/**
 * PATCH /api/admin/tickets/[id] - Update ticket status / assign
 * POST /api/admin/tickets/[id]/reply - Add a reply to a ticket
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

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
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
    const { status, assigned_to } = body;

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

    const updates: string[] = [];
    const paramsArr: any[] = [];
    if (status !== undefined) {
      paramsArr.push(status);
      updates.push(`status = $${paramsArr.length}`);
    }
    if (assigned_to !== undefined) {
      paramsArr.push(assigned_to);
      updates.push(`assigned_to = $${paramsArr.length}`);
    }
    paramsArr.push(id);
    updates.push(`updated_at = now()`);

    const sql = `UPDATE support_tickets SET ${updates.join(", ")} WHERE id = $${paramsArr.length} RETURNING *`;
    const rows = await query(sql, paramsArr);

    if (rows.length === 0) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    return NextResponse.json({ ticket: rows[0] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
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
    const { message, author, author_type } = body;

    if (!message) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

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

    const { v4: uuidv4 } = require("uuid");
    const replyId = `reply_${uuidv4().slice(0, 8)}`;

    await query(
      `INSERT INTO ticket_replies (id, ticket_id, message, author, author_type, created_at)
       VALUES ($1, $2, $3, $4, $5, now()) RETURNING *`,
      [replyId, id, message, author || "Admin", author_type || "staff"]
    );

    // Update ticket status to in_progress if it was open
    await query(
      `UPDATE support_tickets SET status = 'in_progress', updated_at = now() WHERE id = $1 AND status = 'open'`,
      [id]
    );

    return NextResponse.json({ ok: true, replyId }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
