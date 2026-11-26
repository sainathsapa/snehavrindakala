/**
 * Universal storefront search across products, categories, and artists.
 *
 * Shared by the `/api/store/search` route and the `/search` page so the page
 * never has to call its own API over the network.
 */

import { getProductPrice, medusa } from "./medusa";
import { slugify } from "./slugs";
import { GLOSSARY } from "./art-reference";
import { listArtForms, productTranslationsFor } from "./site-content";
import { listJournalPosts } from "./journal";
import { listCatalogue } from "./catalogue";
import { getPlatformModeFromEnv } from "./settings";
import {
  type SearchResult,
  TYPE_RANK,
  tokens,
  matchesAll,
  scoreFor,
} from "./search-match";
import { queryGroups, matchesGroups } from "./search-words";

// Re-exported so importers that reached for the type here keep working.
export type { SearchResult } from "./search-match";

/**
 * Pages searchable by title, with the words a visitor is likely to type.
 *
 * A fixed list rather than a crawl: search should find the handful of pages
 * that answer a question (where is my order, what is the returns window), not
 * index the whole site including the admin area.
 */
const STATIC_PAGES: { title: string; url: string; keywords: string[]; description: string }[] = [
  {
    title: "FAQ & support",
    url: "/faq",
    keywords: ["faq", "help", "question", "support", "contact", "duty", "customs", "payment"],
    description: "Answers on shipping, customs, returns, commissions and payment.",
  },
  {
    title: "Authenticity",
    url: "/authenticity",
    keywords: ["authentic", "certificate", "original", "genuine", "provenance"],
    description: "How each work is certified and what we refuse to do.",
  },
  {
    title: "Disclaimer",
    url: "/disclaimer",
    keywords: ["disclaimer", "liability", "variation", "claims", "terms"],
    description: "What we claim about the work, and what we do not.",
  },
  {
    title: "Shipping policy",
    url: "/policies/shipping",
    keywords: ["shipping", "delivery", "dispatch", "courier", "tracking"],
    description: "Dispatch timelines and delivery terms.",
  },
  {
    title: "Returns policy",
    url: "/policies/returns",
    keywords: ["return", "refund", "exchange", "damaged", "cancel"],
    description: "What is returnable and how to start a return.",
  },
  {
    title: "Privacy policy",
    url: "/policies/privacy",
    keywords: ["privacy", "data", "cookie", "gdpr", "personal information"],
    description: "What we collect and why.",
  },
  {
    title: "Terms of sale",
    url: "/policies/terms",
    keywords: ["terms", "conditions", "legal", "contract"],
    description: "The terms that govern an order.",
  },
  {
    title: "Our story",
    url: "/about",
    // The maker's own name belongs here. Searching "sainath" or "sapa" found
    // nothing at all, which is a poor answer for the one person the house is
    // named after.
    keywords: [
      "about", "story", "artist", "sneha", "sainath", "sapa",
      "sneha sainath sapa", "bikaner", "studio", "founder",
    ],
    description: "The house, the artist and where the work is made.",
  },
  {
    title: "The makers",
    url: "/makers",
    keywords: ["makers", "maker", "artists", "hands", "who made", "sneha", "sainath", "sapa"],
    description: "Every hand whose work is available here, and what they made.",
  },
  {
    title: "Commission a piece",
    url: "/custom-art",
    keywords: ["commission", "custom", "bespoke", "request", "made to order"],
    description: "Start a commission from size, subject and tradition.",
  },
  {
    title: "Learn",
    url: "/learn",
    keywords: ["learn", "glossary", "history", "materials", "timeline"],
    description: "Traditions, materials and a glossary of Indian art terms.",
  },
];


/**
 * Makers, read off the catalogue rather than a people table.
 *
 * In single-brand mode there is no artist directory to search — `/artists`
 * 404s by design — so the name behind every work was reachable only by finding
 * a product first. Searching "sainath" or "sapa" returned nothing at all,
 * which is a poor answer for the person the house is named after.
 *
 * Names come from the published records (`item.artist`), the same source the
 * makers page uses, so nothing is invented: a maker appears here because a
 * work in the catalogue names them.
 */
async function makersMatching(
  needles: string[],
  limit: number
): Promise<SearchResult[]> {
  try {
    // In platform mode there is a real artist directory, already searched above,
    // and `/makers` 404s by design — emitting a maker result here would put a
    // dead link in the results. Single-brand mode has no artist module, which
    // is exactly why this fallback exists.
    if (getPlatformModeFromEnv() !== "single-brand") return [];

    let items: { artist?: string | null; handle: string; title: string }[] = [];
    try {
      items = await listCatalogue();
    } catch {
      return [];
    }

    const counts = new Map<string, number>();
    for (const item of items) {
      const maker = item.artist?.trim();
      if (!maker) continue;
      counts.set(maker, (counts.get(maker) ?? 0) + 1);
    }

    return [...counts.entries()]
      .map(([maker, works]): SearchResult => ({
        type: "maker",
        id: `maker-${slugify(maker)}`,
        title: maker,
        description: `${works} ${works === 1 ? "work" : "works"} in the collection`,
        handle: slugify(maker),
        url: `/makers#${slugify(maker)}`,
        matchScore: scoreFor(maker, "", needles),
      }))
      .filter((r) => r.matchScore > 0)
      .slice(0, limit);
  } catch {
    // Search must not fail because one optional source did.
    return [];
  }
}

export async function universalSearch(
  q: string,
  limit = 10
): Promise<{ results: SearchResult[]; count: number; query: string }> {
  const query = q.trim();
  if (!query) {
    return { results: [], count: 0, query: "" };
  }

  const needles = tokens(query);
  /**
   * The same query, but each word carries its English alternatives.
   *
   * "मिट्टी" and "clay" are one group, so a terracotta vase matches either.
   * Groups are still AND-ed between words: "चांदी बर्तन" wants a silver
   * vessel, not every silver thing and every vessel.
   */
  const groups = queryGroups(query);
  const matchesQuery = (haystack: string) => matchesGroups(haystack, groups);
  /**
   * Slug of the query, used only to match category handles.
   *
   * `slugify` strips everything that is not a-z0-9, so a Devanagari query
   * became an empty string — and `handle.includes("")` is true for every
   * handle in the shop. Searching "मधुबनी" returned all six categories as if
   * they had matched, which buried the real answer. An empty slug must mean
   * "do not compare handles", not "compare against everything".
   */
  const needleSlug = slugify(query);
  const results: SearchResult[] = [];

  // The three lookups are independent, so they run together rather than one
  // after another. Sequentially, a slow (or absent) Medusa meant search could
  // take 3 x MEDUSA_REQUEST_TIMEOUT_MS before anything appeared — long enough
  // that the browser gave up on the page instead of showing "no results".
  // Each lookup still swallows its own error, so one failing store (artists
  // are platform-only) never blanks the whole page.
  const [productHits, categoryHits, artistHits, artFormHits, journalHits] =
    await Promise.all([
    // Products
    medusa
      .listProducts({ limit, q: query })
      .then(({ products }) =>
        products.map((product): SearchResult => {
          const currency =
            product.variants?.[0]?.calculated_price?.currency_code || "inr";
          return {
            type: "product",
            id: product.id,
            title: product.title,
            subtitle: product.subtitle,
            description: product.description,
            image: product.thumbnail,
            price: getProductPrice(product),
            currency,
            handle: product.handle,
            url: `/products/${product.handle}`,
            matchScore: scoreFor(
              product.title,
              `${product.subtitle ?? ""} ${product.description ?? ""}`,
              needles
            ),
          };
        })
      )
      .catch((err) => {
        console.error("Product search failed:", err);
        return [] as SearchResult[];
      }),

    // Categories (public store API, then filter by name/handle)
    medusa
      .listProductCategories({ limit: 100 })
      .then(({ product_categories }) =>
        (product_categories || [])
          .filter((category: any) => {
            const name = String(category.name || "");
            const handle = String(category.handle || "");
            return (
              matchesAll(name, needles) ||
              (needleSlug !== "" && handle.includes(needleSlug))
            );
          })
          .slice(0, limit)
          .map(
            (category: any): SearchResult => ({
              type: "category",
              id: category.id,
              title: category.name,
              description: category.description,
              handle: category.handle,
              url: `/shop/${category.handle}`,
              matchScore: matchesAll(String(category.name || ""), needles) ? 2 : 1,
            })
          )
      )
      .catch((err) => {
        console.error("Category search failed:", err);
        return [] as SearchResult[];
      }),

    // Artists
    medusa
      .listArtists({ limit, q: query })
      .then(({ artists }) =>
        artists.map(
          (artist): SearchResult => ({
            type: "artist",
            id: artist.id,
            title: artist.display_name,
            description: artist.bio,
            image: artist.portrait_media_id,
            url: `/artists/${artist.slug}`,
            matchScore: scoreFor(
              artist.display_name,
              artist.bio ?? "",
              needles
            ),
          })
        )
      )
      .catch((err) => {
        console.error("Artist search failed:", err);
        return [] as SearchResult[];
      }),

    // Art forms — the tradition pages behind the paintings. The Hindi columns
    // are searched too: the catalogue carries a Hindi name for all eleven, and
    // a visitor typing मधुबनी should reach the Madhubani page.
    listArtForms()
      .then((forms) =>
        forms
          .filter((form) => {
            const f = form as typeof form & {
              name_hi?: string;
              description_hi?: string;
              origin_hi?: string;
            };
            const haystack = [
              form.name, form.description, form.origin,
              f.name_hi, f.description_hi, f.origin_hi,
            ]
              .filter(Boolean)
              .join(" ");
            return matchesQuery(haystack);
          })
          .slice(0, limit)
          .map(
            (form): SearchResult => {
              const f = form as typeof form & {
                name_hi?: string;
                description_hi?: string;
                origin_hi?: string;
              };
              // Scored on both languages, or a Hindi hit arrives with a score of
              // 0 — matched, yet ranked below everything as if it had not.
              return {
                type: "art-form",
                id: form.slug,
                title: form.name,
                description: form.description,
                image: form.image,
                handle: form.slug,
                url: `/art-forms/${form.slug}`,
                matchScore: scoreFor(
                  [form.name, f.name_hi].filter(Boolean).join(" "),
                  [form.description, f.description_hi, form.origin, f.origin_hi]
                    .filter(Boolean)
                    .join(" "),
                  needles
                ),
              };
            }
          )
      )
      .catch((err) => {
        console.error("Art form search failed:", err);
        return [] as SearchResult[];
      }),

    // Journal essays. Read in both languages so a Hindi query finds the essay
    // even though the listing is projected per locale.
    Promise.all([listJournalPosts(100, "en"), listJournalPosts(100, "hi")])
      .then(([en, hi]) => {
        const hiById = new Map(hi.map((p) => [p.id, p]));
        return en
          .filter((post) => {
            const h = hiById.get(post.id);
            const haystack = [post.title, post.excerpt, h?.title, h?.excerpt]
              .filter(Boolean)
              .join(" ");
            return matchesQuery(haystack);
          })
          .slice(0, limit)
          .map(
            (post): SearchResult => {
              const h = hiById.get(post.id);
              return {
                type: "journal",
                id: post.id,
                title: post.title,
                description: post.excerpt,
                image: post.cover_image,
                handle: post.slug,
                url: `/journal/${post.slug}`,
                // Same reason as art forms: score the language that matched.
                matchScore: scoreFor(
                  [post.title, h?.title].filter(Boolean).join(" "),
                  [post.excerpt, h?.excerpt].filter(Boolean).join(" "),
                  needles
                ),
              };
            }
          );
      })
      .catch((err) => {
        console.error("Journal search failed:", err);
        return [] as SearchResult[];
      }),
  ]);

  results.push(...productHits, ...categoryHits, ...artistHits);
  results.push(...artFormHits, ...journalHits);

  // Rooms and newsroom entries. Both are written by the studio and neither was
  // reachable from the search field: a visitor who read about a room in the
  // nav could not find it again by typing its name.
  //
  // Read with both languages in the row so a Hindi query matches and a Hindi
  // title still scores; `listRooms`/`listNews` collapse the pair to one locale,
  // which is right for a page and wrong for a matcher.
  try {
    const { listRooms, listNews } = await import("./rooms-news");
    const [rooms, stories] = await Promise.all([
      listRooms("en", { all: false }),
      listNews("en", { all: false }),
    ]);

    type Bilingual = { title_hi?: string; subtitle_hi?: string; body_hi?: string; summary_hi?: string };

    for (const room of rooms as (typeof rooms[number] & Bilingual)[]) {
      const haystack = [
        room.title,
        room.title_hi,
        room.kicker,
        room.subtitle,
        room.subtitle_hi,
        room.body_hi,
      ]
        .filter(Boolean)
        .join(" ");
      if (!matchesQuery(haystack)) continue;
      const score = scoreFor(
        [room.title, room.title_hi].filter(Boolean).join(" "),
        [room.subtitle, room.subtitle_hi, room.kicker].filter(Boolean).join(" "),
        needles
      );
      if (score === 0) continue;
      results.push({
        type: "room",
        id: room.slug,
        title: room.title,
        description: room.subtitle || room.kicker || "",
        image: room.image,
        handle: room.slug,
        url: `/rooms/${room.slug}`,
        matchScore: score,
      });
    }

    for (const story of stories as (typeof stories[number] & Bilingual)[]) {
      const haystack = [
        story.title,
        story.title_hi,
        story.summary,
        story.summary_hi,
        story.outlet,
        story.body_hi,
      ]
        .filter(Boolean)
        .join(" ");
      if (!matchesQuery(haystack)) continue;
      const score = scoreFor(
        [story.title, story.title_hi].filter(Boolean).join(" "),
        [story.summary, story.summary_hi, story.outlet].filter(Boolean).join(" "),
        needles
      );
      if (score === 0) continue;
      results.push({
        type: "story",
        id: story.slug,
        title: story.title,
        description: story.summary || "",
        image: story.image,
        handle: story.slug,
        url: `/newsroom/${story.slug}`,
        matchScore: score,
      });
    }
  } catch (err) {
    // Search must survive an empty or unmigrated content table.
    console.error("Room and newsroom search failed:", err);
  }

  const seenHandles = new Set(productHits.map((p) => p.handle));

  // Products, matched here rather than by Medusa.
  //
  // Medusa's `q` only matches the literal string, so a Hindi word found nothing
  // even when the English word it means was in the title: "मिट्टी" (clay) missed
  // the terracotta vase, "चांदी" (silver) missed the filigree earrings. The
  // catalogue is a few dozen works; filtering it against the same groups the
  // rest of search uses costs one read and closes the gap.
  if (groups.some((group) => group.length > 1)) {
    try {
      const items = await listCatalogue();
      for (const item of items) {
        if (seenHandles.has(item.handle)) continue;
        const haystack = [
          item.title,
          item.artist,
          item.collection,
          item.specs?.medium,
          item.stockType,
        ]
          .filter(Boolean)
          .join(" ");
        if (!matchesQuery(haystack)) continue;
        seenHandles.add(item.handle);
        results.push({
          type: "product",
          id: `cat-${item.handle}`,
          title: item.title,
          subtitle: item.collection,
          description: item.specs?.medium ?? null,
          image: item.image,
          price: item.price,
          currency: item.currency,
          handle: item.handle,
          url: `/products/${item.handle}`,
          matchScore: scoreFor(item.title, haystack, needles) || 1,
        });
      }
    } catch (error) {
      console.error("Catalogue search failed:", error);
    }
  }

  // Products found by their Hindi title.
  //
  // Medusa only searches the English catalogue, so "मधुबनी" reached the
  // tradition page but none of the paintings. The translations already exist in
  // product_translation; this resolves the ones that match back to real
  // products so Hindi shoppers get something they can buy, not just an essay.
  if (groups.some((group) => group.some((n) => /[^\x00-\x7F]/.test(n)))) {
    try {
      const hi = await productTranslationsFor("hi");
      const hits = [...hi.entries()].filter(([handle, tr]) =>
        !seenHandles.has(handle) &&
        matchesQuery(`${tr.title} ${tr.description ?? ""}`)
      );
      for (const [handle] of hits.slice(0, limit)) {
        try {
          const { product } = await medusa.getProduct(handle);
          results.push({
            type: "product",
            id: product.id,
            title: product.title,
            subtitle: product.subtitle,
            description: product.description,
            image: product.thumbnail,
            price: getProductPrice(product),
            currency:
              product.variants?.[0]?.calculated_price?.currency_code || "inr",
            handle: product.handle,
            url: `/products/${product.handle}`,
            // Found through its translation, so it is a real hit rather than a
            // body-only match.
            matchScore: 2,
          });
        } catch {
          // A translation pointing at a delisted handle is not an error here.
        }
      }
    } catch {
      // Translation lookup is best-effort; the rest of the results still stand.
    }
  }

  results.push(...(await makersMatching(needles, limit)));

  // Glossary terms and the fixed pages are local, so they are matched here
  // rather than fetched. They cost nothing and make search feel complete:
  // "bidri" should find the term even if no work is listed under it.
  for (const term of GLOSSARY) {
    const haystack = [term.term, term.meaning, term.language]
      .filter(Boolean)
      .join(" ");
    // Hindi words reach a term through their English alternatives, so
    // "मिट्टी" finds the glossary entry for terracotta.
    if (!matchesQuery(haystack)) continue;
    const score = scoreFor(term.term, `${term.meaning ?? ""} ${term.language ?? ""}`, needles);
    results.push({
      type: "glossary",
      id: `glossary-${slugify(term.term)}`,
      title: term.term,
      description: term.meaning,
      url: `/learn#glossary`,
      matchScore: score,
    });
  }

  for (const page of STATIC_PAGES) {
    const pageHaystack = `${page.title} ${page.description} ${page.keywords.join(" ")}`;
    if (!matchesQuery(pageHaystack)) continue;
    const score = scoreFor(
      page.title,
      `${page.description} ${page.keywords.join(" ")}`,
      needles
    );
    if (score === 0) continue;
    results.push({
      type: "page",
      id: `page-${page.url}`,
      title: page.title,
      description: page.description,
      url: page.url,
      matchScore: score,
    });
  }

  results.sort(
    (a, b) =>
      b.matchScore - a.matchScore || TYPE_RANK[a.type] - TYPE_RANK[b.type]
  );
  return {
    results: results.slice(0, limit),
    count: Math.min(results.length, limit),
    query,
  };
}
