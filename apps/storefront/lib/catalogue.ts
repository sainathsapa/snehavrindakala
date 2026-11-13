import { unstable_cache } from "next/cache";
import { medusa } from "@/lib/medusa";
import { products as seedProducts, type Product as SeedProduct } from "@/data/products";
import { productSlug, isOpaqueHandle } from "@/lib/slug";

/**
 * The single read path for catalogue listings.
 *
 * The storefront historically read straight from Medusa. That is correct for a
 * populated catalogue, but it means an empty or barely-seeded backend renders
 * as an empty shop — `/shop/painting` answered 200 with "No products in this
 * collection yet" while six finished seed products sat unused in
 * `data/products.ts`, imported by nothing.
 *
 * So: prefer live Medusa products, and only fall back to the seed catalogue
 * when the live catalogue is genuinely empty. When the backend has real data it
 * always wins; the seeds never mask live products.
 */

export interface CatalogueItem {
  handle: string;
  title: string;
  artist: string;
  price: number | null;
  stockType: string;
  image: string;
  isNew: boolean;
  /** Art-form slugs this item belongs to (matched against taxonomy slugs). */
  artForms: string[];
  /** Human-readable collection name, for grouping and breadcrumbs. */
  collection: string;
  /** True when the item came from the seed file rather than Medusa. */
  seeded: boolean;
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

function seedToItem(product: SeedProduct): CatalogueItem {
  return {
    // Seed records are identified as `prod_001`, but that makes an opaque URL
    // (`/products/001`). Derive a descriptive, keyword-bearing handle instead:
    // `/products/hand-painted-terracotta-vase-home-1`.
    handle: productSlug({
      title: product.title,
      artist: product.artist,
      artForm: product.artForm,
    }),
    title: product.title,
    artist: product.artist,
    // Seed prices are written in whole rupees, but `price` is consumed as minor
    // units everywhere (formatPrice divides by 100), so ₹2,200 rendered as
    // "₹22". Convert once, here.
    price: product.price == null ? null : product.price * 100,
    stockType: STOCK_TYPES.has(product.stockType) ? product.stockType : "ready_to_ship",
    image: product.image,
    isNew: product.isNew ?? false,
    artForms: [
      SEED_COLLECTION_TO_SLUG[collectionKey(product.collection ?? "")] ??
        collectionKey(product.collection ?? ""),
      collectionKey(product.artForm ?? ""),
    ],
    collection: product.collection ?? "",
    seeded: true,
  };
}

const seedItems: CatalogueItem[] = seedProducts.map(seedToItem);

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
    artist: product.metadata?.artist ?? "SnehaVrinda Kala",
    price,
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
  };
}

async function loadCatalogue(): Promise<CatalogueItem[]> {
  let live: CatalogueItem[] = [];
  try {
    const { products } = await medusa.listProducts({ limit: 100 });
    live = (products ?? []).map(liveToItem);
  } catch (err) {
    console.error("Failed to load products from Medusa; using seed catalogue", err);
  }

  // Seed items supplement the live catalogue rather than replacing it. Treating
  // them as an either/or fallback meant that as soon as a single product
  // existed in Medusa the other five collections rendered as empty — which is
  // exactly what happened: one published product hid the entire sample set.
  // Live handles win on collision so real data is never shadowed.
  const liveHandles = new Set(live.map((item) => item.handle));
  return [...live, ...seedItems.filter((item) => !liveHandles.has(item.handle))];
}

/**
 * Every catalogue item, live first, falling back to seed data when empty.
 *
 * Cached for a short window: the root layout builds the nav menus from this on
 * every request, and an uncached Medusa call there would make every page in the
 * app dynamic. A minute of staleness on a nav menu is invisible; making the
 * whole site dynamic is not.
 */
export const listCatalogue = unstable_cache(loadCatalogue, ["catalogue"], {
  revalidate: 60,
  tags: ["catalogue"],
});

/**
 * Catalogue items belonging to one art form.
 *
 * `keys` may contain a taxonomy slug ("folk"), a Medusa handle ("folk-art") and
 * a display name; matching accepts any of them, plus the seed `artForm` value.
 */
export async function listCatalogueFor(keys: string[]): Promise<CatalogueItem[]> {
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

  const items = await listCatalogue();
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
  handle: string
): Promise<CatalogueItem | null> {
  const items = await listCatalogue();
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
