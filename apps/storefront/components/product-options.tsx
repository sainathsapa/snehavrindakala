"use client";

/**
 * The purchase panel — variants and the single primary action.
 *
 * This component used to render its own bordered price-and-availability block,
 * *inside* the page's own price-and-availability block. Two prices, two "ready to
 * ship" lines, two borders, thirty pixels apart. The page now owns the price and
 * availability (they belong to the artwork's identity, not to a widget), and this
 * component owns only what is genuinely interactive: choosing a variant and
 * adding it to the cart.
 *
 * There is exactly one filled button here. Wishlist and "commission a similar
 * piece" are quieter neighbours rendered by the page, so a buyer never has to
 * decide which of two bright things to press.
 */

import { useState } from "react";
import { Link } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import { useAddToCart } from "@/lib/hooks/use-add-to-cart";
import { formatPrice } from "@/lib/medusa";

interface ProductVariant {
  id: string;
  title?: string | null;
  sku?: string | null;
  inventory_quantity?: number;
  options?: Array<{ option_id?: string; value: string }>;
  calculated_price?: { calculated_amount?: number } | null;
  prices?: Array<{ amount: number; currency_code?: string }>;
}

interface ProductOptionsProps {
  variants: ProductVariant[];
  price: number | null;
  currency: string;
  stockType: string;
  isCustomOnly: boolean;
  handle: string;
}

export function ProductOptions({
  variants,
  price,
  currency,
  isCustomOnly,
}: ProductOptionsProps) {
  const t = useTranslations("cart");
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(
    variants[0]?.id ?? null
  );
  const { add, isPending: isPendingAdd, result } = useAddToCart();

  const selectedVariant = variants.find((variant) => variant.id === selectedVariantId);
  const inStock =
    selectedVariant?.inventory_quantity != null
      ? selectedVariant.inventory_quantity > 0
      : true;

  const variantPrice =
    selectedVariant?.calculated_price?.calculated_amount ??
    selectedVariant?.prices?.[0]?.amount ??
    price;

  const disabled = isCustomOnly || !selectedVariantId;

  // Custom-only pieces are made through the commission conversation, not a cart.
  if (isCustomOnly) {
    return (
      <div className="space-y-3">
        <p className="font-sans text-sm leading-relaxed text-muted-ink">
          This piece is made to order through our commission process — a brief, a
          quote, a proof, and then the weeks it actually takes.
        </p>
        <Link
          href="/custom-art"
          className="inline-flex w-full items-center justify-center rounded-full bg-kumkum px-6 py-3.5 font-sans text-sm font-semibold text-rang-paper transition-colors hover:bg-sindoor focus:outline-none focus-visible:ring-2 focus-visible:ring-kumkum/50 focus-visible:ring-offset-2"
        >
          Request a commission
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {variants.length > 1 && (
        <fieldset>
          <legend className="mb-2 font-sans text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-ink">
            Choose a version
          </legend>
          <div className="flex flex-wrap gap-2">
            {variants.map((variant) => {
              const active = selectedVariantId === variant.id;
              const soldOut =
                variant.inventory_quantity != null && variant.inventory_quantity <= 0;
              return (
                <button
                  key={variant.id}
                  type="button"
                  onClick={() => setSelectedVariantId(variant.id)}
                  disabled={soldOut}
                  aria-pressed={active}
                  className={`rounded-full border px-4 py-2 font-sans text-[13px] transition-colors ${
                    active
                      ? "border-sindoor bg-sindoor text-rang-paper"
                      : soldOut
                        ? "cursor-not-allowed border-sand-border/50 text-muted-ink/60"
                        : "border-sand-border text-deep-ink hover:border-sindoor"
                  }`}
                >
                  {variant.title || variant.options?.[0]?.value || "Option"}
                  {soldOut && (
                    <span className="ml-1.5 text-[10px] uppercase tracking-wider">
                      sold
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </fieldset>
      )}

      {variants.length > 1 && variantPrice != null && selectedVariantId !== variants[0]?.id && (
        <p className="font-sans text-sm text-muted-ink">
          Selected version:{" "}
          <span className="font-medium text-deep-ink">
            {formatPrice(variantPrice, currency)}
          </span>
        </p>
      )}

      {/* One primary action. */}
      <button
        type="button"
        disabled={disabled || !inStock || isPendingAdd}
        onClick={() => add(selectedVariantId, 1)}
        className="w-full rounded-full bg-kumkum px-6 py-4 font-sans text-sm font-semibold tracking-wide text-rang-paper transition-colors hover:bg-sindoor focus:outline-none focus-visible:ring-2 focus-visible:ring-kumkum/50 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPendingAdd ? t("adding") : inStock ? t("addToCart") : "Currently unavailable"}
      </button>

      {result && (
        <p
          role="status"
          className={`rounded-md px-3 py-2 font-sans text-sm ${
            result.ok
              ? "bg-leaf/8 text-leaf"
              : "bg-sindoor/5 text-sindoor"
          }`}
        >
          {result.message}{" "}
          {result.ok && (
            <Link href="/cart" className="font-medium underline underline-offset-4">
              View cart
            </Link>
          )}
        </p>
      )}

      {!inStock && (
        <p className="font-sans text-xs leading-relaxed text-muted-ink">
          This work is between editions.{" "}
          <Link href="/custom-art" className="text-terracotta underline underline-offset-4">
            Commission something like it
          </Link>{" "}
          and we will make one for you.
        </p>
      )}
    </div>
  );
}
