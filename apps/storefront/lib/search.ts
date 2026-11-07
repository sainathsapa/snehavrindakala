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

  // Products
  try {
    const { products } = await medusa.listProducts({ limit, q: query });
    for (const product of products) {
      const currency =
        product.variants?.[0]?.calculated_price?.currency_code || "inr";
      results.push({
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
      });
    }
  } catch (err) {
    console.error("Product search failed:", err);
  }

  // Categories (public store API, then filter by name/handle)
  try {
    const { product_categories } = await medusa.listProductCategories({
      limit: 100,
    });
    const categories = (product_categories || []).filter((category: any) => {
      const name = String(category.name || "").toLowerCase();
      const handle = String(category.handle || "").toLowerCase();
      return name.includes(needle) || handle.includes(slugify(query));
    });
    for (const category of categories.slice(0, limit)) {
      results.push({
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
      });
    }
  } catch (err) {
    console.error("Category search failed:", err);
  }

  // Artists
  try {
    const { artists } = await medusa.listArtists({ limit, q: query });
    for (const artist of artists) {
      results.push({
        type: "artist",
        id: artist.id,
        title: artist.display_name,
        description: artist.bio,
        image: artist.portrait_media_id,
        url: `/artists/${artist.slug}`,
        matchScore: artist.display_name.toLowerCase().includes(needle)
          ? 2
          : 1,
      });
    }
  } catch (err) {
    console.error("Artist search failed:", err);
  }

  results.sort((a, b) => b.matchScore - a.matchScore);
  return {
    results: results.slice(0, limit),
    count: Math.min(results.length, limit),
    query,
  };
}
