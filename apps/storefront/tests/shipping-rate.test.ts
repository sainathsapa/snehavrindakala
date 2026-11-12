/**
 * Shipping-rate selection.
 *
 * The checkout used to display the customer's chosen courier but charge the
 * cheapest one, because the selection never reached the payment session. These
 * tests pin down the rule that extraction should follow: the customer's choice
 * wins, but only when it is a rate we actually quoted for that PIN.
 */

import { describe, expect, it } from "vitest";
import { selectShippingRate } from "../lib/shipping/select-rate";

const RATES = [
  { courier_name: "Bluedart", service_name: "Air", rate: 12_000, expected_delivery: "2 days" },
  { courier_name: "Delhivery", service_name: "Surface", rate: 4_500, expected_delivery: "5 days" },
];

describe("selectShippingRate", () => {
  it("honours the customer's choice over the cheapest option", () => {
    const result = selectShippingRate(RATES, {
      courier_name: "Bluedart",
      service_name: "Air",
      rate: 12_000,
    });
    expect(result?.courier_name).toBe("Bluedart");
    expect(result?.rate).toBe(12_000);
  });

  it("falls back to the cheapest rate when nothing was chosen", () => {
    const result = selectShippingRate(RATES, null);
    expect(result?.courier_name).toBe("Delhivery");
  });

  it("ignores a claimed price that was not quoted", () => {
    // A tampered request asking for ₹0 on Bluedart must not be accepted: the
    // quoted amount for that courier is used instead.
    const result = selectShippingRate(RATES, {
      courier_name: "Bluedart",
      service_name: "Air",
      rate: 0,
    });
    expect(result?.rate).toBe(12_000);
  });

  it("ignores a courier we never quoted", () => {
    const result = selectShippingRate(RATES, {
      courier_name: "FreeShippingExpress",
      service_name: "Instant",
      rate: 0,
    });
    expect(result?.courier_name).toBe("Delhivery");
  });

  it("returns undefined when there is nothing to pick", () => {
    expect(selectShippingRate([], null)).toBeUndefined();
  });
});
