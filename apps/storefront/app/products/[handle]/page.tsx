import {
  formatPrice,
  getProductPrice,
  getStockType,
  medusa,
} from "@/lib/medusa";
import { ProductOptions } from "@/components/product-options";
import Link from "next/link";
import { notFound } from "next/navigation";
import { slugify } from "@/lib/slugs";

export const dynamic = "force-dynamic";

export async function generateStaticParams() {
  try {
    const products = await medusa.listAllProducts({ limit: 500 });
    return products.map((p) => ({ handle: p.handle }));
  } catch {
    return [];
  }
}

export const metadata = async ({ params }: { params: Promise<{ handle: string }> }) => {
  const { handle } = await params;
  let product: Awaited<ReturnType<typeof medusa.getProduct>>["product"] | null = null;
  try {
    const { product: prod } = await medusa.getProduct(handle);
    product = prod;
  } catch {
    // handled in component
  }
  if (!product) return { title: "Product not found" };
  const price = getProductPrice(product);
  const currency = (product.variants?.[0]?.calculated_price?.currency_code || "inr").toUpperCase();
  return {
    title: `${product.title} | SnehaVrinda Kala`,
    description:
      product.description ||
      `${product.title} — ${formatPrice(price, currency)} by SnehaVrinda Kala.`,
    alternates: {
      canonical: `/products/${product.handle}`,
    },
    openGraph: {
      title: product.title,
      description: product.description || undefined,
      type: "product",
      url: `/products/${product.handle}`,
      images: product.images
        ? product.images.map((i) => ({ url: i.url }))
        : [],
    },
    twitter: {
      card: "summary_large_image",
      title: product.title,
      description: product.description || undefined,
      images: product.images
        ? product.images.map((i) => i.url)
        : [],
    },
    price: price != null ? (price / 100).toString() : undefined,
    priceCurrency: currency,
  };
};

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
      <script
        id="schema-product"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Product",
            name: product.title,
            description:
              product.description ||
              `${product.title} — available on SnehaVrinda Kala.`,
            image: product.images
              ? product.images.map((i) => i.url).filter(Boolean)
              : [],
            brand: { "@type": "Brand", name: "SnehaVrinda Kala" },
            sku: product.handle,
            offers: {
              "@type": "Offer",
              url: `${process.env.NEXT_PUBLIC_STOREFRONT_URL ||
                "http://localhost:3000"}/products/${product.handle}`,
              priceCurrency: (currency || "INR").toUpperCase(),
              price:
                price != null
                  ? (price / 100).toString()
                  : undefined,
              availability:
                stockType === "made_to_order"
                  ? "https://schema.org/PreOrder"
                  : "https://schema.org/InStock",
            },
          }),
        }}
      />
      <script
        id="schema-breadcrumb"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              {
                "@type": "ListItem",
                position: 1,
                name: "Home",
                item: `${process.env.NEXT_PUBLIC_STOREFRONT_URL ||
                  "http://localhost:3000"}`,
              },
              {
                "@type": "ListItem",
                position: 2,
                name: "Shop",
                item: `${process.env.NEXT_PUBLIC_STOREFRONT_URL ||
                  "http://localhost:3000"}/shop`,
              },
              {
                "@type": "ListItem",
                position: 3,
                name: product.category?.name || "Art",
                item: `${process.env.NEXT_PUBLIC_STOREFRONT_URL ||
                  "http://localhost:3000"}/shop/${
                  product.category?.handle || slugify(
                    product.category?.name || "art"
                  )
                }`,
              },
              {
                "@type": "ListItem",
                position: 4,
                name: product.title,
                item: `${process.env.NEXT_PUBLIC_STOREFRONT_URL ||
                  "http://localhost:3000"}/products/${product.handle}`,
              },
            ],
          }),
        }}
      />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <nav className="mb-8 text-sm text-muted-ink font-sans">
          <Link href="/shop" className="hover:text-sindoor transition-colors">
            ← Back to shop
          </Link>
        </nav>

        <div className="grid lg:grid-cols-2 gap-12">
          <div className="flex flex-col gap-4">
            {images.length > 0 ? (
              <div className="relative aspect-square rounded-xl border border-sand-border bg-surface overflow-hidden">
                <img
                  src={images[0].url}
                  alt={product.title}
                  className="w-full h-full object-cover"
                />
              </div>
            ) : (
              <div className="relative aspect-square rounded-xl border border-sand-border bg-rang-paper flex items-center justify-center">
                <span className="text-muted-ink">No image available</span>
              </div>
            )}
            {images.slice(1).length > 0 && (
              <div className="grid grid-cols-4 gap-2">
                {images.slice(1, 5).map((img, idx) => (
                  <img
                    key={img.id || idx}
                    src={img.url}
                    alt={product.title}
                    className="w-full h-24 object-cover rounded-md border border-sand-border hover:border-sindoor cursor-pointer transition-colors"
                  />
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-6">
            <div>
              <span className="text-xs font-medium text-sindoor uppercase tracking-wider">
                {product.category?.name || "Art"}
              </span>
              <h1 className="text-4xl md:text-5xl font-serif font-semibold text-deep-ink tracking-tight">
                {product.title}
              </h1>
              {product.subtitle && (
                <p className="mt-2 text-lg text-muted-ink font-sans">
                  {product.subtitle}
                </p>
              )}
            </div>

            <div className="border-y border-sand-border py-4">
              <div className="flex items-baseline gap-4">
                <span className="text-3xl font-serif font-bold text-deep-ink">
                  {formatPrice(price, currency)}
                </span>
                {price != null && (
                  <span className="text-sm text-muted-ink font-sans">{currency}</span>
                )}
              </div>
              <p className="mt-2 text-sm text-muted-ink font-sans capitalize">
                {stockType.replace(/_/g, " ")}
              </p>

              <ProductOptions
                variants={variants}
                price={price}
                currency={currency}
                stockType={stockType}
                isCustomOnly={isCustomOnly}
                handle={handle}
              />
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-serif font-semibold text-deep-ink">
                Description
              </h3>
              <p className="text-muted-ink font-sans leading-relaxed whitespace-pre-line">
                {product.description || "Details coming soon."}
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
