"use client";

import { useEffect, useState, useTransition } from "react";
import { lookupPincodeAction } from "@/app/[locale]/checkout/pincode-action";

/**
 * Fills city and state from the PIN code as the buyer types.
 *
 * The two fields stay editable — this is a convenience, not a lock. The India
 * Post lookup is a third-party service; when it is down or a PIN is unassigned,
 * the buyer types city and state themselves, exactly as before.
 *
 * The action is a server action rather than a `fetch` from here so the request
 * keeps the site's origin and no third-party URL appears in the client bundle.
 */
export function PincodeAutofill({
  pinName = "postal_code",
  cityName = "city",
  stateName = "state",
  initialPin,
}: {
  pinName?: string;
  cityName?: string;
  stateName?: string;
  initialPin?: string;
}) {
  const [pin, setPin] = useState(initialPin ?? "");
  const [status, setStatus] = useState<"idle" | "found" | "unknown" | "error">(
    "idle"
  );
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!/^[1-9][0-9]{5}$/.test(pin)) {
      setStatus("idle");
      return;
    }

    // Debounce: a buyer typing six digits would otherwise fire up to six
    // lookups, the first four of which cannot succeed.
    const timer = setTimeout(() => {
      startTransition(async () => {
        try {
          const result = await lookupPincodeAction(pin);
          if (!result) {
            setStatus("unknown");
            return;
          }

          // Scope to this input's own form. `document.querySelector("form")`
          // returns the first form in the document, which is a search or
          // newsletter form in the header/footer, not the checkout form — the
          // lookup succeeded but wrote city and state into a form the buyer
          // never sees.
          const form = (document.getElementById(pinName) as HTMLInputElement
            | null)?.form;
          const city = form?.querySelector<HTMLInputElement>(
            `input[name="${cityName}"]`
          );
          const state = form?.querySelector<HTMLInputElement>(
            `input[name="${stateName}"]`
          );

          // Only overwrite a value the buyer has not changed; re-typing a PIN
          // should not silently discard a city they typed deliberately.
          if (city && (!city.value || city.dataset.autofilled === "1")) {
            city.value = result.city;
            city.dataset.autofilled = "1";
          }
          if (state && (!state.value || state.dataset.autofilled === "1")) {
            state.value = result.state;
            state.dataset.autofilled = "1";
          }
          setStatus("found");
        } catch {
          setStatus("error");
        }
      });
    }, 400);

    return () => clearTimeout(timer);
  }, [pin, cityName, stateName]);

  return (
    <div>
      <label
        htmlFor={pinName}
        className="mb-1 block text-sm font-medium text-deep-ink"
      >
        PIN code
      </label>
      <input
        id={pinName}
        name={pinName}
        type="text"
        inputMode="numeric"
        autoComplete="postal-code"
        maxLength={6}
        required
        value={pin}
        onChange={(event) => {
          const next = event.target.value.replace(/[^0-9]/g, "").slice(0, 6);
          setPin(next);
          // A changed PIN invalidates the auto-filled district and state.
          const form = (event.target as HTMLInputElement).form;
          for (const name of [cityName, stateName]) {
            const input = form?.querySelector<HTMLInputElement>(
              `input[name="${name}"]`
            );
            if (input?.dataset.autofilled === "1") {
              input.value = "";
              delete input.dataset.autofilled;
            }
          }
        }}
        className="w-full rounded-md border border-sand-border bg-surface px-3 py-2 text-sm text-deep-ink focus:outline-none focus:ring-2 focus:ring-sindoor"
        aria-describedby="pincode-hint"
      />
      <p id="pincode-hint" className="mt-1 text-xs text-muted-ink">
        {isPending
          ? "Looking up your PIN…"
          : status === "found"
            ? "City and state filled in."
            : status === "unknown"
              ? "We did not recognise this PIN. Please fill in city and state."
              : status === "error"
                ? "Lookup unavailable. Please fill in city and state."
                : "Six digits. We will fill in your city and state."}
      </p>
    </div>
  );
}
