"use client";

/**
 * Mobile-only sticky purchase bar.
 *
 * On a phone the inline add-to-cart button scrolls far above the fold once you
 * are reading the story or the specs, so this bar pins the price and the primary
 * action to the bottom of the viewport. It never renders on desktop.
 *
 * It shares the single add-to-cart implementation so its behaviour, messages and
 * header badge match the inline button exactly. The page reserves matching bottom
 * padding (`pb-32`) so the bar can never cover the last piece of content, and it
 * respects the home-indicator inset on iOS.
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
  title,
}: {
  variantId?: string | null;
  price: number | null;
  currency: string;
  isCustomOnly: boolean;
  inStock: boolean;
  /** Artwork title, for the truncating label above the price. */
  title?: string;
}) {
  const { add, isPending, result } = useAddToCart();

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-sand-border bg-rang-paper/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2.5 backdrop-blur supports-[backdrop-filter]:bg-rang-paper/85 lg:hidden">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          {title && (
            <p className="truncate font-sans text-[11px] text-muted-ink">{title}</p>
          )}
          <p className="font-serif text-lg font-semibold leading-tight text-deep-ink">
            {formatPrice(price, currency)}
          </p>
          {result && (
            <p
              role="status"
              className={`truncate font-sans text-[11px] ${
                result.ok ? "text-leaf" : "text-sindoor"
              }`}
            >
              {result.message}
            </p>
          )}
        </div>

        <div className="shrink-0">
          {isCustomOnly ? (
            <Link
              href="/custom-art"
              className="inline-block rounded-full bg-kumkum px-5 py-3 font-sans text-sm font-semibold text-rang-paper"
            >
              Commission
            </Link>
          ) : result?.ok ? (
            <Link
              href="/cart"
              className="inline-block rounded-full bg-leaf px-5 py-3 font-sans text-sm font-semibold text-rang-paper"
            >
              View cart
            </Link>
          ) : (
            <button
              type="button"
              disabled={!variantId || !inStock || isPending}
              onClick={() => add(variantId, 1)}
              className="rounded-full bg-kumkum px-6 py-3 font-sans text-sm font-semibold text-rang-paper transition-colors disabled:opacity-50"
            >
              {!inStock ? "Unavailable" : isPending ? "Adding…" : "Add to cart"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
