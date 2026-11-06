/**
 * Support Tickets API - stored in PostgreSQL via Medusa database.
 * Uses the existing database connection.
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

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    let sql = `
      SELECT id, subject, message, email, name, status, priority, assigned_to, created_at, updated_at
      FROM support_tickets
    `;
    const params: any[] = [];
    if (status) {
      sql += ` WHERE status = $${params.length + 1}`;
      params.push(status);
    }
    sql += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const rows = await query(sql, params);
    return NextResponse.json({ tickets: rows, count: rows.length });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { subject, message, email, name, priority = "medium" } = body;

    if (!subject || !message || !email) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const { v4: uuidv4 } = require("uuid");
    const id = `ticket_${uuidv4().slice(0, 8)}`;

    const rows = await query(
      `INSERT INTO support_tickets (id, subject, message, email, name, status, priority, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, 'open', $6, now(), now())
       RETURNING *`,
      [id, subject, message, email, name || "", priority]
    );

    return NextResponse.json({ ticket: rows[0] }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
