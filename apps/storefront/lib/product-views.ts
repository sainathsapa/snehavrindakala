/**
 * How often a work was opened.
 *
 * Counted per work per day, not per visit. The question the studio needs answered
 * is "does anyone notice this piece", which a daily counter answers; a table of
 * individual visits would answer "who", which is not needed and not wanted.
 *
 * Writes are upserts, so a busy day costs one row, and every call is allowed to
 * fail silently: a missing row must never stop a product page from rendering.
 */

import { query } from "./db";

export async function recordProductView(handle: string): Promise<void> {
  const clean = String(handle || "").trim().slice(0, 200);
  if (!clean) return;
  try {
    await query(
      `INSERT INTO product_view (handle, day, views) VALUES ($1, current_date, 1)
         ON CONFLICT (handle, day) DO UPDATE SET views = product_view.views + 1`,
      [clean]
    );
  } catch (error) {
    // A counter is worth less than the page it was attached to.
    console.error("[product-views] could not record a view", error);
  }
}

export interface ViewedWork {
  handle: string;
  views: number;
}

export async function topViewed(days = 30, limit = 15): Promise<ViewedWork[]> {
  try {
    return await query<ViewedWork>(
      `SELECT handle, sum(views)::int AS views
         FROM product_view
        WHERE day > current_date - $1::int
        GROUP BY handle
        ORDER BY views DESC, handle ASC
        LIMIT $2`,
      [Math.max(1, Math.trunc(days)), Math.max(1, Math.trunc(limit))]
    );
  } catch (error) {
    console.error("[product-views] could not read views", error);
    return [];
  }
}
