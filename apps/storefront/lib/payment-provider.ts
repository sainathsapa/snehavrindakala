/**
 * Which payment provider completes a checkout.
 *
 * Two paths exist in this codebase and only one of them has ever run against
 * real money:
 *
 * - **`pp_system_default`** (the default). The storefront creates the Razorpay
 *   order itself in `/api/store/checkout/payment-session`, the buyer pays in the
 *   browser, and `/api/store/checkout/complete` verifies the signature and reads
 *   the payment back from Razorpay before completing the cart. Medusa's payment
 *   module is only used to satisfy cart completion.
 * - **`pp_razorpay_razorpay`**. Medusa's payment module owns the session: the
 *   provider creates the Razorpay order at session init and `authorizePayment`
 *   reads it back during cart completion.
 *
 * The second is the tidier design and the reason the provider was ported to v2.
 * It is also the one nobody has run end to end: both paths would create a
 * Razorpay order, and switching without a sandbox run is how a shop charges twice
 * or charges nothing. So the switch is a flag, off by default, and it refuses to
 * turn on unless everything it needs is present — a half-enabled money path is
 * worse than either version.
 *
 * `CHECKOUT_RAZORPAY_PROVIDER=1` opts in. Nothing else changes it; there is no
 * auto-detection, because "the keys are set" is not evidence that the flow has
 * been tested.
 */

export const SYSTEM_PROVIDER = "pp_system_default";
export const RAZORPAY_PROVIDER = "pp_razorpay_razorpay";

export interface ProviderEnv {
  [key: string]: string | undefined;
}

/**
 * Whether the Razorpay provider path has everything it needs.
 *
 * The webhook secret is part of the requirement, not an extra: on this path the
 * payment module is the thing that learns a payment captured, and without a
 * verifiable webhook it learns it only if the browser comes back.
 */
export function razorpayProviderReady(env: ProviderEnv = process.env): {
  ready: boolean;
  missing: string[];
} {
  const missing: string[] = [];
  if (!(env.RAZORPAY_KEY_ID || env.NEXT_PUBLIC_RAZORPAY_KEY_ID)) {
    missing.push("RAZORPAY_KEY_ID");
  }
  if (!env.RAZORPAY_KEY_SECRET) missing.push("RAZORPAY_KEY_SECRET");
  if (!env.RAZORPAY_WEBHOOK_SECRET) missing.push("RAZORPAY_WEBHOOK_SECRET");
  return { ready: missing.length === 0, missing };
}

/** Is the flag set? Read literally: only "1" opts in. */
export function razorpayProviderRequested(env: ProviderEnv = process.env): boolean {
  return (env.CHECKOUT_RAZORPAY_PROVIDER || "").trim() === "1";
}

/**
 * The provider id checkout should use.
 *
 * Returns the system provider whenever the flag is off *or* the Razorpay path is
 * not fully configured, and reports which case it is so the caller can log it. A
 * checkout that silently falls back must say so in the log, otherwise the flag
 * looks like it works.
 */
export function checkoutProvider(env: ProviderEnv = process.env): {
  providerId: string;
  reason: "system-default" | "razorpay" | "flag-set-but-incomplete";
  missing: string[];
} {
  if (!razorpayProviderRequested(env)) {
    return { providerId: SYSTEM_PROVIDER, reason: "system-default", missing: [] };
  }
  const { ready, missing } = razorpayProviderReady(env);
  if (!ready) {
    return { providerId: SYSTEM_PROVIDER, reason: "flag-set-but-incomplete", missing };
  }
  return { providerId: RAZORPAY_PROVIDER, reason: "razorpay", missing: [] };
}
