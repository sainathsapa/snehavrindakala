/**
 * Picks the courier to charge for, given the rates we quoted and the customer's
 * choice. Extracted from the payment-session route so it can be tested without
 * hitting Shiprocket or Razorpay.
 */

export interface QuotedRate {
  courier_name: string;
  service_name: string;
  rate: number;
  expected_delivery: string;
}

export interface RequestedRate {
  courier_name: string;
  service_name?: string;
  rate?: number;
}

/**
 * The customer's pick wins only when it matches a rate we quoted for this PIN.
 * Everything else falls back to the cheapest option so checkout never blocks,
 * and a client can never talk us into a price we did not quote.
 */
export function selectShippingRate(
  quoted: QuotedRate[],
  requested?: RequestedRate | null
): QuotedRate | undefined {
  if (quoted.length === 0) return undefined;

  // Never rely on the caller having sorted the rates.
  const cheapest = quoted.reduce((lowest, rate) =>
    rate.rate < lowest.rate ? rate : lowest
  );

  if (!requested) return cheapest;

  const exact = quoted.find(
    (rate) =>
      rate.courier_name === requested.courier_name &&
      rate.service_name === requested.service_name &&
      rate.rate === Number(requested.rate)
  );
  if (exact) return exact;

  // Same courier, possibly a different service tier: use our own quote.
  const sameCourier = quoted.find(
    (rate) => rate.courier_name === requested.courier_name
  );
  if (sameCourier) return sameCourier;

  return cheapest;
}

/* ─────────────────────────────────────────────────────────────────────────
 * Which radio the checkout should have ticked.
 *
 * A separate concern from `selectShippingRate` above, which decides what the
 * server may *charge*. This one only decides what the buyer sees highlighted,
 * and it exists because of a real bug: the courier quotes do not exist until a
 * delivery address is on the cart, so the island's `useState` initialiser ran
 * against an empty list and settled on "". The quotes arrived later, after the
 * address was saved and the page refreshed — but an initialiser never runs
 * twice, so nothing was ever selected. Every radio rendered unchecked, shipping
 * displayed "Free" beside quotes of ₹99–₹118, and the displayed total was
 * silently lower than the amount that would be charged.
 * ───────────────────────────────────────────────────────────────────────── */

export const rateKeyOf = (rate: QuotedRate): string =>
  `${rate.courier_name}::${rate.service_name}`;

/** Cheapest quote; ties break on the key so the result is deterministic. */
export function cheapestRateKey(rates: QuotedRate[]): string {
  if (rates.length === 0) return "";
  const cheapest = rates
    .slice()
    .sort((a, b) => a.rate - b.rate || rateKeyOf(a).localeCompare(rateKeyOf(b)))[0];
  return rateKeyOf(cheapest);
}

/**
 * The key that should be selected.
 *
 * A choice the buyer made is kept as long as it is still offered. When the
 * available set changes and the current key is gone — typically the first time
 * quotes arrive — fall back to the cheapest.
 */
export function resolveSelectedRate(
  rates: QuotedRate[],
  current: string
): string {
  if (rates.length === 0) return "";
  const stillOffered = rates.some((rate) => rateKeyOf(rate) === current);
  return stillOffered ? current : cheapestRateKey(rates);
}
