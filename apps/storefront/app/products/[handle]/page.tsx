import { medusa } from "@/lib/medusa";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  let product: any = null;
  try {
    const { product: prod } = await medusa.getProduct(handle);
    product = prod;
  } catch (err) {
    notFound();
  }

  if (!product) {
    notFound();
  }

  const variants = product.variants || [];
  const price = variants[0]?.price || product.price || 0;
  const images = product.images || [];

  return (
    <main className="py-10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <nav className="mb-8 text-sm text-muted font-sans">
          <Link href="/shop" className="hover:text-terracotta transition-colors">
            ← Back to shop
          </Link>
        </nav>

        <div className="grid lg:grid-cols-2 gap-12">
          <div className="flex flex-col gap-4">
            {images.length > 0 ? (
              <div className="relative aspect-square rounded-xl border border-border bg-surface overflow-hidden">
                <img
                  src={images[0].url}
                  alt={product.title}
                  className="w-full h-full object-cover"
                />
              </div>
            ) : (
              <div className="relative aspect-square rounded-xl border border-border bg-paper flex items-center justify-center">
                <span className="text-muted">No image available</span>
              </div>
            )}
            {images.slice(1).length > 0 && (
              <div className="grid grid-cols-4 gap-2">
                {images.slice(1, 5).map((img: any, idx: number) => (
                  <img
                    key={idx}
                    src={img.url}
                    alt={product.title}
                    className="w-full h-24 object-cover rounded-md border border-border hover:border-terracotta cursor-pointer transition-colors"
                  />
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-6">
            <div>
              <span className="text-xs font-medium text-terracotta uppercase tracking-wider">
                {product.category?.name || "Art"}
              </span>
              <h1 className="text-4xl md:text-5xl font-serif font-semibold text-ink tracking-tight">
                {product.title}
              </h1>
              {product.subtitle && (
                <p className="mt-2 text-lg text-muted font-sans">
                  {product.subtitle}
                </p>
              )}
            </div>

            <div className="border-y border-border py-4">
              <div className="flex items-baseline gap-4">
                <span className="text-3xl font-serif font-bold text-ink">
                  ₹{(price / 100).toLocaleString("en-IN")}
                </span>
                <span className="text-sm text-muted font-sans">
                  {product.currency_code ? product.currency_code : "INR"}
                </span>
              </div>
              <p className="mt-2 text-sm text-muted font-sans">
                {product.options?.find(
                  (o: any) => o.title === "Stock type"
                )?.values?.[0]?.value?.replace(/_/g, " ") ||
                  "Ready to ship"}
              </p>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-serif font-semibold text-ink">
                Description
              </h3>
              <p className="text-muted font-sans leading-relaxed">
                {product.description}
              </p>
            </div>

            {product.material && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-ink">Materials:</p>
                <p className="text-sm text-muted font-sans">
                  {product.material}
                </p>
              </div>
            )}

            <div className="pt-4 border-t border-border">
              <button
                className="w-full py-4 bg-terracotta text-white rounded-xl font-semibold hover:bg-terracotta/90 focus:outline-none focus:ring-2 focus:ring-terracotta focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:pointer-events-none"
              >
                Add to Cart
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
