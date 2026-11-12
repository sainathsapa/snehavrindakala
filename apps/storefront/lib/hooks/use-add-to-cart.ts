"use client";

/**
 * Shared add-to-cart behaviour.
 *
 * Two components implemented this separately — components/add-to-cart.tsx (a
 * single-variant product) and components/product-options.tsx (variant picker) —
 * with copy-pasted transitions, result messages, and the `svk:cart-changed`
 * event that keeps the header badge in sync. They had already drifted. This is
 * the single implementation both call.
 */

import { useState, useTransition } from "react";
import { addToCartAction } from "@/app/cart/actions";

export interface AddToCartResult {
  ok: boolean;
  message: string;
}

export function useAddToCart() {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<AddToCartResult | null>(null);

  const add = (variantId: string | null | undefined, quantity = 1) => {
    if (!variantId) return;

    // Clear the previous message so a stale success cannot sit above a new
    // failure.
    setResult(null);

    startTransition(async () => {
      try {
        const response = await addToCartAction(variantId, quantity);
        setResult(response);

        if (response.ok) {
          // The header badge listens for this rather than re-fetching on every
          // navigation.
          window.dispatchEvent(new Event("svk:cart-changed"));
        }
      } catch (err) {
        // A thrown action (network failure, backend down) must not leave the
        // button spinning forever with no explanation.
        setResult({
          ok: false,
          message:
            err instanceof Error
              ? err.message
              : "Could not add this item. Please try again.",
        });
      }
    });
  };

  return { add, isPending, result, reset: () => setResult(null) };
}
