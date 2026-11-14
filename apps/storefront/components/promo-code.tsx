"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { applyPromoCodeAction, type CartActionResult } from "@/app/[locale]/cart/actions";

/**
 * Promotion code entry.
 *
 * Kept as its own client component so the rest of the cart stays server
 * rendered: only the code field and its feedback need state, and shipping the
 * whole cart to the browser to support that would be a needless cost.
 *
 * Feedback is announced via role="status"/"alert" rather than colour alone, so
 * a rejected code is not silent to a screen reader.
 */
export function PromoCode({
  applied = [],
}: {
  applied?: string[];
}) {
  const t = useTranslations("cart");
  const [state, formAction, pending] = useActionState<CartActionResult | null, FormData>(
    applyPromoCodeAction,
    null
  );

  return (
    <div className="mt-6 rounded-lg border border-sand-border bg-surface/60 p-4">
      <form action={formAction} className="flex flex-wrap items-end gap-3">
        <label className="grid flex-1 gap-1.5 font-sans text-sm">
          <span className="font-medium text-deep-ink">{t("haveCode")}</span>
          <input
            name="code"
            type="text"
            autoComplete="off"
            spellCheck={false}
            placeholder="WELCOME10"
            className="w-full rounded-md border border-sand-border bg-surface px-3 py-2 font-sans text-sm uppercase tracking-wide text-deep-ink focus:outline-none focus:ring-2 focus:ring-sindoor"
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md border border-sindoor px-4 py-2 font-sans text-sm font-medium text-sindoor transition-colors hover:bg-sindoor hover:text-rang-paper disabled:opacity-50"
        >
          {pending ? t("checking") : t("apply")}
        </button>
      </form>

      {state && (
        <p
          role={state.ok ? "status" : "alert"}
          className={`mt-3 font-sans text-sm ${
            state.ok ? "text-leaf" : "text-sindoor"
          }`}
        >
          {state.message}
        </p>
      )}

      {applied.length > 0 && (
        <p className="mt-3 font-sans text-sm text-leaf">
          {t("codeApplied", { codes: applied.join(", ") })}
        </p>
      )}
    </div>
  );
}
