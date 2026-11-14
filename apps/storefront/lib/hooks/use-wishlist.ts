"use client";

/**
 * Wishlist store.
 *
 * Deliberately persistent in `localStorage` for everyone — a guest can save a
 * work without an account, and a signed-in customer gets the same list on the
 * same browser. Storing the card snapshot (handle, title, image, price) lets the
 * wishlist page render instantly without a server round trip per item.
 *
 * A `svk:wishlist-changed` event keeps every subscribe (the PDP heart, the
 * header count) in sync when one of them mutates the list.
 */
import { useCallback, useEffect, useState } from "react";

const KEY = "svk:wishlist";
const EVENT = "svk:wishlist-changed";

export interface WishlistEntry {
  handle: string;
  title: string;
  image?: string;
  price?: number | null;
  currency?: string;
  artist?: string;
}

function read(): WishlistEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write(entries: WishlistEntry[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(entries));
    window.dispatchEvent(new Event(EVENT));
  } catch {
    // Storage unavailable (private mode) — nothing to do.
  }
}

export function useWishlist() {
  const [entries, setEntries] = useState<WishlistEntry[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setEntries(read());
    setReady(true);
    const onChange = () => setEntries(read());
    window.addEventListener(EVENT, onChange);
    // Another tab edited the list.
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(EVENT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  const has = useCallback(
    (handle: string) => entries.some((e) => e.handle === handle),
    [entries]
  );

  const toggle = useCallback((entry: WishlistEntry) => {
    const current = read();
    const exists = current.some((e) => e.handle === entry.handle);
    write(
      exists
        ? current.filter((e) => e.handle !== entry.handle)
        : [entry, ...current]
    );
  }, []);

  const remove = useCallback((handle: string) => {
    write(read().filter((e) => e.handle !== handle));
  }, []);

  return { entries, ready, has, toggle, remove };
}
