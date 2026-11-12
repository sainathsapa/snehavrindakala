import { medusa } from "@/lib/medusa";
import { listCatalogue } from "@/lib/catalogue";
import { ProductCard } from "@/components/product-card";
import { PaisleyField } from "@/components/ornaments";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getArtFormByQuery } from "@/lib/slugs";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "All Products | SnehaVrinda Kala",
  description:
    "Browse our curated catalogue of ready-to-ship artwork, made-to-order pieces, and custom commissions from Indian makers.",
  alternates: {
    canonical: "/shop",
  },
};

export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;

  // Redirect legacy query-param URLs to SEO-friendly paths (/shop?q=Folk → /shop/folk)
  if (q?.trim()) {
    const artForm = getArtFormByQuery(q.trim());
    if (artForm) {
      redirect(`/shop/${artForm.slug}`);
    }
  }

  // Live catalogue, falling back to the seed set when Medusa is empty, so the
  // shop never renders blank while the backend is only partly populated.
  const items = await listCatalogue();

  let categories: Array<{
    id: string;
    name: string;
    handle: string;
  }> = [];
  try {
    const { product_categories } = await medusa.listProductCategories({
      limit: 100,
    });
    categories = (product_categories || []).map((category: any) => ({
      id: category.id,
      name: category.name,
      handle: category.handle,
    }));
  } catch (err) {
    console.error("Failed to load product categories from Medusa", err);
  }

  return (
    <main className="relative bg-rang-paper py-10">
      <PaisleyField className="pointer-events-none absolute right-0 top-0 hidden h-72 w-72 text-terracotta/[0.05] lg:block" />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl md:text-4xl font-serif font-semibold text-deep-ink mb-8">
          All products
        </h1>
        <p className="mb-6 text-lg text-muted-ink font-sans leading-relaxed">
          Browse our curated catalogue. Each listing shows the maker, materials,
          care details, and whether it is ready to ship or made to order.
        </p>

        {categories.length > 0 && (
          <div className="mb-8 flex flex-wrap gap-2" aria-label="Product categories">
            {categories.map((category) => (
              <Link
                key={category.id}
                href={`/shop/${category.handle}`}
                className="rounded-full border border-sand-border bg-surface px-4 py-1.5 text-sm font-sans text-deep-ink hover:border-sindoor hover:text-sindoor transition-colors"
              >
                {category.name}
              </Link>
            ))}
          </div>
        )}

        {items.length > 0 ? (
          <div className="grid grid-cols-1 gap-x-5 gap-y-9 sm:grid-cols-2 lg:grid-cols-4">
            {items.map((item) => (
              <ProductCard
                key={item.handle}
                handle={item.handle}
                title={item.title}
                artist={item.artist}
                price={item.price}
                stockType={item.stockType}
                image={item.image}
                isNew={item.isNew}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-lg text-muted-ink font-sans mb-6">
              The catalogue is being refreshed. Please check back shortly.
            </p>
            <Link
              href="/art-forms"
              className="px-6 py-3 bg-sindoor text-rang-paper rounded-md font-medium hover:bg-sindoor/90 focus:outline-none focus:ring-2 focus:ring-sindoor focus:ring-offset-2 transition-colors"
            >
              Browse Art Forms
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
