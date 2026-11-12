/**
 * Price formatting tests.
 *
 * formatPrice is used on every product, cart and order line. It previously
 * hard-coded "INR" as the default currency, so changing MEDUSA_CURRENCY_CODE
 * left prices labelled in rupees, and an invalid currency code threw a
 * RangeError that took down whatever page was rendering.
 */

import { describe, expect, it } from "vitest";
import { formatPrice } from "../lib/medusa";

describe("formatPrice", () => {
  it("formats minor units as a currency amount", () => {
    expect(formatPrice(125000, "INR")).toContain("1,250");
  });

  it("returns a label for a missing amount rather than NaN", () => {
    expect(formatPrice(null)).toBe("Price on request");
    expect(formatPrice(undefined)).toBe("Price on request");
  });

  it("formats zero as a real amount, not as missing", () => {
    // A free item or a fully discounted line is 0, not "on request".
    const formatted = formatPrice(0, "INR");
    expect(formatted).not.toBe("Price on request");
    expect(formatted).toContain("0");
  });

  it("does not throw on an invalid currency code", () => {
    expect(() => formatPrice(1000, "NOT_A_CURRENCY")).not.toThrow();
    expect(formatPrice(1000, "NOT_A_CURRENCY")).toContain("10");
  });

  it("honours a non-INR currency", () => {
    expect(formatPrice(100000, "USD")).toContain("1,000");
  });
});
