import { medusa } from "@/lib/medusa";
import { ProductCard } from "@/components/product-card";
import { listCatalogueFor } from "@/lib/catalogue";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getArtFormBySlug, artFormSlugs, slugify } from "@/lib/slugs";
import { PageHeader } from "@/components/page-header";
import { BotanicalRule } from "@/components/ornaments";

export const dynamic = "force-dynamic";

interface ResolvedCategory {
  id?: string;
  name: string;
  handle: string;
  description: string;
  /** Fallback text query when no Medusa category exists yet. */
  query?: string;
}

interface StoreCategory {
  id: string;
  name: string;
  handle: string;
  description?: string | null;
}

/**
 * Resolve a URL segment to a real Medusa product category.
 *
 * Resolution order:
 *  1. Exact category handle (e.g. `/shop/folk-art`).
 *  2. Slugified category name (e.g. `/shop/folk-art`).
 *  3. Legacy art-form slug -> matching category name (e.g. `/shop/folk`).
 *  4. Legacy art-form slug -> catalogue text search (keeps old SEO URLs alive).
 */
async function resolveCategory(param: string): Promise<ResolvedCategory | null> {
  const legacy = getArtFormBySlug(param);

  try {
    const { product_categories } = await medusa.listProductCategories({
      limit: 100,
    });
    const categories = (product_categories || []) as StoreCategory[];

    const exact = categories.find(
      (category) =>
        category.handle === param || slugify(category.name) === param
    );
    if (exact) {
      return {
        id: exact.id,
        name: exact.name,
        handle: exact.handle || slugify(exact.name),
        description:
          exact.description ||
          legacy?.description ||
          "Browse this collection of handmade works from Indian makers.",
      };
    }

    if (legacy) {
      const query = legacy.query.toLowerCase();
      const matching = categories.find(
        (category) =>
          category.name.toLowerCase().includes(query) ||
          (category.handle || "").toLowerCase().includes(slugify(query))
      );
      if (matching) {
        return {
          id: matching.id,
          name: matching.name,
          handle: matching.handle || slugify(matching.name),
          description:
            matching.description || legacy.description,
        };
      }
      return {
        name: legacy.name,
        handle: legacy.slug,
        description: legacy.description,
        query: legacy.query,
      };
    }

    return null;
  } catch (err) {
    console.error("Failed to resolve category from Medusa", err);
    if (legacy) {
      return {
        name: legacy.name,
        handle: legacy.slug,
        description: legacy.description,
        query: legacy.query,
      };
    }
    return null;
  }
}

export function generateStaticParams() {
  return artFormSlugs.map((form) => ({
    category: form.slug,
  }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  // Next 15 may invoke this from a client-side MetadataOutlet with no params,
  // which throws "Cannot destructure property 'category' of undefined" and
  // takes the whole route down with a client exception.
  const category = (await params)?.category ?? "";
  const resolved = category ? await resolveCategory(category) : null;
  return {
    // The root layout appends "| SnehaVrinda Kala"; including it here doubled it
    // ("Folk Art | SnehaVrinda Kala | SnehaVrinda Kala").
    title: resolved ? resolved.name : "Collection",
    description: resolved
      ? resolved.description
      : "Browse curated collections by art form at SnehaVrinda Kala.",
    alternates: {
      canonical: resolved ? `/shop/${resolved.handle}` : `/shop/${category}`,
    },
    openGraph: {
      title: resolved ? resolved.name : undefined,
      description: resolved ? resolved.description : undefined,
      type: "website",
    },
  };
};

export default async function ShopCategoryPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category } = await params;
  const resolved = await resolveCategory(category);

  if (!resolved) {
    notFound();
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_STOREFRONT_URL || "http://localhost:3000";

  let items: Awaited<ReturnType<typeof listCatalogueFor>> = [];
  try {
    // Match on every key this collection could be known by: the Medusa
    // category handle, its display name, and the taxonomy slug (which may differ
    // — `/shop/painting` maps to a category that may not exist in Medusa at all).
    items = await listCatalogueFor(
      [resolved.handle, resolved.name, category, resolved.query ?? ""].filter(Boolean)
    );
  } catch (err) {
    console.error("Failed to load products for category", err);
  }

  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: `${baseUrl}`,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Shop",
        item: `${baseUrl}/shop`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: resolved.name,
        item: `${baseUrl}/shop/${resolved.handle}`,
      },
    ],
  };

  return (
    <main className="bg-rang-paper">
      <script
        id="schema-breadcrumb"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }}
      />

      <PageHeader
        eyebrow="Collection"
        title={resolved.name}
        intro={resolved.description}
        breadcrumb={[
          { label: "Home", href: "/" },
          { label: "The Collection", href: "/shop" },
          { label: resolved.name },
        ]}
      />

      <section className="pb-20 pt-10">
        <div className="mx-auto max-w-[1400px] px-5 sm:px-8 lg:px-12">
          <div className="mb-10 flex flex-wrap items-center justify-between gap-4 border-b border-sand-border/60 pb-5">
            <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.22em] text-terracotta">
              {items.length} {items.length === 1 ? "work" : "works"}
            </p>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
              <Link
                href="/shop"
                className="font-serif text-sm italic text-muted-ink transition-colors hover:text-kumkum"
              >
                all works
              </Link>
              <Link
                href="/art-forms"
                className="font-serif text-sm italic text-muted-ink transition-colors hover:text-kumkum"
              >
                all art forms
              </Link>
            </div>
          </div>

          {items.length > 0 ? (
            <div className="grid grid-cols-1 gap-x-6 gap-y-14 sm:grid-cols-2 lg:grid-cols-4">
              {items.map((item) => (
                <ProductCard
                  key={item.handle}
                  handle={item.handle}
                  title={item.title}
                  artist={item.artist}
                  price={item.price}
                  currency={item.currency}
                  stockType={item.stockType}
                  image={item.image}
                  isNew={item.isNew}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <BotanicalRule className="mb-6 text-terracotta" />
              <p className="max-w-sm font-serif text-xl leading-relaxed text-deep-ink">
                Nothing in this collection just yet.
              </p>
              <p className="mt-2 font-sans text-sm text-muted-ink">
                New work is added as it is finished, not on a schedule.
              </p>
              <Link
                href="/shop"
                className="mt-8 inline-flex items-center gap-2 rounded-full bg-kumkum px-6 py-3 font-sans text-sm font-medium text-rang-paper transition-colors hover:bg-sindoor"
              >
                Browse all works
                <span aria-hidden="true">→</span>
              </Link>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
