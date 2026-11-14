"use client";

/**
 * Mobile-only sticky purchase bar.
 *
 * On a phone the main add-to-cart button scrolls far above the fold once you
 * are reading the description or specs, so a buyer has to scroll back up to buy.
 * This bar pins the price and the primary action to the bottom of the viewport
 * on small screens only; on desktop it never renders. It shares the single
 * add-to-cart implementation so its behaviour, messages and badge refresh match
 * the inline button exactly.
 */

import Link from "next/link";
import { useAddToCart } from "@/lib/hooks/use-add-to-cart";
import { formatPrice } from "@/lib/medusa";

export function MobileBuyBar({
  variantId,
  price,
  currency,
  isCustomOnly,
  inStock,
}: {
  variantId?: string | null;
  price: number | null;
  currency: string;
  isCustomOnly: boolean;
  inStock: boolean;
}) {
  const { add, isPending, result } = useAddToCart();

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-sand-border bg-rang-paper/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-rang-paper/85 lg:hidden">
      <div className="flex items-center gap-4">
        <div className="min-w-0">
          <p className="font-serif text-lg font-semibold text-deep-ink">
            {formatPrice(price, currency)}
          </p>
          {result && (
            <p
              role="status"
              className={`truncate font-sans text-[11px] ${
                result.ok ? "text-green-700" : "text-red-700"
              }`}
            >
              {result.message}
            </p>
          )}
        </div>
        <div className="ml-auto flex-1 max-w-[60%]">
          {isCustomOnly ? (
            <Link
              href="/custom-art"
              className="block w-full rounded-md bg-sindoor px-4 py-3 text-center font-sans text-sm font-semibold text-rang-paper"
            >
              Request a commission
            </Link>
          ) : result?.ok ? (
            <Link
              href="/cart"
              className="block w-full rounded-md bg-leaf px-4 py-3 text-center font-sans text-sm font-semibold text-rang-paper"
            >
              View cart
            </Link>
          ) : (
            <button
              type="button"
              disabled={!variantId || !inStock || isPending}
              onClick={() => add(variantId, 1)}
              className="w-full rounded-md bg-sindoor px-4 py-3 font-sans text-sm font-semibold text-rang-paper disabled:opacity-50"
            >
              {!inStock
                ? "Unavailable"
                : isPending
                  ? "Adding…"
                  : "Add to cart"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}