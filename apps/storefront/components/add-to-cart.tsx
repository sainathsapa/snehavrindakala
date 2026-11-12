"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { addToCartAction } from "@/app/cart/actions";

interface AddToCartProps {
  variantId?: string;
  disabled?: boolean;
  disabledReason?: string;
}

export function AddToCart({
  variantId,
  disabled = false,
  disabledReason,
}: AddToCartProps) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(
    null
  );

  if (disabled) {
    return (
      <div className="rounded-xl border border-border bg-paper p-4 text-sm text-muted font-sans">
        {disabledReason || "This piece is available by commission only."}{" "}
        <Link href="/custom-art" className="text-terracotta underline">
          Request a commission
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        disabled={!variantId || isPending}
        onClick={() => {
          if (!variantId) return;
          startTransition(async () => {
            const response = await addToCartAction(variantId, 1);
            setResult(response);
            if (response.ok) {
              // Header badge listens for this instead of re-fetching on nav.
              window.dispatchEvent(new Event("svk:cart-changed"));
            }
          });
        }}
        className="w-full py-4 bg-terracotta text-white rounded-xl font-semibold hover:bg-terracotta/90 focus:outline-none focus:ring-2 focus:ring-terracotta focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:pointer-events-none"
      >
        {isPending ? "Adding…" : "Add to Cart"}
      </button>

      {result && (
        <p
          role="status"
          className={`text-sm font-sans ${
            result.ok ? "text-green-700" : "text-red-700"
          }`}
        >
          {result.message}{" "}
          {result.ok && (
            <Link href="/cart" className="text-terracotta underline">
              View cart
            </Link>
          )}
        </p>
      )}
    </div>
  );
}
