/**
 * What people looked for, and what they did not find.
 *
 * A shop selling one-of-one works has no sales history to mine for demand. Its
 * search box is the cheapest research it will ever get: every query is somebody
 * saying, unprompted, what they hoped to buy. A query that returned nothing is
 * not a failure of the search — it is a purchase order for something the studio
 * has not made yet.
 *
 * Nothing here identifies anyone: no session, no address, no customer. The
 * question is "what words", and a table that cannot answer "who" is a table that
 * can never become a privacy problem.
 */

import { query } from "./db";

/** Trim, collapse whitespace, lower-case, and cap. A URL bar is not a text field. */
export function normaliseQuery(input: string): string {
  return String(input || "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .slice(0, 120);
}

/**
 * Record one search. Never throws: a buyer must never see an error because a
 * table was missing, and a lost row is worth less than a lost sale.
 */
export async function logSearch(
  rawQuery: string,
  locale: string,
  results: number
): Promise<void> {
  const search = normaliseQuery(rawQuery);
  if (!search) return;
  try {
    await query(
      `INSERT INTO search_log (query, locale, results) VALUES ($1, $2, $3)`,
      [search, locale === "hi" ? "hi" : "en", Math.max(0, Math.trunc(results))]
    );
  } catch (error) {
    console.error("[search-log] could not record a search", error);
  }
}

export interface SearchStat {
  query: string;
  searches: number;
  /** Zero for the queries that found nothing, which is the useful list. */
  results: number;
}

/** The most frequent searches in a window, most searched first. */
export async function topSearches(days = 30, limit = 20): Promise<SearchStat[]> {
  try {
    return await query<SearchStat>(
      `SELECT query, count(*)::int AS searches, max(results)::int AS results
         FROM search_log
        WHERE created_at > now() - ($1 || ' days')::interval
        GROUP BY query
        ORDER BY searches DESC, query ASC
        LIMIT $2`,
      [String(Math.max(1, Math.trunc(days))), Math.max(1, Math.trunc(limit))]
    );
  } catch (error) {
    console.error("[search-log] could not read searches", error);
    return [];
  }
}

/**
 * Searches that found nothing.
 *
 * Limited to queries asked at least twice by default: one mistyped word is noise,
 * two people asking for the same absent thing is a gap in the catalogue.
 */
export async function unansweredSearches(
  days = 30,
  minTimes = 1,
  limit = 20
): Promise<SearchStat[]> {
  try {
    return await query<SearchStat>(
      `SELECT query, count(*)::int AS searches, 0 AS results
         FROM search_log
        WHERE created_at > now() - ($1 || ' days')::interval
          AND results = 0
        GROUP BY query
       HAVING count(*) >= $2
        ORDER BY searches DESC, query ASC
        LIMIT $3`,
      [String(Math.max(1, Math.trunc(days))), Math.max(1, Math.trunc(minTimes)), Math.max(1, Math.trunc(limit))]
    );
  } catch (error) {
    console.error("[search-log] could not read unanswered searches", error);
    return [];
  }
}
