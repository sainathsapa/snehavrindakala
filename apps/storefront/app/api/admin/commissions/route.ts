/**
 * GET /api/admin/commissions - List commissions and payouts
 * POST /api/admin/commissions - Create payout
 */

import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireAdmin } from "@/app/admin/actions";



export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS commission_payouts (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
        artist_id TEXT NOT NULL,
        artist_name TEXT NOT NULL,
        amount INTEGER NOT NULL,
        currency_code TEXT NOT NULL DEFAULT 'inr',
        status TEXT NOT NULL DEFAULT 'pending',
        paid_at TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT now(),
        updated_at TIMESTAMP NOT NULL DEFAULT now()
      )
    `);

    const payouts = await query(`
      SELECT cp.*, a.display_name
      FROM commission_payouts cp
      LEFT JOIN artist a ON a.id::text = cp.artist_id
      ORDER BY cp.created_at DESC
      LIMIT 100
    `);

    const artists = await query(
      "SELECT id, display_name, commission_available FROM artist ORDER BY display_name ASC LIMIT 50"
    );

    return NextResponse.json({ payouts, artists });
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
    const { artist_id, amount, currency_code, status, notes } = body;

    if (!artist_id || !amount) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    await query(`
      CREATE TABLE IF NOT EXISTS commission_payouts (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
        artist_id TEXT NOT NULL,
        artist_name TEXT NOT NULL,
        amount INTEGER NOT NULL,
        currency_code TEXT NOT NULL DEFAULT 'inr',
        status TEXT NOT NULL DEFAULT 'pending',
        paid_at TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT now(),
        updated_at TIMESTAMP NOT NULL DEFAULT now()
      )
    `);

    const { v4: uuidv4 } = require("uuid");
    const id = `payout_${uuidv4().slice(0, 8)}`;

    const artistRow = await query(
      "SELECT display_name FROM artist WHERE id::text = $1",
      [artist_id]
    );
    const artistName = artistRow[0]?.display_name || "Unknown Artist";

    const rows = await query(
      `INSERT INTO commission_payouts (id, artist_id, artist_name, amount, currency_code, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, now(), now())
       RETURNING *`,
      [id, artist_id, artistName, amount, currency_code || "inr", status || "pending"]
    );

    return NextResponse.json({ payout: rows[0] }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
