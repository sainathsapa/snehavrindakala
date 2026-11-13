import type { MetadataRoute } from "next";
import { medusa } from "@/lib/medusa";
import { artFormSlugs } from "@/lib/slugs";
import { listArtForms, listFeaturedCategories } from "@/lib/site-content";
import { listCatalogue } from "@/lib/catalogue";

const baseUrl = (
  process.env.NEXT_PUBLIC_STOREFRONT_URL || "http://localhost:3000"
).replace(/\/$/, "");

export const dynamic = "force-dynamic";
export const revalidate = 3600;

/**
 * Every public route, for crawlers.
 *
 * Art-form and product entries are collected from all three sources the
 * storefront actually renders from — the admin-managed list, the catalogue
 * (live Medusa plus the seed set) and the static taxonomy — so the sitemap
 * never advertises a URL that 404s or omits one that exists.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const entries: MetadataRoute.Sitemap = [
    { url: `${baseUrl}/`, changeFrequency: "daily", priority: 1, lastModified: now },
    { url: `${baseUrl}/shop`, changeFrequency: "daily", priority: 0.9, lastModified: now },
    { url: `${baseUrl}/art-forms`, changeFrequency: "weekly", priority: 0.8, lastModified: now },
    { url: `${baseUrl}/custom-art`, changeFrequency: "monthly", priority: 0.8, lastModified: now },
    { url: `${baseUrl}/artists`, changeFrequency: "weekly", priority: 0.7, lastModified: now },
    { url: `${baseUrl}/journal`, changeFrequency: "weekly", priority: 0.6, lastModified: now },
    { url: `${baseUrl}/about`, changeFrequency: "monthly", priority: 0.5, lastModified: now },
    { url: `${baseUrl}/sell`, changeFrequency: "monthly", priority: 0.4, lastModified: now },
    { url: `${baseUrl}/policies/shipping`, changeFrequency: "yearly", priority: 0.3, lastModified: now },
    { url: `${baseUrl}/policies/returns`, changeFrequency: "yearly", priority: 0.3, lastModified: now },
    { url: `${baseUrl}/policies/privacy`, changeFrequency: "yearly", priority: 0.3, lastModified: now },
    { url: `${baseUrl}/policies/terms`, changeFrequency: "yearly", priority: 0.3, lastModified: now },
  ];

  // ── Collections ──────────────────────────────────────────────────────────
  // Dedup by path: the admin list, the taxonomy and the featured categories
  // overlap heavily, and duplicate <loc> entries are a sitemap error.
  const collectionPaths = new Set<string>();
  for (const form of artFormSlugs) collectionPaths.add(`/shop/${form.slug}`);

  try {
    for (const form of await listArtForms()) collectionPaths.add(`/shop/${form.slug}`);
  } catch {
    // Admin content unreachable; the static taxonomy above still covers it.
  }

  try {
    for (const category of await listFeaturedCategories()) {
      if (category.href.startsWith("/shop/")) collectionPaths.add(category.href);
    }
  } catch {
    // Non-fatal.
  }

  for (const path of collectionPaths) {
    entries.push({
      url: `${baseUrl}${path}`,
      changeFrequency: "weekly",
      priority: 0.75,
      lastModified: now,
    });
  }

  // ── Products ─────────────────────────────────────────────────────────────
  const productHandles = new Set<string>();
  try {
    const { products } = await medusa.listProducts({ limit: 500 });
    for (const product of products ?? []) productHandles.add(product.handle);
  } catch {
    // Backend unreachable.
  }
  try {
    for (const item of await listCatalogue()) productHandles.add(item.handle);
  } catch {
    // Non-fatal.
  }

  for (const handle of productHandles) {
    entries.push({
      url: `${baseUrl}/products/${handle}`,
      changeFrequency: "weekly",
      priority: 0.7,
      lastModified: now,
    });
  }

  // ── Artists ──────────────────────────────────────────────────────────────
  try {
    const artists = await medusa.listAllArtists({ limit: 500 });
    for (const artist of artists) {
      entries.push({
        url: `${baseUrl}/artists/${artist.slug}`,
        changeFrequency: "monthly",
        priority: 0.6,
        lastModified: now,
      });
    }
  } catch {
    // Backend unreachable.
  }

  return entries;
}
