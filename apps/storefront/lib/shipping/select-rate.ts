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
