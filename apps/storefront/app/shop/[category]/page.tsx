import { getProductPrice, getStockType, medusa } from "@/lib/medusa";
import { ProductCard } from "@/components/product-card";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getArtFormBySlug, artFormSlugs, slugify } from "@/lib/slugs";

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

export const metadata = async ({
  params,
}: {
  params: Promise<{ category: string }>;
}) => {
  const { category } = await params;
  const resolved = await resolveCategory(category);
  return {
    title: resolved
      ? `${resolved.name} | SnehaVrinda Kala`
      : "Collection | SnehaVrinda Kala",
    description: resolved
      ? resolved.description
      : "Browse curated collections by art form at SnehaVrinda Kala.",
    alternates: {
      canonical: resolved ? `/shop/${resolved.handle}` : `/shop/${category}`,
    },
    openGraph: {
      title: resolved ? `${resolved.name} | SnehaVrinda Kala` : undefined,
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

  let products: Awaited<
    ReturnType<typeof medusa.listProducts>
  >["products"] = [];
  try {
    const { products: productsData } = await medusa.listProducts({
      limit: 100,
      ...(resolved.id ? { category: resolved.id } : { q: resolved.query }),
    });
    products = productsData;
  } catch (err) {
    console.error("Failed to load products from Medusa", err);
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
    <main className="py-10 bg-rang-paper">
      <script
        id="schema-breadcrumb"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }}
      />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <nav className="mb-6 text-sm text-muted-ink font-sans">
          <Link
            href="/shop"
            className="hover:text-sindoor transition-colors"
          >
            ← All products
          </Link>
          <span className="mx-2 text-muted-ink">/</span>
          <span className="text-sindoor font-medium">
            {resolved.name}
          </span>
        </nav>

        <h1 className="text-3xl md:text-4xl font-serif font-semibold text-deep-ink mb-4">
          {resolved.name}
        </h1>
        <p className="mb-8 text-lg text-muted-ink font-sans leading-relaxed">
          {resolved.description}
        </p>

        {products.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {products.map((product) => (
              <ProductCard
                key={product.id}
                handle={product.handle}
                title={product.title}
                artist={product.category?.name || "SnehaVrinda Kala"}
                price={getProductPrice(product)}
                stockType={getStockType(product)}
                image={
                  product.thumbnail ||
                  product.images?.[0]?.url ||
                  "/images/product-placeholder.svg"
                }
                isNew={product.is_new}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-lg text-muted-ink font-sans mb-6">
              No products in this collection yet. Check back soon.
            </p>
            <Link
              href="/shop"
              className="px-6 py-3 bg-sindoor text-rang-paper rounded-md font-medium hover:bg-sindoor/90 focus:outline-none focus:ring-2 focus:ring-sindoor focus:ring-offset-2 transition-colors"
            >
              Browse all products
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
