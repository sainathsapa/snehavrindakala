/**
 * GET /api/store/journal/[slug] - One published journal post, with its body.
 *
 * The listing endpoint deliberately omits `content`: sending six full essays on
 * the index page would be wasteful, and — as happened — a detail page that
 * reuses the listing response renders an empty article. The body is fetched
 * here, for one slug only.
 */

import { NextResponse } from "next/server";
import { queryResult } from "@/lib/db";
import { ensureJournalSeeded } from "@/lib/site-content";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  if (!slug) {
    return NextResponse.json({ error: "Missing slug" }, { status: 400 });
  }

  try {
    await ensureJournalSeeded();

    const result = await queryResult<Record<string, unknown>>(
      `SELECT id, title, slug, content, excerpt, cover_image, author, status,
              published_at, created_at, updated_at
         FROM journal_posts
        WHERE slug = $1 AND status = 'published'
        LIMIT 1`,
      [slug]
    );

    const post = result.rows[0];
    if (!post) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ post });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
