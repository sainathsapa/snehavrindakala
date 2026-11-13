/**
 * GET /api/store/journal - List published journal posts
 */

import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { ensureJournalSeeded } from "@/lib/site-content";

export async function GET() {
  try {
    // Creates the table and seeds the sample essays on a fresh database, so the
    // journal is never an empty page on first run.
    await ensureJournalSeeded();

    const rows = await query(
      "SELECT id, title, slug, excerpt, cover_image, author, status, published_at, created_at FROM journal_posts WHERE status = 'published' ORDER BY published_at DESC NULLS LAST, created_at DESC LIMIT 50"
    );

    return NextResponse.json({ posts: rows });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
