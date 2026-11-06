"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { addToCartAction } from "@/app/cart/actions";
import { formatPrice } from "@/lib/medusa";
import { Button } from "@snehavrinda-kala/ui";

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
  stockType,
  isCustomOnly,
  handle,
}: ProductOptionsProps) {
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(
    variants[0]?.id ?? null
  );
  const [isPendingAdd, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(
    null
  );

  const selectedVariant = variants.find((v) => v.id === selectedVariantId);
  const inStock =
    selectedVariant?.inventory_quantity != null
      ? selectedVariant.inventory_quantity > 0
      : true;

  const variantPrice =
    selectedVariant?.calculated_price?.calculated_amount ??
    selectedVariant?.prices?.[0]?.amount ??
    price;

  const disabled = isCustomOnly || !selectedVariantId;

  return (
    <div className="space-y-6">
      {variants.length > 1 ? (
        <>
          <h3 className="text-lg font-serif font-semibold text-deep-ink">
            Choose an option
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {variants.map((v) => {
              const active = selectedVariantId === v.id;
              const out = v.inventory_quantity != null && v.inventory_quantity <= 0;
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setSelectedVariantId(v.id)}
                  disabled={out}
                  className={`border rounded-xl py-3 text-sm font-sans transition-all ${
                    active
                      ? "bg-sindoor text-rang-paper border-sindoor shadow-soft"
                      : out
                        ? "border-sand-border/50 text-muted-ink bg-surface/50"
                        : "border-sindoor text-deep-ink bg-surface hover:border-sindoor"
                  }`}
                >
                  <span className="font-medium block">
                    {v.title || v.options?.[0]?.value || "Option"}
                  </span>
                  {variantPrice != null && active && (
                    <span className="text-xs text-muted-ink block mt-0.5">
                      {formatPrice(variantPrice, currency)}
                    </span>
                  )}
                  {out && (
                    <span className="text-[10px] text-sindoor uppercase tracking-wider mt-0.5">
                      Made to order
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </>
      ) : null}

      <div className="border-y border-sand-border py-4">
        <div className="flex items-baseline gap-4">
          <span className="text-3xl font-serif font-bold text-deep-ink">
            {formatPrice(variantPrice, currency)}
          </span>
          {variantPrice != null && (
            <span className="text-sm text-muted-ink font-sans">{currency.toUpperCase()}</span>
          )}
        </div>
        <p className="mt-2 text-sm text-muted-ink font-sans capitalize">
          {stockType.replace(/_/g, " ")}
        </p>
        {!inStock && !isCustomOnly && (
          <p className="mt-1 text-xs text-sindoor font-medium">
            Currently unavailable — ready to ship soon or commission a similar piece.
          </p>
        )}
      </div>

      <div className="pt-4 border-t border-sand-border">
        {isCustomOnly ? (
          <div className="rounded-xl border border-sand-border bg-rang-paper p-4 text-sm text-muted-ink font-sans">
            This piece is made to order through our commission process.{" "}
            <Link href="/custom-art" className="text-sindoor underline font-medium">
              Request a commission
            </Link>
          </div>
        ) : (
          <button
            type="button"
            disabled={disabled || !inStock || isPendingAdd}
            onClick={() => {
              if (!selectedVariantId) return;
              startTransition(async () => {
                const response = await addToCartAction(selectedVariantId, 1);
                setResult(response);
              });
            }}
            className="w-full py-4 bg-sindoor text-rang-paper rounded-xl font-semibold hover:bg-sindoor/90 focus:outline-none focus:ring-2 focus:ring-sindoor focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:pointer-events-none"
          >
            {isPendingAdd ? "Adding…" : "Add to Cart"}
          </button>
        )}
        {result && (
          <p
            role="status"
            className={`text-sm font-sans ${
              result.ok ? "text-green-700" : "text-red-700"
            }`}
          >
            {result.message}{" "}
            {result.ok && (
              <Link href="/cart" className="text-sindoor underline">
                View cart
              </Link>
            )}
          </p>
        )}
      </div>
    </div>
  );
}
