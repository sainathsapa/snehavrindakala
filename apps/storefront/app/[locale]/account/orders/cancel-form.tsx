"use client";

/**
 * The cancel button, and the question it asks first.
 *
 * Cancelling is irreversible from the buyer's side, so it is behind a confirm
 * step and a sentence that says exactly what will happen — including that a paid
 * order will be refunded by a person rather than instantly.
 */

import { useActionState, useState } from "react";
import { cancelOrderAction, type CancelOrderState } from "./actions";

export function CancelOrderForm({
  orderId,
  cancellable,
  labels,
}: {
  orderId: string;
  cancellable: boolean;
  labels: { cancel: string; confirm: string; working: string };
}) {
  const [asking, setAsking] = useState(false);
  const [state, formAction, pending] = useActionState<CancelOrderState | null, FormData>(
    cancelOrderAction,
    null
  );

  if (!cancellable && !state) return null;

  if (state) {
    return (
      <div className="w-full">
        <p
          className={`font-sans text-sm ${state.ok ? "text-leaf" : "text-kumkum"}`}
          role="status"
        >
          {state.message}
        </p>
        {state.refundNote && (
          <p className="mt-1 font-sans text-xs text-muted-ink">{state.refundNote}</p>
        )}
      </div>
    );
  }

  if (!asking) {
    return (
      <button
        type="button"
        onClick={() => setAsking(true)}
        className="font-sans text-sm text-muted-ink underline underline-offset-4 hover:text-kumkum"
      >
        {labels.cancel}
      </button>
    );
  }

  return (
    <form action={formAction} className="w-full">
      <input type="hidden" name="orderId" value={orderId} />
      <p className="font-sans text-sm text-deep-ink">{labels.confirm}</p>
      <div className="mt-2 flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-kumkum px-3 py-1.5 font-sans text-xs font-semibold text-rang-paper hover:bg-sindoor disabled:opacity-50"
        >
          {pending ? labels.working : labels.cancel}
        </button>
        <button
          type="button"
          onClick={() => setAsking(false)}
          className="font-sans text-xs text-muted-ink underline underline-offset-4"
        >
          Keep it
        </button>
      </div>
    </form>
  );
}
