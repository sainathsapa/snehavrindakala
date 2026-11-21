/**
 * Support Tickets API - stored in PostgreSQL via Medusa database.
 * Uses the existing database connection.
 */

import { NextResponse } from "next/server";
import { query } from "@/lib/db";

/**
 * A ticket can carry the work it is about.
 *
 * Added lazily because `support_tickets` already exists in deployed databases
 * and this route is the only writer: a column added in schema.sql alone would
 * reach new installs and quietly miss every running one.
 */
let columnsReady: Promise<void> | null = null;
function ensureColumns(): Promise<void> {
  if (!columnsReady) {
    columnsReady = query(
      `ALTER TABLE support_tickets
         ADD COLUMN IF NOT EXISTS product_handle TEXT NOT NULL DEFAULT ''`
    )
      .then(() => undefined)
      .catch((err) => {
        columnsReady = null;
        throw err;
      });
  }
  return columnsReady;
}



export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    let sql = `
      SELECT id, subject, message, email, name, status, priority, assigned_to,
             COALESCE(product_handle, '') AS product_handle, created_at, updated_at
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
    const {
      subject,
      message,
      email,
      name,
      priority = "medium",
      product_handle,
    } = body;

    if (!subject || !message || !email) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // A question with no way to answer it is not a question.
    if (!String(email).includes("@")) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }

    await ensureColumns();

    const { v4: uuidv4 } = require("uuid");
    const id = `ticket_${uuidv4().slice(0, 8)}`;

    const rows = await query(
      `INSERT INTO support_tickets
         (id, subject, message, email, name, status, priority, product_handle, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, 'open', $6, $7, now(), now())
       RETURNING *`,
      [
        id,
        subject,
        message,
        email,
        name || "",
        priority,
        typeof product_handle === "string" ? product_handle.slice(0, 200) : "",
      ]
    );

    return NextResponse.json({ ticket: rows[0] }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
