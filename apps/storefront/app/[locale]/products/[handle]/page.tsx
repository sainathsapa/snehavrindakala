import {
  formatPrice,
  getProductPrice,
  getStockType,
  medusa,
} from "@/lib/medusa";
import { localeAlternates } from "@/lib/seo";
import { getTranslations } from "next-intl/server";
import { ProductOptions } from "@/components/product-options";
import { ProductStory } from "@/components/product-story";
import { ProductGallery } from "@/components/product-gallery";
import { ArtworkSpecsPanel } from "@/components/artwork-specs-panel";
import { ArtworkRecord } from "@/components/artwork-record";
import { TrustStrip } from "@/components/trust-strip";
import { RelativeArtworks } from "@/components/relative-artworks";
import { WishlistButton } from "@/components/wishlist-button";
import { ProductReviews } from "@/components/product-reviews";
import { MobileBuyBar } from "@/components/mobile-buy-bar";
import { getCurrentCustomer } from "@/lib/auth";
import { RecentlyViewed, RecordRecentlyViewed } from "@/components/recently-viewed";
import {
  findCatalogueItem,
  resolveMedusaHandle,
  translatedProductTitle,
  translatedProductDescription,
  specsFromProduct,
  artistFromProduct,
} from "@/lib/catalogue";
import { Link } from "@/i18n/routing";
import { notFound } from "next/navigation";
import { slugify } from "@/lib/slugs";
import { artFormSlugs } from "@/lib/slugs";
import { getPreferredCurrency } from "@/lib/currency";
import { getPlatformModeFromEnv } from "@/lib/settings";
import { listArtForms, translateArtForms } from "@/lib/site-content";

/** Normalise a title so "Madhubani Fish and Lotus" contains "madhubani". */
const collectionKeyForTitle = (value: string) =>
  value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

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
    const { product: prod } = await medusa.getProduct(await resolveMedusaHandle(handle));
    product = prod;
  } catch {
    // handled in component
  }
  if (!product) {
    // Seeded items render from the catalogue, so their metadata must come from
    // there too, otherwise every seeded product shipped the title "Product not
    // found".
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
  // page.
  const catalogueTitle = await translatedProductTitle(handle, product.title);
  return {
    title: artistFromProduct(product)
      ? `${catalogueTitle} by ${artistFromProduct(product)}`
      : catalogueTitle,
    description:
      product.description ||
      `${catalogueTitle} — ${formatPrice(price, currency)} by SnehaVrinda Kala.`,
    alternates: { canonical: `/products/${product.handle}` },
    openGraph: {
      title: catalogueTitle,
      description: product.description || undefined,
      // Next's OpenGraph type union does not include "product". Passing it threw
      // "Invalid OpenGraph type: product" and took the whole route down.
      type: "article",
      url: `/products/${product.handle}`,
      images: product.images ? product.images.map((i) => ({ url: i.url })) : [],
    },
    twitter: {
      card: "summary_large_image",
      title: catalogueTitle,
      description: product.description || undefined,
      images: product.images ? product.images.map((i) => i.url) : [],
    },
    price: price != null ? (price / 100).toString() : undefined,
    priceCurrency: currency,
  };
}

/**
 * The artwork page.
 *
 * Composition, top to bottom — the order a visitor actually reads it:
 *
 *   breadcrumb → the work (gallery) → what it is (title, art form, artist)
 *   → what it costs and whether it is available → the facts (specs)
 *   → how to buy it → why to trust it → the story → reviews → siblings
 *
 * Two deliberate departures from the previous layout:
 *
 *  1. **The gallery is a column, not a square.** It keeps a sticky stage on wide
 *     screens so the artwork stays in view while a long column of information
 *     scrolls — the way a gallery wall label sits beside the work.
 *
 *  2. **No card stack.** The right column is typography, whitespace and
 *     hairlines. Borders around the price, the specs, the trust strip and the
 *     description made four boxes competing for the same attention, which is the
 *     opposite of editorial.
 */
export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ handle: string; locale: string }>;
}) {
  const { handle, locale } = await params;
  // The card may link to a handle we generated from the title rather than the
  // one Medusa stores. Resolve it before querying.
  const medusaHandle = await resolveMedusaHandle(handle);
  const activeCurrency = await getPreferredCurrency();
  const regionId = await medusa.regionIdForCurrency(activeCurrency);

  let product: Awaited<ReturnType<typeof medusa.getProduct>>["product"];
  try {
    const { product: prod } = await medusa.getProduct(medusaHandle, regionId);
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
  const currency = (product.variants?.[0]?.calculated_price?.currency_code || "inr").toUpperCase();
  const catalogueTitle = await translatedProductTitle(
    product.handle ?? medusaHandle,
    product.title
  );
  const specs = specsFromProduct(product, stockType);
  const catalogueDescription =
    (await translatedProductDescription(product.handle ?? medusaHandle)) ??
    product.description ??
    null;
  const t = await getTranslations("productDetail");
  const artFormMessages = await getTranslations("artForm");

  const reviewData = await medusa.listReviews(product.id).catch(() => null);
  const customer = await getCurrentCustomer().catch(() => null);

  // Tags are the channel the store API actually returns; `metadata.artist` alone
  // left the maker blank on every product page.
  const artist = artistFromProduct(product);
  const artForm = product.category?.name || "Art";

  // The tradition behind this work.
  //
  // Products are filed under Medusa categories (`painting-drawing`) while the
  // editorial art-form pages use shorter slugs (`painting`), so the two
  // taxonomies cannot be joined on slug — doing that silently matched nothing
  // and left the record with no description and no region. The category *name*
  // is the one field both actually agree on.
  //
  // The lookup is fetched in English and localised afterwards on purpose: the
  // category name is always English, so joining on a localised list broke the
  // match on the Hindi pages and dropped the whole tradition row there.
  const categoryName = product.category?.name;
  const normalise = (v: string) => v.toLowerCase().replace(/[^a-z0-9]/g, "");
  const traditionRecord = categoryName
    ? (await Promise.all([
        listArtForms("en").catch(() => []),
        listArtForms(locale).catch(() => []),
      ]).then(([en, localised]) => {
        const match = en.find(
          (f) => normalise(f.name) === normalise(categoryName)
        );
        // Return the localised twin of the matched row, so the name is
        // translated while the match itself stays locale-independent.
        return localised.find((f) => f.slug === match?.slug) ?? match;
      }))
    : undefined;

  // Link to whichever slug the tradition page actually serves. Falling back to
  // the category handle produced a 404 (/art-forms/painting-drawing).
  const traditionSlug = traditionRecord?.slug;

  // A work can belong to a named tradition rather than only to a broad category.
  //
  // "Madhubani Fish and Lotus" sits in "Traditional & Folk Art", a category that
  // mixes three traditions and therefore cannot carry one honest origin. When the
  // work's own title names a tradition the storefront knows, that tradition is the
  // better record: it has a real place, and its page shows only the works that
  // actually belong to it. The category remains the fallback.
  const titledTradition = artFormSlugs.find(
    (f) =>
      f.origin &&
      collectionKeyForTitle(product.title ?? "").includes(f.slug)
  );

  // The tradition's description is translated the same way /art-forms does it.
  //
  // The database column holds English only; the Hindi copy lives in the message
  // files under `artForm.descriptions.<slug>`. Reading the row directly, as this
  // page did, showed English prose beside Hindi labels on every /hi product
  // page while the art-form index showed Hindi correctly — the two surfaces
  // disagreed about the same sentence.
  const traditionCopy = traditionRecord
    ? translateArtForms(
        [traditionRecord],
        (key: string) => artFormMessages(key),
        (key: string) => artFormMessages.has(key)
      )[0]
    : undefined;

  // Where a maker link should go depends on the mode.
  //
  // /makers is single-brand only and 404s in platform mode; /artists is the
  // reverse. Linking unconditionally to /makers#slug therefore broke every
  // product page in platform mode — a 404 behind the maker's name on all of
  // them. Each mode gets the directory it actually serves.
  const platformMode = getPlatformModeFromEnv() === "platform";
  let makerHref: string | undefined;
  if (artist) {
    if (!platformMode) {
      makerHref = `/makers#${slugify(artist)}`;
    } else {
      // Artists carry a real slug from the artists module, which is not always
      // slugify(name); look it up rather than guessing one that 404s.
      const bySlug = await medusa
        .listArtists({ limit: 100 })
        .then(({ artists }) =>
          artists?.find((a) => a.display_name === artist)
        )
        .catch(() => undefined);
      makerHref = bySlug?.slug
        ? `/artists/${bySlug.slug}`
        : "/artists";
    }
  }

  const availability =
    stockType === "ready_to_ship"
      ? t("availability.ready")
      : stockType === "custom_only"
        ? t("availability.commission")
        : stockType === "made_to_order"
          ? t("availability.madeToOrder")
          : t("availability.enquire");

  const inStock =
    variants[0]?.inventory_quantity == null || (variants[0]?.inventory_quantity ?? 0) > 0;

  const productUrl = `${SITE_ORIGIN}/products/${product.handle}`;

  return (
    <main className="pb-32 lg:pb-20">
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
              url: productUrl,
              priceCurrency: (currency || "INR").toUpperCase(),
              price: price != null ? (price / 100).toString() : undefined,
              availability:
                stockType === "made_to_order"
                  ? "https://schema.org/PreOrder"
                  : "https://schema.org/InStock",
            },
          }),
        }}
      />
      {/* VisualArtwork alongside Product.

          A Product record answers "what does it cost and is it in stock". It
          cannot say what the object *is* — a painting on cloth, a woven stole,
          a silver inlay box. `VisualArtwork` carries exactly those facts, which
          is what makes a one-of-one work findable as art rather than as a
          generic retail item.

          Every field is conditional. `specs` is built from real catalogue
          metadata, and a product that has not been tagged yet simply omits the
          property — a schema missing `artMedium` is honest; one with an invented
          medium is a lie to a crawler and to a buyer. */}
      <script
        id="schema-visual-artwork"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "VisualArtwork",
            name: catalogueTitle,
            url: productUrl,
            ...(product.description ? { description: product.description } : {}),
            ...(artist ? { creator: { "@type": "Person", name: artist } } : {}),
            ...(product.images?.length
              ? { image: product.images.map((i) => i.url).filter(Boolean) }
              : {}),
            ...(specs.medium ? { artMedium: specs.medium } : {}),
            ...(specs.dimensions ? { size: specs.dimensions } : {}),
            ...(specs.year ? { dateCreated: specs.year } : {}),
            ...(specs.edition ? { artEdition: specs.edition } : {}),
            artform: artForm,
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
              { "@type": "ListItem", position: 1, name: "Home", item: SITE_ORIGIN },
              { "@type": "ListItem", position: 2, name: "Shop", item: `${SITE_ORIGIN}/shop` },
              {
                "@type": "ListItem",
                position: 3,
                name: artForm,
                item: `${SITE_ORIGIN}/shop/${product.category?.handle || slugify(artForm)}`,
              },
              { "@type": "ListItem", position: 4, name: catalogueTitle, item: productUrl },
            ],
          }),
        }}
      />

      {/* ── Breadcrumb ────────────────────────────────────────────────── */}
      <div className="mx-auto max-w-[1400px] px-4 pt-6 sm:px-6 lg:px-10">
        <nav aria-label="Breadcrumb" className="font-sans text-[12.5px] text-muted-ink">
          <ol className="flex flex-wrap items-center gap-1.5">
            <li>
              <Link href="/" className="transition-colors hover:text-sindoor">
                {t("home")}
              </Link>
            </li>
            <li aria-hidden="true" className="text-sand-border">/</li>
            <li>
              <Link href="/shop" className="transition-colors hover:text-sindoor">
                {t("backToShop")}
              </Link>
            </li>
            {product.category?.name && (
              <>
                <li aria-hidden="true" className="text-sand-border">/</li>
                <li>
                  <Link
                    href={`/shop/${product.category.handle || slugify(product.category.name)}`}
                    className="transition-colors hover:text-sindoor"
                  >
                    {product.category.name}
                  </Link>
                </li>
              </>
            )}
            <li aria-hidden="true" className="text-sand-border">/</li>
            <li aria-current="page" className="max-w-[16rem] truncate text-deep-ink">
              {catalogueTitle}
            </li>
          </ol>
        </nav>
      </div>

      {/* ── The work and everything about it ──────────────────────────── */}
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-10">
        <div className="mt-6 grid items-start gap-8 lg:mt-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-16">
          {/* Gallery — sticky on desktop so the artwork stays beside its label. */}
          <div className="lg:sticky lg:top-24">
            <ProductGallery
              images={images.map((img: any, index: number) => ({
                id: img.id || String(index),
                url: img.url,
                alt: catalogueTitle,
              }))}
              title={catalogueTitle}
            />

            {/* Provisional imagery.

                Sixteen works carry an AI-generated image that shows a plausible
                piece of its kind, not the object being sold. Saying so once, under
                the gallery, is the difference between a catalogue that is being
                finished and one that overstates.

                Keyed on the filename, so it retires itself: replace the file with
                a real photograph and this line disappears with no code change.

                The thumbnail is checked as well as the gallery images. One work
                has a generated thumbnail but no image row at all, so testing only
                the gallery left its page silently unlabelled. */}
            {[
              ...(images as { url?: string }[]).map((img) => img?.url),
              (product as { thumbnail?: string }).thumbnail,
            ].some((url) => url?.includes("/generated-")) && (
              <p className="mt-3 font-sans text-[11px] leading-relaxed text-muted-ink">
                {t("representativeImage")}
              </p>
            )}
          </div>

          {/* The label. */}
          <div className="flex flex-col gap-7 lg:pt-2">
            {/* 1 — What it is */}
            <div>
              <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.26em] text-terracotta">
                {artForm}
              </p>
              <h1 className="mt-2.5 font-serif text-3xl font-semibold leading-[1.12] tracking-tight text-deep-ink sm:text-4xl lg:text-[2.75rem]">
                {catalogueTitle}
              </h1>
              {product.subtitle && (
                <p className="mt-3 font-serif text-lg italic leading-relaxed text-muted-ink">
                  {product.subtitle}
                </p>
              )}
              {artist && (
                <p className="mt-3 font-sans text-sm text-deep-ink/80">
                  <span className="text-muted-ink">{t("artistLabel")} · </span>
                  {artist}
                </p>
              )}
            </div>

            {/* 2 — What it costs, and whether you can have it */}
            <div className="border-y border-sand-border/60 py-5">
              <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                <span className="font-serif text-3xl font-semibold text-deep-ink sm:text-4xl">
                  {formatPrice(price, currency)}
                </span>
                <span className="font-sans text-xs uppercase tracking-[0.12em] text-muted-ink">
                  {currency.toUpperCase()}
                </span>
              </div>

              <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 font-sans text-[13px]">
                <span
                  className={`inline-flex items-center gap-1.5 ${
                    inStock && !isCustomOnly ? "text-leaf" : "text-terracotta"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`h-1.5 w-1.5 rounded-full ${
                      inStock && !isCustomOnly ? "bg-leaf" : "bg-terracotta"
                    }`}
                  />
                  {availability}
                </span>
                {specs.dispatch && (
                  <>
                    <span aria-hidden="true" className="text-sand-border">·</span>
                    <span className="text-muted-ink">{specs.dispatch}</span>
                  </>
                )}
              </div>
            </div>

            {/* 3 — How to buy it. One primary action. */}
            <ProductOptions
              variants={variants}
              price={price}
              currency={currency}
              stockType={stockType}
              isCustomOnly={isCustomOnly}
              handle={handle}
            />

            {/* Secondary actions, quieter by design. */}
            {!isCustomOnly && (
              <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
                <WishlistButton
                  handle={product.handle ?? medusaHandle}
                  title={catalogueTitle}
                  image={images[0]?.url}
                  price={price}
                  currency={currency}
                  artist={artist}
                />
                <span aria-hidden="true" className="text-sand-border">·</span>
                <Link
                  href="/custom-art"
                  className="font-sans text-sm text-terracotta underline-offset-4 transition-colors hover:text-kumkum hover:underline"
                >
                  {t("commissionSecondary")} →
                </Link>
              </div>
            )}

            {/* 4 — The facts, in the open. Not behind a tab. */}
            {Object.keys(specs).length > 0 && (
              <ArtworkSpecsPanel specs={specs} title={t("details")} />
            )}

            {/* 4b — Where the work comes from and whose hand made it. The spec
                panel above answers "how big, made of what"; this answers the
                next question an art buyer asks, and links onward to both the
                tradition and the maker. Rows appear only where the record has
                something real to say. */}
            <ArtworkRecord
              tradition={
                // Prefer the tradition record's own name: it is already localised
                // by listArtForms, whereas the category name is English only.
                titledTradition?.name ||
                traditionRecord?.name ||
                product.category?.name ||
                undefined
              }
              traditionDescription={
                // The named tradition's own line wins. Falling through to the
                // category description put textile copy under "Kalamkari" and
                // painting copy under "Gond", because those works sit inside
                // broader categories that describe something else.
                titledTradition?.description ||
                traditionCopy?.description ||
                undefined
              }
              traditionHref={
                titledTradition
                  ? `/art-forms/${titledTradition.slug}`
                  : traditionSlug
                    ? `/art-forms/${traditionSlug}`
                    : undefined
              }
              origin={
                // Only the tradition's own place, never the category's: a mixed
                // category has no single region to state.
                titledTradition?.origin || undefined
              }
              maker={artist}
              makerHref={makerHref}
              title={t("theRecord")}
              labels={{
                tradition: t("recordTradition"),
                region: t("recordRegion"),
                maker: t("recordMaker"),
              }}
            />

            {/* 5 — Why to trust the purchase, right next to the decision. */}
            <div className="border-t border-sand-border/60 pt-5">
              <p className="mb-3 font-sans text-[11px] uppercase tracking-[0.18em] text-muted-ink">
                {t("shippingNote")}
              </p>
              <TrustStrip />
            </div>

            {/* 6 — The prose description, where a buyer expects it. */}
            {catalogueDescription && (
              <div className="space-y-3 border-t border-sand-border/60 pt-5">
                <h2 className="font-sans text-[11px] font-semibold uppercase tracking-[0.22em] text-terracotta">
                  {t("description")}
                </h2>
                <p className="whitespace-pre-line font-sans text-[15px] leading-[1.75] text-muted-ink">
                  {catalogueDescription}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ── Below the fold: the story, then the social proof ─────────── */}
        <ProductStory
          title={catalogueTitle}
          artist={artist}
          collection={product.category?.name || undefined}
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

      <MobileBuyBar
        variantId={variantId}
        price={price}
        currency={currency}
        isCustomOnly={isCustomOnly}
        inStock={inStock}
        title={catalogueTitle}
      />
    </main>
  );
}
