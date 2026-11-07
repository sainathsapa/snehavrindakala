import { getProductPrice, getStockType, medusa } from "@/lib/medusa";
import { ProductCard } from "@/components/product-card";
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

  let products: Awaited<
    ReturnType<typeof medusa.listProducts>
  >["products"] = [];
  try {
    const { products: productsData } = await medusa.listProducts({
      limit: 100,
    });
    products = productsData;
  } catch (err) {
    console.error("Failed to load products from Medusa", err);
  }

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
    <main className="py-10 bg-rang-paper">
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
