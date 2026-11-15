import { unstable_cache } from "next/cache";
import { medusa } from "@/lib/medusa";
import { getPreferredCurrency } from "@/lib/currency";
import { getLocale } from "next-intl/server";
import {
  productTranslationsFor,
  categoryTranslationsFor,
} from "@/lib/site-content";
import { productSlug, isOpaqueHandle } from "@/lib/slug";

/**
 * The single read path for catalogue listings.
 *
 * Products come from Medusa and nowhere else. There used to be a hardcoded
 * sample catalogue in `data/products.ts` that rendered whenever the backend was
 * light: those works looked real on /shop but could not be edited, priced or
 * deleted from the admin panel, and their links broke whenever a handle
 * changed. Anything sellable now has to be a product created through the admin.
 */

export interface CatalogueItem {
  handle: string;
  title: string;
  artist: string;
  price: number | null;
  /** ISO currency the price is expressed in, so it formats correctly. */
  currency: string;
  stockType: string;
  image: string;
  isNew: boolean;
  /** Art-form slugs this item belongs to (matched against taxonomy slugs). */
  artForms: string[];
  /** Human-readable collection name, for grouping and breadcrumbs. */
  collection: string;
  /** True when the item came from the seed file rather than Medusa. */
  seeded: boolean;
  /** Factual, decision-grade attributes for the product page. */
  specs: ArtworkSpecs;
}

/**
 * The facts a buyer needs before committing to a one-of-one purchase.
 *
 * Every field is optional because the store API exposes metadata only via tags,
 * and not every product has been tagged yet. The UI renders only the rows that
 * carry a real value — it never invents a dimension or a year to fill a grid.
 */
export interface ArtworkSpecs {
  dimensions?: string;
  medium?: string;
  framing?: string;
  year?: string;
  edition?: string;
  /** Human phrasing, e.g. "Ships in 3–5 days". */
  dispatch?: string;
  care?: string;
}

const STOCK_TYPES = new Set(["ready_to_ship", "made_to_order", "custom_only"]);

/** Normalise a collection name to a comparable key. */
function collectionKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Map a seed product's `collection` name onto the art-form taxonomy.
 * The seed file stores display names ("Traditional & Folk Art") while the
 * taxonomy is keyed by short slugs ("folk"), so both sides are normalised.
 */
/**
 * Explicit maps between the short taxonomy slugs and the display names used by
 * the seed catalogue and by seeded Medusa categories.
 *
 * Guessing by substring was wrong in both directions: "painting" never matched
 * "Painting & Drawing" (it is a keyword in the seed data, not the collection),
 * and "home-decor" never matched "Home & Decorative Art". A list beats
 * inference for a fixed six-item taxonomy.
 */
const SEED_COLLECTION_TO_SLUG: Record<string, string> = {
  "painting-and-drawing": "painting",
  "traditional-and-folk-art": "folk",
  "folk-art": "folk",
  "home-and-decorative-art": "home-decor",
  "textile-and-fibre-art": "textile",
  "paper-stationery-and-books": "paper",
  "wearable-art": "wearable",
  "personalized-and-commissioned": "painting",
};


/**
 * Read `prefix:value` out of a Medusa product's tags.
 *
 * The store API does not expose `metadata`, so tags are the only channel the
 * storefront can actually read back. Writing the maker to metadata alone looked
 * correct and silently did nothing.
 */
function tagValue(product: any, prefix: string): string | undefined {
  const tags: any[] = product?.tags ?? [];
  for (const tag of tags) {
    const value = typeof tag === "string" ? tag : tag?.value;
    if (typeof value === "string" && value.startsWith(`${prefix}:`)) {
      return value.slice(prefix.length + 1);
    }
  }
  return undefined;
}

/**
 * The maker's name, whichever channel it arrived on.
 *
 * The store API exposes tags but not metadata, so the seed and the admin both
 * write the artist as the tag `artist:<name>`. Reading `metadata.artist` alone
 * was silently blank for every product — the product page showed no maker at
 * all, which is a strange thing for an art house to omit. Both channels are
 * checked, tag first, because that is the one the storefront can actually read.
 */
export function artistFromProduct(product: any): string | undefined {
  const fromTag = tagValue(product, "artist");
  if (fromTag?.trim()) return fromTag.trim();
  const fromMetadata = product?.metadata?.artist;
  if (typeof fromMetadata === "string" && fromMetadata.trim()) {
    return fromMetadata.trim();
  }
  return undefined;
}

/**
 * Read the decision-grade facts a product page needs.
 *
 * The store API returns tags but not metadata, so each attribute is written as
 * `key:value` — the same channel the maker and availability already use. Tags
 * are matched case-insensitively. Without a value there is simply no row; the
 * UI never fills the gap with a guess.
 *
 * `dispatch` falls back to a stock-type phrase (a ready-to-ship work has a
 * genuinely different lead time from a made-to-order one), which is truthful
 * for every product rather than a made-up date.
 *
 * The fallback states only the *timing*, never the availability: the product page
 * already prints "Ready to ship" as a status pill one line above, and repeating
 * it here read as the page stuttering. A tag written by the admin is used
 * verbatim, because the operator wrote it deliberately.
 */
export function specsFromProduct(product: any, stockType: string): ArtworkSpecs {
  const tag = (key: string) =>
    tagValue(product, key) ?? tagValue(product, key.toLowerCase());

  const dispatchTag = tag("dispatch");
  const dispatch =
    dispatchTag ??
    (stockType === "made_to_order"
      ? "Usually ships in 2–3 weeks"
      : stockType === "custom_only"
        ? "Timeline confirmed with your quote"
        : "Usually dispatches in 2–4 business days");

  const specs: ArtworkSpecs = {
    dimensions: tag("dimensions"),
    medium: tag("medium"),
    framing: tag("framing"),
    year: tag("year"),
    edition: tag("edition"),
    dispatch,
    care: tag("care"),
  };

  // Drop empty fields so callers can test presence cheaply.
  return Object.fromEntries(
    Object.entries(specs).filter(([, v]) => Boolean(v && v.trim()))
  ) as ArtworkSpecs;
}

function liveToItem(product: any): CatalogueItem {
  const variant = product.variants?.[0];
  const price =
    typeof variant?.calculated_price?.calculated_amount === "number"
      ? variant.calculated_price.calculated_amount
      : typeof variant?.prices?.[0]?.amount === "number"
        ? variant.prices[0].amount
        : null;

  const categories = product.categories ?? [];
  const inventory = variant?.inventory_quantity;
  const stockType =
    tagValue(product, "stock") ??
    (product.metadata?.stock_type as string) ??
    (inventory === 0 ? "made_to_order" : "ready_to_ship");

  return {
    // Prefer the handle Medusa assigned. If it is opaque (`003`, a UUID) the
    // product URL would be unreadable and keyword-less, so derive one from the
    // title. Existing handles are never rewritten — that would break links and
    // any ranking already earned.
    handle: isOpaqueHandle(product.handle)
      ? productSlug({
          title: product.title ?? "artwork",
          artist: product.metadata?.artist as string | undefined,
          artForm: categories[0]?.name,
        })
      : product.handle,
    title: product.title,
    artist:
      tagValue(product, "artist") ??
      (product.metadata?.artist as string | undefined) ??
      "Sneha Sainath Sapa",
    price,
    currency:
      variant?.calculated_price?.currency_code ||
      variant?.prices?.[0]?.currency_code ||
      "inr",
    stockType: STOCK_TYPES.has(stockType) ? stockType : "ready_to_ship",
    image: product.thumbnail || product.images?.[0]?.url || "/images/products/madhubani-painting.jpg",
    isNew: Boolean(product.metadata?.is_new),
    artForms: categories.flatMap((category: any) => {
      const handle = collectionKey(category.handle ?? "");
      const name = collectionKey(category.name ?? "");
      return [handle, name, SEED_COLLECTION_TO_SLUG[handle] ?? "", SEED_COLLECTION_TO_SLUG[name] ?? ""];
    }),
    collection: categories[0]?.name ?? "",
    seeded: false,
    specs: specsFromProduct(product, stockType),
  };
}

async function loadCatalogueFor(currency: string, locale = "en"): Promise<CatalogueItem[]> {
  let live: CatalogueItem[] = [];
  try {
    // Prices are calculated per region, so the request has to name the region
    // matching the visitor's currency. Without it every price comes back in the
    // store default and the currency switcher changes nothing.
    const regionId = await medusa.regionIdForCurrency(currency);
    const { products } = await medusa.listProducts({ limit: 100, regionId });
    live = (products ?? []).map(liveToItem);
  } catch (err) {
    // An empty shop is the honest result when the backend is unreachable. The
    // old sample catalogue would have rendered instead, showing works that do
    // not exist and cannot be managed from the admin panel.
    console.error("Failed to load products from Medusa", err);
  }

  // Swap in translated titles where one exists. English needs no lookup: the
  // Medusa title is already the English title.
  if (locale !== "en" && live.length > 0) {
    const [translations, categoryNames] = await Promise.all([
      productTranslationsFor(locale),
      categoryTranslationsFor(locale),
    ]);

    live = live.map((item) => {
      const translated = translations.get(item.handle);
      // A category handle gives the translated category name wherever this
      // item's collection is shown (cards, filters, breadcrumbs).
      const categoryHandle = (item.artForms ?? []).find((value) =>
        categoryNames.has(value)
      );
      return {
        ...item,
        ...(translated ? { title: translated.title } : {}),
        ...(categoryHandle
          ? { collection: categoryNames.get(categoryHandle) as string }
          : {}),
      };
    });
  }

  return live;
}

/**
 * Cache one catalogue per currency **and locale**.
 *
 * The cache key includes the currency because the same product has a different
 * calculated price in each one, and it includes the locale because a translated
 * title differs too. A key missing either would serve whichever variant
 * happened to render first to everyone that followed — the Hindi shop page
 * showing English titles, or rupee prices under a dollar label.
 */
const cachedCatalogue = (currency: string, locale: string) =>
  unstable_cache(
    () => loadCatalogueFor(currency, locale),
    ["catalogue", currency, locale],
    { revalidate: 60, tags: ["catalogue"] }
  )();

/**
 * Every catalogue item, straight from Medusa, priced in the visitor's currency.
 *
 * Cached for a short window: the root layout builds the nav menus from this on
 * every request, and an uncached Medusa call there would make every page in the
 * app dynamic. A minute of staleness on a nav menu is invisible; making the
 * whole site dynamic is not.
 */
export async function listCatalogue(
  currency?: string,
  locale?: string
): Promise<CatalogueItem[]> {
  const code = currency ?? (await getPreferredCurrency());
  return cachedCatalogue(code, locale ?? (await localeFromRequest()));
}

/**
 * Catalogue items belonging to one art form.
 *
 * `keys` may contain a taxonomy slug ("folk"), a Medusa handle ("folk-art") and
 * a display name; matching accepts any of them, plus the seed `artForm` value.
 */
export async function listCatalogueFor(
  keys: string[],
  locale?: string
): Promise<CatalogueItem[]> {
  // Resolve the request through the same alias map the items use. Without this
  // an item tagged "home-decor" could never be found by the collection name
  // "Home & Decorative Art", or vice versa.
  const wanted = new Set(
    keys
      .map(collectionKey)
      .filter(Boolean)
      .flatMap((key) => [key, SEED_COLLECTION_TO_SLUG[key] ?? key])
  );
  if (wanted.size === 0) return [];

  const items = await listCatalogue(undefined, locale);
  return items.filter((item) =>
    item.artForms.some((form) => form && wanted.has(form))
  );
}

/** Distinct collection names present in the catalogue, for nav menus. */
export async function listCatalogueCollections(): Promise<
  { name: string; count: number }[]
> {
  const items = await listCatalogue();
  const counts = new Map<string, number>();
  for (const item of items) {
    if (!item.collection) continue;
    counts.set(item.collection, (counts.get(item.collection) ?? 0) + 1);
  }
  return [...counts.entries()].map(([name, count]) => ({ name, count }));
}

/**
 * Look up a single catalogue item by handle.
 *
 * Used by the product detail page, which otherwise 404s for seed items: the
 * cards render from the seed catalogue, so their links must resolve too.
 */
export async function findCatalogueItem(
  handle: string,
  currency?: string
): Promise<CatalogueItem | null> {
  const items = await listCatalogue(currency);
  return items.find((item) => item.handle === handle) ?? null;
}

/**
 * Resolve a readable handle back to the live Medusa product it came from.
 *
 * Listing cards link to the *catalogue* handle, which for a product whose Medusa
 * handle is short and opaque (`cotton-throw`) is regenerated from the title. But
 * `medusa.getProduct` only knows the original handle, so the detail page 404s on
 * every such product while the listing happily shows it. Rather than change how
 * Medusa stores its data — which would break existing links and any ranking —
 * map the generated handle back to the original here.
 */
export async function resolveMedusaHandle(readable: string): Promise<string> {
  try {
    const { products } = await medusa.listProducts({ limit: 100 });
    for (const product of products ?? []) {
      const derived = isOpaqueHandle(product.handle)
        ? productSlug({
            title: product.title ?? "artwork",
            artist: product.metadata?.artist as string | undefined,
            artForm: product.categories?.[0]?.name,
          })
        : product.handle;
      if (derived === readable) return product.handle;
    }
  } catch {
    // Backend unreachable; fall through and let the caller try the handle raw.
  }
  return readable;
}

/** Seed prices are authored in rupees; expose a helper for non-card displays. */
export function rupeesFromMinorUnits(minor: number | null): number | null {
  return minor == null ? null : Math.round(minor / 100);
}

/**
 * The locale implied by the request path.
 *
 * Deliberately *not* `getLocale()`. next-intl falls back to the NEXT_LOCALE
 * cookie when the URL carries no prefix, so a visitor who once opened /hi saw
 * Hindi product titles on the English /products/... URL. The path is the only
 * thing that identifies the page, and it is what hreflang and the cache key
 * must agree with, so it is what we read.
 *
 * Uses the `x-middleware-rewrite` header next-intl sets when it maps a clean
 * path onto the `[locale]` route, so the answer reflects the request rather
 * than the rewrite target. Falls back to the inbound `x-locale` header, then to
 * English.
 */
async function localeFromRequest(): Promise<string> {
  try {
    const { headers } = await import("next/headers");
    const store = await headers();

    // next-intl rewrites `/shop` to `/en/shop`; the *original* path is what
    // tells us whether the visitor asked for Hindi.
    for (const key of ["x-locale", "x-pathname", "x-invoke-path"]) {
      const value = store.get(key);
      if (value && value.trim()) return value.trim();
    }
  } catch {
    // Outside a request scope (build-time prerender): English is the default.
  }
  return "en";
}

/**
 * The translated title for one product in the active locale.
 *
 * The product detail page fetches straight from Medusa rather than going
 * through the cached catalogue, so it needs its own lookup. Returns the Medusa
 * title when there is no translation, which is the correct behaviour for a
 * product added since the last translation pass.
 */
export async function translatedProductTitle(
  handle: string,
  fallback: string | null | undefined
): Promise<string> {
  const title = fallback ?? "artwork";
  try {
    const locale = await localeFromRequest();
    if (locale === "en") return title;
    const translations = await productTranslationsFor(locale);
    return translations.get(handle)?.title ?? title;
  } catch {
    return title;
  }
}

/**
 * The translated description for one product in the active locale.
 *
 * Separate from the title because the two translate independently: a product
 * can have a reviewed Hindi title before anyone has written the Hindi prose,
 * and in that case the English description is still the most useful thing to
 * show. Returns null when there is nothing translated, so the caller keeps the
 * Medusa description rather than rendering an empty paragraph.
 */
export async function translatedProductDescription(
  handle: string
): Promise<string | null> {
  try {
    const locale = await localeFromRequest();
    if (locale === "en") return null;
    const translations = await productTranslationsFor(locale);
    const description = translations.get(handle)?.description;
    return description && description.trim() ? description : null;
  } catch {
    return null;
  }
}
