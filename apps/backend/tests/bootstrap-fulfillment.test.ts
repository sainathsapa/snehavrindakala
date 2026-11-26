/**
 * The bootstrap seed is what turns an empty database into a shop, and it runs in
 * a container where nobody is watching. These are source-level assertions about
 * the two mistakes it has actually made:
 *
 *   1. registering a payment provider by brand name (`"razorpay"`) instead of by
 *      module id, so the region silently ended up with no provider at all;
 *   2. linking only one fulfilment provider to the stock location, which left
 *      Shiprocket enabled at provider level and unusable at location level — an
 *      admin could not create a Shiprocket fulfilment by hand, and nothing said
 *      why.
 *
 * A seed that half-provisions is worse than one that fails: the shop looks
 * ready. These checks are cheap and they pin the specific shapes.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const script = readFileSync(
  join(__dirname, "../scripts/bootstrap-store.mjs"),
  "utf8"
);

describe("bootstrap fulfilment wiring", () => {
  it("links every enabled provider to the stock location, not just one", () => {
    // The bug: a single `add: [providerId]` call.
    expect(script).toMatch(/const missing = providers\.filter/);
    expect(script).toMatch(/body: \{ add: missing \}/);
    expect(script).not.toMatch(/body: \{ add: \[providerId\] \}/);
  });

  it("only adds links that are missing, so re-running the seed is safe", () => {
    expect(script).toMatch(/\*fulfillment_providers/);
    expect(script).toMatch(/linked\.has\(id\)/);
  });

  it("matches provider ids by name, not by an `fp_` prefix Medusa no longer emits", () => {
    expect(script).not.toMatch(/startsWith\("fp_manual"\)/);
    expect(script).toMatch(/providers\.find\(\(p\) => p\.includes\("manual"\)\)/);
  });

  it("creates a priced cart-completion option that an automatic promotion discounts", () => {
    // Shipping is free, but not by quoting zero: the customer sees the courier
    // rate and then a matching automatic discount, so the generosity is visible
    // and refunds/invoices stay consistent with the charge.
    expect(script).toMatch(/provider_id: providerId/);
    expect(script).toMatch(/price_type: "flat"/);
    expect(script).toMatch(/amount: FLAT_SHIPPING_PAISE/);
    expect(script).not.toMatch(/prices: \[\{ currency_code: CURRENCY, amount: 0 \}\]/);
  });

  it("provisions the free-shipping promotion the discounted rate depends on", () => {
    expect(script).toMatch(/async function ensureFreeShippingPromotion/);
    expect(script).toMatch(/is_automatic: true/);
    expect(script).toMatch(/target_type: "shipping_methods"/);
    // Medusa rejects `allocation: each` without max_quantity.
    expect(script).toMatch(/allocation: "each"/);
    expect(script).toMatch(/max_quantity: 1/);
    // A stale discount would charge for shipping again after an edit.
    expect(script).toMatch(/status: "active"/);
  });

  it("takes payment providers from what the modules registered, not from brand names", () => {
    // The bug: a hard-coded ["razorpay"], which is not a provider id, so the
    // region was created with no payment provider and the shop only worked
    // because the storefront asks for pp_system_default by name.
    expect(script).toMatch(/SELECT id FROM payment_provider WHERE is_enabled = true/);
    expect(script).not.toMatch(/payment_providers: \["razorpay"\]/);
    // And it reconciles an existing region instead of returning early, because
    // the seed re-runs on every deploy.
    expect(script).toMatch(/missing\.length\) update\.payment_providers/);
  });
});
