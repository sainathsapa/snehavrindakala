/**
 * Universal storefront search across products, categories, and artists.
 *
 * Shared by the `/api/store/search` route and the `/search` page so the page
 * never has to call its own API over the network.
 */

import { getProductPrice, medusa } from "./medusa";
import { slugify } from "./slugs";
import { GLOSSARY } from "./art-reference";
import { listArtForms } from "./site-content";
import { listJournalPosts } from "./journal";

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
    keywords: ["about", "story", "artist", "sneha", "bikaner", "studio"],
    description: "The house, the artist and where the work is made.",
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

export interface SearchResult {
  // `art-form`, `journal`, `glossary` and `page` cover the editorial side of
  // the site. Without them, searching "madhubani" found paintings but not the
  // tradition page or the essay explaining it, which is exactly what a visitor
  // looking an unfamiliar term up wants.
  type: "product" | "category" | "artist" | "art-form" | "journal" | "glossary" | "page";
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

export async function universalSearch(
  q: string,
  limit = 10
): Promise<{ results: SearchResult[]; count: number; query: string }> {
  const query = q.trim();
  if (!query) {
    return { results: [], count: 0, query: "" };
  }

  const needle = query.toLowerCase();
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
            matchScore: product.title.toLowerCase().includes(needle) ? 2 : 1,
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
            const name = String(category.name || "").toLowerCase();
            const handle = String(category.handle || "").toLowerCase();
            return name.includes(needle) || handle.includes(slugify(query));
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
              matchScore: String(category.name || "")
                .toLowerCase()
                .includes(needle)
                ? 2
                : 1,
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
            matchScore: artist.display_name.toLowerCase().includes(needle)
              ? 2
              : 1,
          })
        )
      )
      .catch((err) => {
        console.error("Artist search failed:", err);
        return [] as SearchResult[];
      }),

    // Art forms — the tradition pages behind the paintings.
    listArtForms()
      .then((forms) =>
        forms
          .filter((form) => {
            const haystack = [form.name, form.description, form.origin]
              .filter(Boolean)
              .join(" ")
              .toLowerCase();
            return haystack.includes(needle);
          })
          .slice(0, limit)
          .map(
            (form): SearchResult => ({
              type: "art-form",
              id: form.slug,
              title: form.name,
              description: form.description,
              image: form.image,
              handle: form.slug,
              url: `/art-forms/${form.slug}`,
              matchScore: form.name.toLowerCase().includes(needle) ? 2 : 1,
            })
          )
      )
      .catch((err) => {
        console.error("Art form search failed:", err);
        return [] as SearchResult[];
      }),

    // Journal essays.
    listJournalPosts(100)
      .then((posts) =>
        posts
          .filter((post) => {
            const haystack = [post.title, post.excerpt]
              .filter(Boolean)
              .join(" ")
              .toLowerCase();
            return haystack.includes(needle);
          })
          .slice(0, limit)
          .map(
            (post): SearchResult => ({
              type: "journal",
              id: post.id,
              title: post.title,
              description: post.excerpt,
              image: post.cover_image,
              handle: post.slug,
              url: `/journal/${post.slug}`,
              matchScore: post.title.toLowerCase().includes(needle) ? 2 : 1,
            })
          )
      )
      .catch((err) => {
        console.error("Journal search failed:", err);
        return [] as SearchResult[];
      }),
  ]);

  results.push(...productHits, ...categoryHits, ...artistHits);
  results.push(...artFormHits, ...journalHits);

  // Glossary terms and the fixed pages are local, so they are matched here
  // rather than fetched. They cost nothing and make search feel complete:
  // "bidri" should find the term even if no work is listed under it.
  for (const term of GLOSSARY) {
    const haystack = [term.term, term.meaning, term.language]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    if (!haystack.includes(needle)) continue;
    results.push({
      type: "glossary",
      id: `glossary-${slugify(term.term)}`,
      title: term.term,
      description: term.meaning,
      url: `/learn#glossary`,
      matchScore: term.term.toLowerCase().includes(needle) ? 2 : 1,
    });
  }

  for (const page of STATIC_PAGES) {
    const haystack = [page.title, page.description, ...page.keywords]
      .join(" ")
      .toLowerCase();
    if (!haystack.includes(needle)) continue;
    results.push({
      type: "page",
      id: `page-${page.url}`,
      title: page.title,
      description: page.description,
      url: page.url,
      matchScore: page.title.toLowerCase().includes(needle) ? 2 : 1,
    });
  }

  results.sort((a, b) => b.matchScore - a.matchScore);
  return {
    results: results.slice(0, limit),
    count: Math.min(results.length, limit),
    query,
  };
}
