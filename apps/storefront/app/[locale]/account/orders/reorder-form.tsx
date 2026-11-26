"use client";

/**
 * "Buy this again" — one tap, and the basket is rebuilt.
 *
 * A gifting shop has repeat buyers. Asking one of them to find a work they already
 * chose, page by page, loses the sale at the moment their intent is highest, so the
 * button reads the order and refills the cart from it.
 *
 * Nothing is charged and nothing is ordered: it is a filled basket the buyer can
 * still change. When a work has sold since, the button says so instead of quietly
 * producing a half-empty cart.
 */

import { useActionState } from "react";
import { reorderAction, type ReorderState } from "./actions";

export function ReorderForm({
  orderId,
  locale,
  labels,
  disabled = false,
}: {
  orderId: string;
  locale: string;
  labels: { reorder: string; working: string };
  /** A cancelled order has nothing to re-order. */
  disabled?: boolean;
}) {
  const [state, formAction, pending] = useActionState<ReorderState | null, FormData>(
    reorderAction,
    null
  );

  if (disabled) return null;

  return (
    <form action={formAction} className="inline">
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="locale" value={locale} />
      <button
        type="submit"
        disabled={pending}
        className="font-sans text-sm text-terracotta underline-offset-4 hover:underline disabled:opacity-50"
      >
        {pending ? labels.working : labels.reorder}
      </button>
      {state && !state.ok && (
        <span role="status" className="ml-2 font-sans text-xs text-kumkum">
          {state.message}
        </span>
      )}
    </form>
  );
}
