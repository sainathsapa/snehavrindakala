/**
 * Rooms and the newsroom.
 *
 * Both are small content tables the studio edits by hand, so they are read and
 * written here rather than through Medusa: a room is a wall and a wall text, and
 * a press mention is a headline and a link.
 *
 * Every reader tolerates a missing table (`safeQuery`): on a fresh database the
 * schema may not have been applied yet, and a shop that 500s because a marketing
 * page has no table is worse than a shop with an empty one.
 */

import { query } from "@/lib/db";
import type { QueryResultRow } from "pg";

export interface Room {
  id: number;
  slug: string;
  title: string;
  kicker: string;
  subtitle: string;
  body: string;
  image: string;
  collection: string;
  published: boolean;
  position: number;
  updated_at: string;
}

export interface NewsItem {
  id: number;
  slug: string;
  title: string;
  kind: "press" | "coverage" | "announcement";
  outlet: string;
  url: string;
  summary: string;
  body: string;
  image: string;
  published_at: string;
  published: boolean;
  position: number;
}

async function safeQuery<T extends QueryResultRow>(sql: string, params: any[] = []): Promise<T[]> {
  try {
    return await query<T>(sql, params);
  } catch (error) {
    console.warn("[content] query failed:", (error as Error)?.message);
    return [];
  }
}

/** Hindi columns win when a translation exists and the locale asks for it. */
function localiseRoom(row: any, locale: string): Room {
  const hi = locale === "hi";
  return {
    ...row,
    title: (hi && row.title_hi) || row.title,
    subtitle: (hi && row.subtitle_hi) || row.subtitle,
    body: (hi && row.body_hi) || row.body,
  };
}

function localiseNews(row: any, locale: string): NewsItem {
  const hi = locale === "hi";
  return {
    ...row,
    title: (hi && row.title_hi) || row.title,
    summary: (hi && row.summary_hi) || row.summary,
    body: (hi && row.body_hi) || row.body,
  };
}

export async function listRooms(locale = "en", options: { all?: boolean } = {}) {
  const rows = await safeQuery<any>(
    `SELECT * FROM site_room ${options.all ? "" : "WHERE published"} ORDER BY position, id`,
    []
  );
  return rows.map((row) => localiseRoom(row, locale));
}

export async function roomBySlug(slug: string, locale = "en"): Promise<Room | null> {
  const rows = await safeQuery<any>(
    `SELECT * FROM site_room WHERE slug = $1 AND published LIMIT 1`,
    [slug]
  );
  return rows[0] ? localiseRoom(rows[0], locale) : null;
}

export async function listNews(
  locale = "en",
  options: { all?: boolean; kind?: string } = {}
) {
  const where: string[] = [];
  const params: any[] = [];
  if (!options.all) where.push("published");
  if (options.kind) {
    params.push(options.kind);
    where.push(`kind = $${params.length}`);
  }
  const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const rows = await safeQuery<any>(
    `SELECT * FROM site_news ${clause} ORDER BY published_at DESC, position, id`,
    params
  );
  return rows.map((row) => localiseNews(row, locale));
}

export async function newsBySlug(slug: string, locale = "en"): Promise<NewsItem | null> {
  const rows = await safeQuery<any>(
    `SELECT * FROM site_news WHERE slug = $1 AND published LIMIT 1`,
    [slug]
  );
  return rows[0] ? localiseNews(rows[0], locale) : null;
}

/** Only http(s) URLs are linked: a `javascript:` href from a content field is an XSS. */
export function safeExternalUrl(value: string): string | null {
  const raw = String(value || "").trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}
