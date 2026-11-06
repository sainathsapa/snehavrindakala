import { getProductPrice, getStockType, medusa } from "@/lib/medusa";
import { ProductCard } from "@/components/product-card";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  let products: Awaited<
    ReturnType<typeof medusa.listProducts>
  >["products"] = [];
  try {
    const { products: productsData } = await medusa.listProducts({
      limit: 100,
      q: q?.trim() || undefined,
    });
    products = productsData;
  } catch (err) {
    console.error("Failed to load products from Medusa", err);
  }

  return (
    <main className="py-10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl md:text-4xl font-serif font-semibold text-ink mb-8">
          All products
        </h1>
        <p className="mb-8 text-lg text-muted font-sans leading-relaxed">
          Browse our curated catalogue. Each listing shows the maker, materials,
          care details, and whether it is ready to ship or made to order.
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
            <p className="text-lg text-muted font-sans mb-6">
              The catalogue is being refreshed. Please check back shortly.
            </p>
            <Link
              href="/art-forms"
              className="px-6 py-3 bg-terracotta text-white rounded-md font-medium hover:bg-terracotta/90 focus:outline-none focus:ring-2 focus:ring-terracotta focus:ring-offset-2 transition-colors"
            >
              Browse Art Forms
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
