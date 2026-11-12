"use client";

/**
 * Live cart badge for the header.
 *
 * Reads /api/store/cart-count, which sums the current cart from the server-side
 * cart cookie. `refresh` is dispatched by the add-to-cart flow so the badge
 * updates without a full reload.
 */

import { useCallback, useEffect, useState } from "react";

export function CartCount({ className = "" }: { className?: string }) {
  const [count, setCount] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/store/cart-count", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setCount(typeof data.count === "number" ? data.count : 0);
    } catch {
      // A failed count must never break the header.
    }
  }, []);

  useEffect(() => {
    refresh();
    const onChange = () => refresh();
    window.addEventListener("svk:cart-changed", onChange);
    // Keep two tabs consistent.
    window.addEventListener("focus", onChange);
    return () => {
      window.removeEventListener("svk:cart-changed", onChange);
      window.removeEventListener("focus", onChange);
    };
  }, [refresh]);

  // The reference always shows the bag's count, including zero, so the badge
  // reads as part of the icon rather than popping in when something is added.
  return (
    <span
      className={`absolute -right-1.5 -top-1.5 inline-flex h-[15px] min-w-[15px] items-center justify-center rounded-full bg-kumkum px-1 text-[9px] font-semibold leading-none text-rang-paper ${className}`}
      aria-label={`${count ?? 0} item${count === 1 ? "" : "s"} in cart`}
    >
      {count === null ? "" : count > 99 ? "99+" : count}
    </span>
  );
}
