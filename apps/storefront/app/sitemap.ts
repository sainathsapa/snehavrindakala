import type { MetadataRoute } from "next";
import { medusa } from "@/lib/medusa";
import { artFormSlugs } from "@/lib/slugs";
import { listArtForms, listFeaturedCategories } from "@/lib/site-content";
import { listNews, listRooms } from "@/lib/rooms-news";
import { listCatalogue } from "@/lib/catalogue";
import { getPlatformModeFromEnv } from "@/lib/settings";

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

  // Platform-only routes are added further down, and only when the site runs in
  // platform mode. Advertising a URL that 404s is a sitemap error.
  const entries: MetadataRoute.Sitemap = [
    { url: `${baseUrl}/`, changeFrequency: "daily", priority: 1, lastModified: now },
    { url: `${baseUrl}/shop`, changeFrequency: "daily", priority: 0.9, lastModified: now },
    { url: `${baseUrl}/art-forms`, changeFrequency: "weekly", priority: 0.8, lastModified: now },
    { url: `${baseUrl}/learn`, changeFrequency: "monthly", priority: 0.7, lastModified: now },
    { url: `${baseUrl}/custom-art`, changeFrequency: "monthly", priority: 0.8, lastModified: now },
    { url: `${baseUrl}/journal`, changeFrequency: "weekly", priority: 0.6, lastModified: now },
    { url: `${baseUrl}/about`, changeFrequency: "monthly", priority: 0.5, lastModified: now },
    { url: `${baseUrl}/policies/shipping`, changeFrequency: "yearly", priority: 0.3, lastModified: now },
    { url: `${baseUrl}/policies/returns`, changeFrequency: "yearly", priority: 0.3, lastModified: now },
    { url: `${baseUrl}/policies/privacy`, changeFrequency: "yearly", priority: 0.3, lastModified: now },
    { url: `${baseUrl}/policies/terms`, changeFrequency: "yearly", priority: 0.3, lastModified: now },
    { url: `${baseUrl}/policies/cookie`, changeFrequency: "yearly", priority: 0.3, lastModified: now },
    { url: `${baseUrl}/authenticity`, changeFrequency: "monthly", priority: 0.5, lastModified: now },
    { url: `${baseUrl}/faq`, changeFrequency: "yearly", priority: 0.4, lastModified: now },
    { url: `${baseUrl}/disclaimer`, changeFrequency: "yearly", priority: 0.2, lastModified: now },
  ];

  // ── Collections ──────────────────────────────────────────────────────────
  // Dedup by path: the admin list, the taxonomy and the featured categories
  // overlap heavily, and duplicate <loc> entries are a sitemap error.
  const collectionPaths = new Set<string>();
  for (const form of artFormSlugs) collectionPaths.add(`/shop/${form.slug}`);

  // Each tradition also has an editorial page explaining it, which is the more
  // valuable landing page for search. 
  const storyPaths = new Set<string>();
  for (const form of artFormSlugs) storyPaths.add(`/art-forms/${form.slug}`);

  try {
    for (const form of await listArtForms()) {
      collectionPaths.add(`/shop/${form.slug}`);
      storyPaths.add(`/art-forms/${form.slug}`);
    }
  } catch {
    // Admin content unreachable; the static taxonomy above still covers it.
  }

  for (const path of storyPaths) {
    entries.push({
      url: `${baseUrl}${path}`,
      changeFrequency: "monthly",
      priority: 0.7,
      lastModified: now,
    });
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

  // ── Single-brand routes ──────────────────────────────────────────────────
  // The makers page exists only where there is no /artists directory. It is
  // listed before the platform block so the two can never both appear.
  if (getPlatformModeFromEnv() !== "platform") {
    entries.push({
      url: `${baseUrl}/makers`,
      changeFrequency: "weekly",
      priority: 0.7,
      lastModified: now,
    });
  }

  // ── Rooms and the newsroom ───────────────────────────────────────────────
  // Added after the pages shipped: an editorial section that no crawler is told
  // about is a section nobody will ever find by search. Slugs come from the
  // content tables, so a new room is listed without editing this file.
  entries.push(
    { url: `${baseUrl}/rooms`, changeFrequency: "weekly", priority: 0.7, lastModified: now },
    { url: `${baseUrl}/newsroom`, changeFrequency: "weekly", priority: 0.5, lastModified: now }
  );
  try {
    for (const room of await listRooms("en")) {
      entries.push({
        url: `${baseUrl}/rooms/${room.slug}`,
        changeFrequency: "monthly",
        priority: 0.6,
        lastModified: new Date(room.updated_at || now),
      });
    }
    for (const item of await listNews("en")) {
      entries.push({
        url: `${baseUrl}/newsroom/${item.slug}`,
        changeFrequency: "yearly",
        priority: 0.4,
        lastModified: new Date(item.published_at || now),
      });
    }
  } catch {
    // A content table that is missing must not take the sitemap down with it.
  }

  // ── Artist pages ─────────────────────────────────────────────────────────
  // /artists and /sell used to 404 outside platform mode and were withheld here;
  // both render in single-brand mode now, so they are always listed.
  entries.push(
    { url: `${baseUrl}/artists`, changeFrequency: "weekly", priority: 0.7, lastModified: now },
    { url: `${baseUrl}/sell`, changeFrequency: "monthly", priority: 0.4, lastModified: now }
  );

  if (getPlatformModeFromEnv() === "platform") {
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
  }

  // ── Hindi ─────────────────────────────────────────────────────────────────
  //
  // The site is fully bilingual but the sitemap listed English only, so every
  // Hindi page — all of /hi/shop, /hi/art-forms, the translated journal essays —
  // was invisible to a crawler entering here. Each English entry gets a Hindi
  // twin, with `alternates.languages` on both so the pair is declared as one
  // page in two languages rather than two unrelated pages competing for the
  // same query.
  //
  // Built from the finished list rather than alongside each push above, so a
  // route added later cannot be listed in English and forgotten in Hindi.
  // hreflang in a sitemap must be a fully-qualified URL, just like <loc>.
  // Relative values ("/", "/hi") are ignored by Google, which left every Hindi
  // page invisible to a crawler starting here. Mirror the absolute <loc>
  // values built above by prefixing the same base URL.
  const withAlternates = (entry: MetadataRoute.Sitemap[number]) => {
    const path = entry.url.slice(baseUrl.length) || "/";
    const en = path === "/" ? "/" : path;
    const hi = path === "/" ? "/hi" : `/hi${path}`;
    return {
      ...entry,
      alternates: {
        languages: {
          en: `${baseUrl}${en}`,
          hi: `${baseUrl}${hi}`,
          "x-default": `${baseUrl}${en}`,
        },
      },
    };
  };

  const english = entries.map(withAlternates);
  const hindi = entries.map((entry) => {
    const path = entry.url.slice(baseUrl.length) || "/";
    const en = path === "/" ? "/" : path;
    const hi = path === "/" ? "/hi" : `/hi${path}`;
    return {
      ...entry,
      url: `${baseUrl}${hi}`,
      alternates: {
        languages: {
          en: `${baseUrl}${en}`,
          hi: `${baseUrl}${hi}`,
          "x-default": `${baseUrl}${en}`,
        },
      },
    };
  });

  return [...english, ...hindi];
}
