"use client";

/**
 * Wishlist store (React binding).
 *
 * The list algebra lives in `lib/wishlist-store.ts` and is unit-tested there;
 * this file only wires that logic to React state, browser storage and — for a
 * signed-in customer — the server copy.
 *
 * Persistence is localStorage first: a guest can save a work without an
 * account, and that must keep working even when the network does not. When a
 * session exists, the browser list is merged with the stored one (union, never
 * a delete) and pushed back, so the list follows the customer to another
 * device. A `svk:wishlist-changed` event keeps every subscriber in sync.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  isWishlisted,
  loadWishlist,
  mergeWishlists,
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

async function pushToServer(entries: WishlistEntry[]): Promise<void> {
  try {
    await fetch("/api/store/wishlist", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entries }),
      keepalive: true,
    });
  } catch {
    // Offline or signed out: the browser copy is still correct, and the next
    // successful mutation or page load will try again.
  }
}

export function useWishlist() {
  const [entries, setEntries] = useState<WishlistEntry[]>([]);
  const [ready, setReady] = useState(false);
  const signedIn = useRef(false);

  useEffect(() => {
    setEntries(read());
    setReady(true);

    const onChange = () => setEntries(read());
    window.addEventListener(EVENT, onChange);
    // Another tab edited the list.
    window.addEventListener("storage", onChange);

    // Merge with the server copy once, on mount. A failure here must not stop
    // the page: the browser list is the one the visitor can see.
    let cancelled = false;
    fetch("/api/store/wishlist", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => {
        if (cancelled || !body?.signedIn) return;
        signedIn.current = true;
        const merged = mergeWishlists(read(), body.entries ?? []);
        if (merged.length !== read().length) {
          write(merged);
        } else {
          setEntries(merged);
        }
        void pushToServer(merged);
      })
      .catch(() => {
        // Signed out, or the endpoint is unreachable.
      });

    return () => {
      cancelled = true;
      window.removeEventListener(EVENT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  const has = useCallback(
    (handle: string) => isWishlisted(entries, handle),
    [entries]
  );

  const commit = useCallback((next: WishlistEntry[]) => {
    write(next);
    if (signedIn.current) void pushToServer(next);
  }, []);

  const toggle = useCallback(
    (entry: WishlistEntry) => {
      commit(toggleWishlist(read(), entry));
    },
    [commit]
  );

  const remove = useCallback(
    (handle: string) => {
      commit(removeFromWishlist(read(), handle));
    },
    [commit]
  );

  return { entries, ready, has, toggle, remove };
}
