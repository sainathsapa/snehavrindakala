/**
 * GET /api/admin/journal - List blog posts
 * POST /api/admin/journal - Create a blog post
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

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
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
      "SELECT * FROM journal_posts ORDER BY created_at DESC LIMIT 100"
    );
    return NextResponse.json({ posts: rows });
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
    const { title, slug, content, excerpt, cover_image, author, status } = body;

    if (!title || !slug) {
      return NextResponse.json(
        { error: "Title and slug required" },
        { status: 400 }
      );
    }

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

    const { v4: uuidv4 } = require("uuid");
    const id = `journal_${uuidv4().slice(0, 8)}`;

    const rows = await query(
      `INSERT INTO journal_posts (id, title, slug, content, excerpt, cover_image, author, status, published_at, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now(), now())
       RETURNING *`,
      [
        id,
        title,
        slug,
        content || "",
        excerpt || "",
        cover_image || "",
        author || "",
        status || "draft",
        status === "published" ? new Date().toISOString() : null,
      ]
    );

    return NextResponse.json({ post: rows[0] }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
