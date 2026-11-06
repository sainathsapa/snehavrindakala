import {
  formatPrice,
  getProductPrice,
  getStockType,
  medusa,
} from "@/lib/medusa";
import { AddToCart } from "@/components/add-to-cart";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  let product: Awaited<ReturnType<typeof medusa.getProduct>>["product"];
  try {
    const { product: prod } = await medusa.getProduct(handle);
    product = prod;
  } catch {
    notFound();
  }

  const variants = product.variants ?? [];
  const images = product.images ?? [];
  const price = getProductPrice(product);
  const stockType = getStockType(product);
  const isCustomOnly = stockType === "custom_only";
  const variantId = variants[0]?.id;
  const currency = (product.variants?.[0]?.calculated_price?.currency_code ||
    "inr").toUpperCase();

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
                {images.slice(1, 5).map((img, idx) => (
                  <img
                    key={img.id || idx}
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
                  {formatPrice(price, currency)}
                </span>
                {price != null && (
                  <span className="text-sm text-muted font-sans">{currency}</span>
                )}
              </div>
              <p className="mt-2 text-sm text-muted font-sans capitalize">
                {stockType.replace(/_/g, " ")}
              </p>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-serif font-semibold text-ink">
                Description
              </h3>
              <p className="text-muted font-sans leading-relaxed whitespace-pre-line">
                {product.description || "Details coming soon."}
              </p>
            </div>

            <div className="pt-4 border-t border-border">
              <AddToCart
                variantId={variantId}
                disabled={isCustomOnly || !variantId}
                disabledReason={
                  isCustomOnly
                    ? "This piece is made to order through our commission process."
                    : "This product is not available for online purchase yet."
                }
              />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
