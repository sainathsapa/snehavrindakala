import {
  formatPrice,
  getProductPrice,
  getStockType,
  medusa,
} from "@/lib/medusa";
import { CornerFlourish } from "@/components/grounds";
import { localeAlternates } from "@/lib/seo";
import { getTranslations } from "next-intl/server";
import { ProductOptions } from "@/components/product-options";
import { ProductStory } from "@/components/product-story";
import { ProductGallery } from "@/components/product-gallery";
import { ArtworkSpecsPanel } from "@/components/artwork-specs-panel";
import { TrustStrip } from "@/components/trust-strip";
import { RelativeArtworks } from "@/components/relative-artworks";
import { WishlistButton } from "@/components/wishlist-button";
import { ProductReviews } from "@/components/product-reviews";
import { getCurrentCustomer } from "@/lib/auth";
import { RecentlyViewed, RecordRecentlyViewed } from "@/components/recently-viewed";
import {
  findCatalogueItem,
  resolveMedusaHandle,
  translatedProductTitle,
  translatedProductDescription,
  specsFromProduct,
  type CatalogueItem,
} from "@/lib/catalogue";
import Link from "next/link";
import { notFound } from "next/navigation";
import { slugify } from "@/lib/slugs";
import { getPlatformModeFromEnv } from "@/lib/settings";
import { getPreferredCurrency } from "@/lib/currency";

// Absolute origin for structured data. Schema.org requires fully-qualified
// URLs; a relative one silently invalidates the graph.
const SITE_ORIGIN = (
  process.env.NEXT_PUBLIC_STOREFRONT_URL || "http://localhost:3000"
).replace(/\/$/, "");

export const dynamic = "force-dynamic";

export async function generateStaticParams() {
  try {
    const products = await medusa.listAllProducts({ limit: 500 });
    return products.map((p) => ({ handle: p.handle }));
  } catch {
    return [];
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  // Next 15 can call this from a client MetadataOutlet with no params; guard
  // rather than throwing and taking the route down.
  const handle = (await params)?.handle ?? "";
  if (!handle) return { title: "SnehaVrinda Kala" };
  let product: Awaited<ReturnType<typeof medusa.getProduct>>["product"] | null = null;
  try {
    const { product: prod } = await medusa.getProduct(
      await resolveMedusaHandle(handle)
    );
    product = prod;
  } catch {
    // handled in component
  }
  if (!product) {
    // Seed-catalogue items are not in Medusa, and their pages render from the
    // catalogue — so their metadata must come from there too, otherwise every
    // seeded product shipped with the title "Product not found".
    const seeded = await findCatalogueItem(handle);
    if (!seeded) return { title: "Product not found" };
    return {
      title: `${seeded.title} by ${seeded.artist}`,
      description: `${seeded.title} — a handmade work by ${seeded.artist}${
        seeded.collection ? `, ${seeded.collection.toLowerCase()}` : ""
      }. ${seeded.price ? formatPrice(seeded.price) + ". " : ""}Original Indian artwork from SnehaVrinda Kala.`,
      alternates: localeAlternates(`/products/${seeded.handle}`),
      openGraph: {
        title: `${seeded.title} by ${seeded.artist}`,
        description: `Original handmade Indian artwork by ${seeded.artist}.`,
        images: seeded.image ? [seeded.image] : undefined,
        type: "article",
      },
    };
  }
  const price = getProductPrice(product);
  const currency = (product.variants?.[0]?.calculated_price?.currency_code || "inr").toUpperCase();
  // Metadata must use the same translated title the page body renders, or the
  // browser tab, search result and share card would show English over a Hindi
  // page. `catalogueTitle` falls back to the Medusa title when there is no
  // translation for this locale.
  const catalogueTitle = await translatedProductTitle(handle, product.title);
  return {
    // The root layout's title template appends "| SnehaVrinda Kala", so the
    // page title must not repeat the site name. When the product has no artist
    // metadata the fallback would read "... by SnehaVrinda Kala", which is both
    // wrong (the house is not the maker) and redundant — so fall back to the
    // product title alone.
    title: product.metadata?.artist
      ? `${catalogueTitle} by ${product.metadata.artist}`
      : catalogueTitle,
    description:
      product.description ||
      `${catalogueTitle} — ${formatPrice(price, currency)} by SnehaVrinda Kala.`,
    alternates: {
      canonical: `/products/${product.handle}`,
    },
    openGraph: {
      title: catalogueTitle,
      description: product.description || undefined,
      // Next's OpenGraph type union does not include "product". Passing it threw
      // "Invalid OpenGraph type: product" and took the whole product route down
      // in production. `article` is the closest supported value; the Product
      // semantics live in the JSON-LD block below.
      type: "article",
      url: `/products/${product.handle}`,
      images: product.images
        ? product.images.map((i) => ({ url: i.url }))
        : [],
    },
    twitter: {
      card: "summary_large_image",
      title: catalogueTitle,
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
  // The card may link to a handle we generated from the title (see lib/slug.ts)
  // rather than the one Medusa stores. Resolve it before querying, or every
  // product with a short opaque handle 404s from its own listing.
  const medusaHandle = await resolveMedusaHandle(handle);
  // The detail page fetches the product itself, so it has to name the visitor's
  // region too — otherwise the shop lists pounds and the product page shows
  // rupees, which reads as a pricing bug.
  const activeCurrency = await getPreferredCurrency();
  const regionId = await medusa.regionIdForCurrency(activeCurrency);

  let product: Awaited<ReturnType<typeof medusa.getProduct>>["product"];
  try {
    const { product: prod } = await medusa.getProduct(medusaHandle, regionId);
    product = prod;
  } catch {
    // Not in Medusa. The shop no longer renders a hardcoded sample catalogue, so
    // a miss here is a genuine 404 rather than a sample work to display.
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
  // The visible title, the JSON-LD name and the heading must all be the same
  // string; a Hindi page whose structured data said an English name would be
  // indexed under the wrong language.
  const catalogueTitle = await translatedProductTitle(
    product.handle ?? medusaHandle,
    product.title
  );

  // Decision-grade facts read from the product's tags (the only metadata
  // channel the store API exposes). Values that are absent simply do not
  // render, so the panel never shows invented dimensions or a guessed year.
  const specs = specsFromProduct(product, stockType);

  // The Hindi description when the translation pass has written one. Falls back
  // to Medusa's English rather than to an empty paragraph.
  const catalogueDescription =
    (await translatedProductDescription(product.handle ?? medusaHandle)) ??
    product.description ??
    null;
  const t = await getTranslations("productDetail");

  // Reviews are public (approved only). A backend hiccup must not take the
  // product page down, so a failed fetch renders an empty review section.
  const reviewData = await medusa
    .listReviews(product.id)
    .catch(() => null);
  const customer = await getCurrentCustomer().catch(() => null);

  return (
    <main className="relative overflow-hidden py-10">
      <CornerFlourish className="absolute -left-8 -top-8 hidden h-72 w-72 lg:block" />
      <script
        id="schema-product"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Product",
            name: catalogueTitle,
            description:
              product.description ||
              `${catalogueTitle} — available on SnehaVrinda Kala.`,
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
                name: catalogueTitle,
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
            ← {t("backToShop")}
          </Link>
        </nav>

        <div className="grid lg:grid-cols-2 gap-12">
          <div className="flex flex-col gap-4">
            <ProductGallery
              images={images.map((img: any, i: number) => ({
                id: img.id || String(i),
                url: img.url,
                alt: catalogueTitle,
              }))}
              title={catalogueTitle}
            />
          </div>

          <div className="flex flex-col gap-6">
            <div>
              <span className="text-xs font-medium text-sindoor uppercase tracking-wider">
                {product.category?.name || "Art"}
              </span>
              <h1 className="text-4xl md:text-5xl font-serif font-semibold text-deep-ink tracking-tight">
                {catalogueTitle}
              </h1>
              {product.subtitle && (
                <p className="mt-2 text-lg text-muted-ink font-sans">
                  {product.subtitle}
                </p>
              )}
              {String(product.metadata?.artist || "").trim() && (
                <p className="mt-2 font-sans text-sm italic text-muted-ink">
                  by {String(product.metadata?.artist)}
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
              {specs.dispatch && (
                <p className="mt-1 font-sans text-xs text-terracotta">
                  {specs.dispatch}
                </p>
              )}

              <ProductOptions
                variants={variants}
                price={price}
                currency={currency}
                stockType={stockType}
                isCustomOnly={isCustomOnly}
                handle={handle}
              />

              {!isCustomOnly && (
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <Link
                    href="/custom-art"
                    className="inline-flex items-center gap-1.5 font-sans text-sm text-terracotta transition-colors hover:text-kumkum"
                  >
                    Commission a similar piece
                    <span aria-hidden="true">→</span>
                  </Link>
                  <WishlistButton
                    handle={product.handle ?? medusaHandle}
                    title={catalogueTitle}
                    image={images[0]?.url}
                    price={price}
                    currency={currency}
                    artist={
                      typeof product.metadata?.artist === "string"
                        ? product.metadata.artist
                        : undefined
                    }
                  />
                </div>
              )}
            </div>

            <ArtworkSpecsPanel specs={specs} />

            <div className="border-t border-sand-border/60 pt-4">
              <TrustStrip />
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-serif font-semibold text-deep-ink">
                {t("description")}
              </h3>
              <p className="text-muted-ink font-sans leading-relaxed whitespace-pre-line">
                {catalogueDescription || "Details coming soon."}
              </p>
            </div>
          </div>
        </div>

        <ProductStory
          title={catalogueTitle}
          collection={product.category?.name || undefined}
          stockType={stockType}
        />

        {reviewData && (
          <ProductReviews
            productId={product.id}
            variantId={variantId}
            reviews={reviewData.reviews}
            summary={reviewData.summary}
            canReview={Boolean(customer?.id)}
          />
        )}

        <RelativeArtworks
          handle={product.handle ?? medusaHandle}
          collection={product.category?.name || undefined}
        />

        <RecentlyViewed excludeHandle={product.handle ?? medusaHandle} />
      </div>

      <RecordRecentlyViewed
        handle={product.handle ?? medusaHandle}
        title={catalogueTitle}
        image={images[0]?.url}
        price={price}
        currency={currency}
      />
    </main>
  );
}
