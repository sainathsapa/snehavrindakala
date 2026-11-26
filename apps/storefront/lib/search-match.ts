/**
 * Query matching and ranking for storefront search.
 *
 * Kept apart from `search.ts`, which talks to Medusa and Postgres, so the rules
 * that decide what matches and in what order can be tested without a database
 * or a `server-only` import.
 *
 * Three bugs live behind this file:
 *
 *   1. A Hindi query returned every category. The filter compared
 *      `handle.includes(slugify(query))`, and `slugify` strips everything
 *      outside a-z0-9 — so "मधुबनी" became "" and `includes("")` is true for
 *      every handle. The guard is now explicit: an empty slug means "do not
 *      compare handles", never "compare against everything".
 *   2. A multi-word query matched only as one contiguous string, so
 *      "sneha sainath sapa" found nothing while all three words were on the
 *      site. Matching is now per word, and every word must be present.
 *   3. Equal-scoring results came back in whatever order the lookups finished,
 *      mixing paintings in among policy pages. Ties now break by kind, with
 *      something you can buy first.
 */

export interface SearchResult {
  // `art-form`, `journal`, `glossary` and `page` cover the editorial side of
  // the site. Without them, searching "madhubani" found paintings but not the
  // tradition page or the essay explaining it, which is exactly what a visitor
  // looking an unfamiliar term up wants.
  type:
    | "product"
    | "category"
    | "artist"
    | "maker"
    | "art-form"
    | "journal"
    | "room"
    | "story"
    | "glossary"
    | "page";
  id: string;
  title: string;
  subtitle?: string | null;
  description?: string | null;
  image?: string | null;
  price?: number | null;
  currency?: string;
  handle?: string | null;
  url: string;
  matchScore: number;
}

/**
 * Order between kinds of result when they match equally well.
 *
 * Search is a shop, so something you can buy outranks a page about it. This is
 * a tie-break only: a page whose title matches the query still beats a product
 * that merely mentions it, because `matchScore` is compared first.
 */
export const TYPE_RANK: Record<SearchResult["type"], number> = {
  product: 0,
  // People first after the work itself; `artist` is the platform-mode
  // directory, `maker` the single-brand equivalent.
  artist: 1,
  maker: 1,
  category: 2,
  "art-form": 3,
  journal: 4,
  // A room is a place in the house and a story is something the studio wrote;
  // both are editorial, so they sit beside the journal rather than above it.
  room: 4,
  story: 4,
  glossary: 5,
  page: 6,
};

/** Split a query into words. */
export function tokens(q: string): string[] {
  return q.toLowerCase().split(/\s+/).filter(Boolean);
}

/** True only when every word appears somewhere in the haystack. */
export function matchesAll(haystack: string, needles: string[]): boolean {
  if (needles.length === 0) return false;
  const h = haystack.toLowerCase();
  return needles.every((n) => h.includes(n));
}

/** 2 when every word is in the title, 1 when only in the body, 0 for no match. */
export function scoreFor(title: string, body: string, needles: string[]): number {
  if (matchesAll(title, needles)) return 2;
  return matchesAll(`${title} ${body}`, needles) ? 1 : 0;
}
