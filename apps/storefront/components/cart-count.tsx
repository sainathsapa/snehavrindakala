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

  if (count === null || count === 0) return null;

  return (
    <span
      className={`inline-flex min-w-[18px] items-center justify-center rounded-full bg-sindoor px-1.5 py-0.5 text-[10px] font-semibold leading-none text-rang-paper ${className}`}
      aria-label={`${count} item${count === 1 ? "" : "s"} in cart`}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}
