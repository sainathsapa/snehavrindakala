/**
 * GET /api/store/journal - List published journal posts
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

export async function GET() {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS journal_posts (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
        title TEXT NOT NULL,
        slug TEXT UNIQUE NOT NULL,
        content TEXT,
        excerpt TEXT,
        cover_image TEXT,
        author TEXT,
        status TEXT NOT NULL DEFAULT 'draft',
        published_at TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT now(),
        updated_at TIMESTAMP NOT NULL DEFAULT now()
      )
    `);

    const rows = await query(
      "SELECT id, title, slug, excerpt, cover_image, author, status, published_at, created_at FROM journal_posts WHERE status = 'published' ORDER BY published_at DESC NULLS LAST, created_at DESC LIMIT 50"
    );

    return NextResponse.json({ posts: rows });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
