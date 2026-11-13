/**
 * Universal storefront search across products, categories, and artists.
 *
 * Shared by the `/api/store/search` route and the `/search` page so the page
 * never has to call its own API over the network.
 */

import { getProductPrice, medusa } from "./medusa";
import { slugify } from "./slugs";

export interface SearchResult {
  type: "product" | "category" | "artist";
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
  const [productHits, categoryHits, artistHits] = await Promise.all([
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
  ]);

  results.push(...productHits, ...categoryHits, ...artistHits);

  results.sort((a, b) => b.matchScore - a.matchScore);
  return {
    results: results.slice(0, limit),
    count: Math.min(results.length, limit),
    query,
  };
}
