import { medusa } from "@/lib/medusa";
import { ProductCard } from "@/components/product-card";
import Link from "next/link";

export default async function ShopPage() {
  let products: any[] = [];
  try {
    const { products: productsData } = await medusa.listProducts({
      limit: 100,
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
            {products.map((product) => {
              const variants = product.variants || [];
              const price = variants[0]?.price || product.price || 0;
              const stockType = product.options?.find(
                (o: any) => o.title === "Stock type"
              )?.values?.[0]?.value || "ready_to_ship";
              return (
                <ProductCard
                  key={product.id}
                  id={product.id}
                  title={product.title}
                  artist={product.category?.name || "Artist"}
                  price={price / 100}
                  stockType={stockType as any}
                  image={
                    product.images?.[0]?.url ||
                    `/images/products/${product.handle}.jpg`
                  }
                  isNew={product.is_new}
                />
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-lg text-muted font-sans mb-6">
              No products found. Connect the Medusa backend to load catalogue
              data.
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
