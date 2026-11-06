/**
 * GET /api/admin/audit-log - List audit log entries
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
  await requireAdmin();
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS audit_log (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        action TEXT NOT NULL,
        old_values JSONB,
        new_values JSONB,
        user_email TEXT,
        user_role TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT now()
      )
    `);

    const rows = await query(
      "SELECT * FROM audit_log ORDER BY created_at DESC LIMIT 200"
    );
    return NextResponse.json({ logs: rows });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
