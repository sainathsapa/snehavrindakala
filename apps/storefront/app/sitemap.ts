import { MetadataRoute } from "next";
import { medusa } from "@/lib/medusa";

const baseUrl =
  process.env.NEXT_PUBLIC_STOREFRONT_URL || "http://localhost:3000";

const staticRoutes: MetadataRoute.Sitemap = [
  { url: baseUrl, changeFrequency: "daily", priority: 1 },
  { url: `${baseUrl}/shop`, changeFrequency: "daily", priority: 0.8 },
  { url: `${baseUrl}/art-forms`, changeFrequency: "weekly", priority: 0.8 },
  { url: `${baseUrl}/artists`, changeFrequency: "weekly", priority: 0.7 },
  { url: `${baseUrl}/custom-art`, changeFrequency: "monthly", priority: 0.8 },
  { url: `${baseUrl}/journal`, changeFrequency: "weekly", priority: 0.6 },
  { url: `${baseUrl}/about`, changeFrequency: "monthly", priority: 0.5 },
  { url: `${baseUrl}/sell`, changeFrequency: "monthly", priority: 0.5 },
  {
    url: `${baseUrl}/policies/shipping`,
    changeFrequency: "monthly",
    priority: 0.4,
  },
  {
    url: `${baseUrl}/policies/returns`,
    changeFrequency: "monthly",
    priority: 0.4,
  },
  {
    url: `${baseUrl}/policies/privacy`,
    changeFrequency: "monthly",
    priority: 0.4,
  },
  {
    url: `${baseUrl}/policies/terms`,
    changeFrequency: "monthly",
    priority: 0.4,
  },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const routes: MetadataRoute.Sitemap = [...staticRoutes];

  // Dynamic product entries
  try {
    const { products } = await medusa.listProducts({ limit: 200 });
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

  // Dynamic artist entries
  try {
    const { artists } = await medusa.listArtists({ limit: 200 });
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
