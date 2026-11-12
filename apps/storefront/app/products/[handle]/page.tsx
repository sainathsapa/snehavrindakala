import {
  formatPrice,
  getProductPrice,
  getStockType,
  medusa,
} from "@/lib/medusa";
import { ProductOptions } from "@/components/product-options";
import { findCatalogueItem, type CatalogueItem } from "@/lib/catalogue";
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

export const metadata = async ({ params }: { params?: Promise<{ handle: string }> }) => {
  // Next 15 can call this from a client MetadataOutlet with no params; guard
  // rather than throwing and taking the route down.
  const handle = (await params)?.handle ?? "";
  if (!handle) return { title: "SnehaVrinda Kala" };
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
    // Not in Medusa. It may still be a seed-catalogue item — the listing pages
    // render those, so their links must resolve rather than 404.
    const seeded = await findCatalogueItem(handle);
    if (seeded) return <SeedProductPage item={seeded} />;
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

/**
 * Detail view for a seed-catalogue item.
 *
 * These have no Medusa variant and therefore cannot be added to a cart, so the
 * page shows the work honestly — image, price, maker, stock note — and points
 * at the ways you *can* buy: the live collection or a custom commission. It
 * never renders a dead "Add to cart" button.
 */
function SeedProductPage({ item }: { item: CatalogueItem }) {
  const stockLabel =
    item.stockType === "made_to_order"
      ? "Made to order"
      : item.stockType === "custom_only"
        ? "Commission only"
        : "Ready to ship";

  return (
    <main className="py-10">
      <div className="mx-auto max-w-[1400px] px-5 sm:px-8 lg:px-12">
        <nav
          aria-label="Breadcrumb"
          className="mb-8 flex items-center gap-2 font-sans text-xs text-muted-ink"
        >
          <Link href="/shop" className="hover:text-kumkum transition-colors">
            Shop
          </Link>
          <span aria-hidden="true">›</span>
          <span className="text-deep-ink">{item.title}</span>
        </nav>

        <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
          <div className="relative aspect-square overflow-hidden rounded-sm border border-sand-border bg-surface">
            <img
              src={item.image}
              alt={item.title}
              className="h-full w-full object-cover"
            />
          </div>

          <div className="flex flex-col gap-6">
            <div>
              {item.collection && (
                <span className="font-sans text-[11px] font-semibold uppercase tracking-[0.22em] text-terracotta">
                  {item.collection}
                </span>
              )}
              <h1 className="mt-2 font-serif text-4xl font-semibold tracking-tight text-deep-ink sm:text-5xl">
                {item.title}
              </h1>
              <p className="mt-2 font-sans text-sm text-muted-ink">
                by {item.artist}
              </p>
            </div>

            <div className="border-y border-sand-border py-4">
              <div className="flex items-baseline gap-3">
                <span className="font-serif text-3xl font-semibold text-deep-ink">
                  {formatPrice(item.price)}
                </span>
                <span className="font-sans text-xs uppercase tracking-wider text-muted-ink">
                  {stockLabel}
                </span>
              </div>
            </div>

            {item.seeded && (
              <div className="rounded-sm border border-sand-border bg-surface p-5">
                <p className="font-sans text-sm leading-relaxed text-muted-ink">
                  This piece is shown from our sample catalogue and is not yet
                  orderable online. To buy or commission something like it,
                  browse the live collection or send us a brief.
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <Link
                    href="/shop"
                    className="rounded-full bg-kumkum px-5 py-2.5 font-sans text-sm font-medium text-rang-paper transition-colors hover:bg-sindoor"
                  >
                    Browse the collection
                  </Link>
                  <Link
                    href="/custom-art"
                    className="rounded-full border border-kumkum px-5 py-2.5 font-sans text-sm font-medium text-kumkum transition-colors hover:bg-kumkum hover:text-rang-paper"
                  >
                    Request custom art
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
