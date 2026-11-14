/**
 * Pure filtering + sorting for the shop.
 *
 * Kept as plain functions over `CatalogueItem[]` so it can run on the server
 * (for correct, shareable URLs and SEO) and be unit-tested without a browser or
 * a database. The page reads filters from searchParams; this module is the only
 * place that decides what "match" means.
 */
import type { CatalogueItem } from "@/lib/catalogue";

export type SortKey = "featured" | "newest" | "price-asc" | "price-desc";

export interface ShopFilters {
  query?: string;
  form?: string; // an art-form/collection key
  medium?: string; // matched against specs.medium (substring, lowercase)
  availability?: "ready" | "made-to-order" | "all";
  min?: number; // rupees
  max?: number; // rupees
  sort?: SortKey;
}

/** A stable key for an item's collection, for building filter chips/links. */
export function formKey(item: CatalogueItem): string {
  return (item.collection || "").toLowerCase();
}

function matchesQuery(item: CatalogueItem, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  return (
    item.title.toLowerCase().includes(needle) ||
    item.artist.toLowerCase().includes(needle) ||
    item.collection.toLowerCase().includes(needle) ||
    (item.specs.medium || "").toLowerCase().includes(needle)
  );
}

function matchesAvailability(item: CatalogueItem, availability?: string): boolean {
  if (!availability || availability === "all") return true;
  if (availability === "ready") return item.stockType === "ready_to_ship";
  if (availability === "made-to-order")
    return item.stockType === "made_to_order" || item.stockType === "custom_only";
  return true;
}

/**
 * Filter + sort a catalogue.
 *
 * Price is stored in minor units (paise), so `min`/`max` are given in whole
 * rupees and converted here — the caller (a URL) should not have to know.
 */
export function applyShopFilters(
  items: CatalogueItem[],
  filters: ShopFilters
): CatalogueItem[] {
  const min = filters.min != null ? filters.min * 100 : null;
  const max = filters.max != null ? filters.max * 100 : null;

  const filtered = items.filter((item) => {
    if (filters.query && !matchesQuery(item, filters.query)) return false;
    if (
      filters.form &&
      !item.artForms.some((f) => f && f.toLowerCase() === filters.form!.toLowerCase()) &&
      formKey(item) !== filters.form!.toLowerCase()
    ) {
      return false;
    }
    if (filters.medium) {
      const m = (item.specs.medium || "").toLowerCase();
      if (!m.includes(filters.medium.toLowerCase())) return false;
    }
    if (!matchesAvailability(item, filters.availability)) return false;
    if (min != null || max != null) {
      if (item.price == null) return false;
      if (min != null && item.price < min) return false;
      if (max != null && item.price > max) return false;
    }
    return true;
  });

  return sortItems(filtered, filters.sort ?? "featured");
}

export function sortItems(
  items: CatalogueItem[],
  sort: SortKey
): CatalogueItem[] {
  const copy = items.slice();
  switch (sort) {
    case "newest":
      return copy.sort((a, b) => Number(b.isNew) - Number(a.isNew));
    case "price-asc":
      return copy.sort(
        (a, b) => (a.price ?? Infinity) - (b.price ?? Infinity)
      );
    case "price-desc":
      return copy.sort(
        (a, b) => (b.price ?? -Infinity) - (a.price ?? -Infinity)
      );
    default:
      return copy;
  }
}

/** Distinct medium values present, for the medium filter options. */
export function availableMediums(items: CatalogueItem[]): string[] {
  const set = new Set<string>();
  for (const item of items) {
    if (item.specs.medium) set.add(item.specs.medium);
  }
  return [...set].sort();
}
