"use client";

/**
 * Wishlist store (React binding).
 *
 * The list algebra lives in `lib/wishlist-store.ts` and is unit-tested there;
 * this file only wires that logic to React state and to browser storage.
 *
 * Persistence is `localStorage` for everyone — a guest can save a work without
 * an account, and a signed-in customer gets the same list on the same browser.
 * A `svk:wishlist-changed` event keeps every subscriber (the PDP heart, the
 * header count) in sync when one of them mutates the list.
 */
import { useCallback, useEffect, useState } from "react";
import {
  isWishlisted,
  loadWishlist,
  removeFromWishlist,
  saveWishlist,
  toggleWishlist,
  type WishlistEntry,
} from "@/lib/wishlist-store";

export type { WishlistEntry };

const EVENT = "svk:wishlist-changed";

function read(): WishlistEntry[] {
  if (typeof window === "undefined") return [];
  return loadWishlist(localStorage);
}

function write(entries: WishlistEntry[]) {
  try {
    saveWishlist(localStorage, entries);
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
    (handle: string) => isWishlisted(entries, handle),
    [entries]
  );

  const toggle = useCallback((entry: WishlistEntry) => {
    write(toggleWishlist(read(), entry));
  }, []);

  const remove = useCallback((handle: string) => {
    write(removeFromWishlist(read(), handle));
  }, []);

  return { entries, ready, has, toggle, remove };
}
