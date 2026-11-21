import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  RAZORPAY_PROVIDER,
  SYSTEM_PROVIDER,
  checkoutProvider,
  razorpayProviderReady,
  razorpayProviderRequested,
} from "../lib/payment-provider";

/**
 * The switch between the checkout path that has run and the one that is tidier.
 *
 * Both create a Razorpay order, so the failure this guards against is not a
 * crash: it is one cart producing two orders, or a payment captured on a path
 * nobody has tested. The flag is off unless everything is present, and the
 * fallback is the path that has taken real money.
 */

const root = join(__dirname, "..");
const read = (path: string) => readFileSync(join(root, path), "utf8");

const FULL = {
  RAZORPAY_KEY_ID: "rzp_test_x",
  RAZORPAY_KEY_SECRET: "secret",
  RAZORPAY_WEBHOOK_SECRET: "whsec",
  CHECKOUT_RAZORPAY_PROVIDER: "1",
};

describe("razorpayProviderRequested", () => {
  it("opts in only on an explicit 1", () => {
    expect(razorpayProviderRequested({ CHECKOUT_RAZORPAY_PROVIDER: "1" })).toBe(true);
    expect(razorpayProviderRequested({ CHECKOUT_RAZORPAY_PROVIDER: " 1 " })).toBe(true);
  });

  it("treats anything else as off", () => {
    // "true", "yes" and "on" all read like consent but are not the documented
    // value; guessing at them is how a money path changes without a decision.
    for (const value of ["", "0", "true", "yes", "on", "01"]) {
      expect(
        razorpayProviderRequested({ CHECKOUT_RAZORPAY_PROVIDER: value })
      ).toBe(false);
    }
    expect(razorpayProviderRequested({})).toBe(false);
  });
});

describe("razorpayProviderReady", () => {
  it("needs keys and a verifiable webhook", () => {
    expect(razorpayProviderReady(FULL).ready).toBe(true);
    // Without a webhook secret the payment module cannot learn that a payment
    // was captured elsewhere, so the path is not "ready" in any useful sense.
    expect(
      razorpayProviderReady({ ...FULL, RAZORPAY_WEBHOOK_SECRET: "" }).missing
    ).toEqual(["RAZORPAY_WEBHOOK_SECRET"]);
  });

  it("accepts the public key spelling the browser bundle uses", () => {
    expect(
      razorpayProviderReady({
        NEXT_PUBLIC_RAZORPAY_KEY_ID: "rzp_test_x",
        RAZORPAY_KEY_SECRET: "secret",
        RAZORPAY_WEBHOOK_SECRET: "whsec",
      }).ready
    ).toBe(true);
  });

  it("names everything that is missing, not just the first", () => {
    expect(razorpayProviderReady({}).missing).toEqual([
      "RAZORPAY_KEY_ID",
      "RAZORPAY_KEY_SECRET",
      "RAZORPAY_WEBHOOK_SECRET",
    ]);
  });
});

describe("checkoutProvider", () => {
  it("uses the system provider by default", () => {
    const result = checkoutProvider({ RAZORPAY_KEY_ID: "x", RAZORPAY_KEY_SECRET: "y" });
    expect(result.providerId).toBe(SYSTEM_PROVIDER);
    expect(result.reason).toBe("system-default");
  });

  it("switches only when the flag and the configuration are both complete", () => {
    const result = checkoutProvider(FULL);
    expect(result.providerId).toBe(RAZORPAY_PROVIDER);
    expect(result.reason).toBe("razorpay");
  });

  it("falls back and says why when the flag is on but the setup is not", () => {
    const result = checkoutProvider({
      ...FULL,
      RAZORPAY_WEBHOOK_SECRET: "",
    });
    expect(result.providerId).toBe(SYSTEM_PROVIDER);
    expect(result.reason).toBe("flag-set-but-incomplete");
    expect(result.missing).toEqual(["RAZORPAY_WEBHOOK_SECRET"]);
  });
});

describe("the two routes agree on one provider", () => {
  const session = read("app/api/store/checkout/payment-session/route.ts");
  const complete = read("app/api/store/checkout/complete/route.ts");

  it("both ask the same helper", () => {
    expect(session).toContain("checkoutProvider()");
    expect(complete).toContain("checkoutProvider()");
  });

  it("completion passes the provider id, so no second session appears", () => {
    // A default-provider call here would attach a system session beside the
    // Razorpay one and cart completion would pick whichever it liked.
    expect(complete).toMatch(/ensurePaymentSession\(cart_id, provider\.providerId\)/);
    expect(session).toMatch(/ensurePaymentSession\(cart_id, provider\.providerId\)/);
  });

  it("the system path still creates the Razorpay order itself", () => {
    expect(session).toContain("api.razorpay.com/v1/orders");
    // ...and only on that path.
    expect(session).toMatch(/if \(provider\.providerId === RAZORPAY_PROVIDER\)/);
  });

  it("a flag set without the configuration logs instead of failing silently", () => {
    expect(session).toContain("flag-set-but-incomplete");
    expect(session).toMatch(/console\.warn/);
  });
});

describe("the switch is documented where an operator will look", () => {
  const docs = readFileSync(join(root, "..", "..", "docs", "DEPLOY.md"), "utf8");

  it("names the flag and its default", () => {
    expect(docs).toContain("CHECKOUT_RAZORPAY_PROVIDER");
    expect(docs).toMatch(/built and off|off by default|Not switched/i);
  });
});
