import "server-only";
import { queryResult } from "@/lib/db";
import { ensureJournalSeeded } from "@/lib/site-content";

/**
 * Journal reads, straight from Postgres.
 *
 * These pages used to `fetch()` their own API over HTTP using
 * `NEXT_PUBLIC_STOREFRONT_URL`. That is a round trip through the public
 * hostname to reach a database this process already has a pool for — and it
 * fails silently whenever the configured URL is not the host actually serving
 * the request (a preview build, a container on another port, a staging domain).
 * The symptom is an essay page that renders "still being written" while the
 * database is full.
 *
 * Server components should read the database, not call themselves over the
 * network. The API routes remain for the admin panel and for any client.
 */

export interface JournalListItem {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  cover_image: string | null;
  author: string | null;
  published_at: string | null;
  created_at: string;
}

export interface JournalPost extends JournalListItem {
  content: string | null;
}

/** Published posts, newest first. Omits `content` — the index does not need it. */
export async function listJournalPosts(limit = 50): Promise<JournalListItem[]> {
  await ensureJournalSeeded();
  const result = await queryResult<JournalListItem>(
    `SELECT id, title, slug, excerpt, cover_image, author, published_at, created_at
       FROM journal_posts
      WHERE status = 'published'
      ORDER BY published_at DESC NULLS LAST, created_at DESC
      LIMIT $1`,
    [limit]
  );
  return result.rows;
}

/** One published post, with its body. */
export async function getJournalPost(slug: string): Promise<JournalPost | null> {
  await ensureJournalSeeded();
  const result = await queryResult<JournalPost>(
    `SELECT id, title, slug, content, excerpt, cover_image, author,
            published_at, created_at
       FROM journal_posts
      WHERE slug = $1 AND status = 'published'
      LIMIT 1`,
    [slug]
  );
  return result.rows[0] ?? null;
}
