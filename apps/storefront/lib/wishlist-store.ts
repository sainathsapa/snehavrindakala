/**
 * Pure wishlist operations, independent of React and of `window`.
 *
 * The hook in `lib/hooks/use-wishlist.ts` is a thin wrapper over these
 * functions; keeping the list algebra here means it can be unit-tested with a
 * fake storage object instead of a browser.
 */

export interface WishlistEntry {
  handle: string;
  title: string;
  image?: string;
  price?: number | null;
  currency?: string;
  artist?: string;
}

export const WISHLIST_KEY = "svk:wishlist";

/** Minimal storage shape, so tests can pass a plain object. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function parseWishlist(raw: string | null): WishlistEntry[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e): e is WishlistEntry =>
        e && typeof e.handle === "string" && typeof e.title === "string"
    );
  } catch {
    return [];
  }
}

export function loadWishlist(storage: StorageLike): WishlistEntry[] {
  return parseWishlist(storage.getItem(WISHLIST_KEY));
}

export function saveWishlist(
  storage: StorageLike,
  entries: WishlistEntry[]
): WishlistEntry[] {
  storage.setItem(WISHLIST_KEY, JSON.stringify(entries));
  return entries;
}

/** Add if absent, remove if present. Returns the new list. */
export function toggleWishlist(
  entries: WishlistEntry[],
  entry: WishlistEntry
): WishlistEntry[] {
  const exists = entries.some((e) => e.handle === entry.handle);
  return exists
    ? entries.filter((e) => e.handle !== entry.handle)
    : [entry, ...entries];
}

export function removeFromWishlist(
  entries: WishlistEntry[],
  handle: string
): WishlistEntry[] {
  return entries.filter((e) => e.handle !== handle);
}

export function isWishlisted(
  entries: WishlistEntry[],
  handle: string
): boolean {
  return entries.some((e) => e.handle === handle);
}
