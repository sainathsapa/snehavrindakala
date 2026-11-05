import { ProductCard } from "@/components/product-card";
import { products } from "@/data/products";

export default function ShopPage() {
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {products.map((product) => (
            <ProductCard key={product.id} {...product} />
          ))}
        </div>
        <p className="mt-8 text-sm text-muted font-sans">
          Currently showing seed data. Once the Medusa backend is connected,
          this list is rendered live from the product catalogue.
        </p>
      </div>
    </main>
  );
}
