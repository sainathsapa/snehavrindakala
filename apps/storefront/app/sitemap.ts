import { MetadataRoute } from "next";
import { medusa } from "@/lib/medusa";
import { artFormSlugs } from "@/lib/slugs";

const baseUrl =
  process.env.NEXT_PUBLIC_STOREFRONT_URL || "http://localhost:3000";

const now = new Date();

/**
 * Static routes — core pages that always exist.
 */
const staticRoutes: MetadataRoute.Sitemap = [
  { url: baseUrl, changeFrequency: "daily", priority: 1.0, lastModified: now },
  { url: `${baseUrl}/shop`, changeFrequency: "daily", priority: 0.9, lastModified: now },
  { url: `${baseUrl}/art-forms`, changeFrequency: "weekly", priority: 0.8, lastModified: now },
  { url: `${baseUrl}/artists`, changeFrequency: "weekly", priority: 0.7, lastModified: now },
  { url: `${baseUrl}/custom-art`, changeFrequency: "monthly", priority: 0.8, lastModified: now },
  { url: `${baseUrl}/journal`, changeFrequency: "weekly", priority: 0.6, lastModified: now },
  { url: `${baseUrl}/about`, changeFrequency: "monthly", priority: 0.5, lastModified: now },
  { url: `${baseUrl}/sell`, changeFrequency: "monthly", priority: 0.5, lastModified: now },
  { url: `${baseUrl}/policies/shipping`, changeFrequency: "monthly", priority: 0.4, lastModified: now },
  { url: `${baseUrl}/policies/returns`, changeFrequency: "monthly", priority: 0.4, lastModified: now },
  { url: `${baseUrl}/policies/privacy`, changeFrequency: "monthly", priority: 0.4, lastModified: now },
  { url: `${baseUrl}/policies/terms`, changeFrequency: "monthly", priority: 0.4, lastModified: now },
];

/**
 * Build the full sitemap including dynamic content from Medusa.
 * Uses paginated listAll* helpers so every product/artist is included
 * regardless of catalogue size (100, 1000, 4000+).
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const routes: MetadataRoute.Sitemap = [...staticRoutes];

  // ── 1. Art-form / category pages (SEO-friendly: /shop/folk, /shop/painting, …) ──
  for (const form of artFormSlugs) {
    routes.push({
      url: `${baseUrl}/shop/${form.slug}`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.75,
    });
  }

  // ── 2. Product pages (/products/:handle) ──
  try {
    const products = await medusa.listAllProducts({ limit: 500 });
    for (const product of products) {
      routes.push({
        url: `${baseUrl}/products/${product.handle}`,
        lastModified: new Date(product.updated_at || now),
        changeFrequency: "weekly",
        priority: 0.7,
      });
    }
  } catch {
    // Backend not reachable at build time; static routes still valid.
  }

  // ── 3. Artist pages (/artists/:slug) ──
  try {
    const artists = await medusa.listAllArtists({ limit: 500 });
    for (const artist of artists) {
      routes.push({
        url: `${baseUrl}/artists/${artist.slug}`,
        lastModified: now,
        changeFrequency: "monthly",
        priority: 0.6,
      });
    }
  } catch {
    // Backend not reachable at build time.
  }

  return routes;
}
