import { describe, expect, it } from "vitest";
import {
  EMPTY_BILLING,
  isBlankBilling,
  validateBilling,
  type BillingAddress,
} from "@/lib/location/search";

const complete: BillingAddress = {
  full_name: "Sneha Sapa",
  country_code: "in",
  postal_code: "302001",
  province: "Rajasthan",
  city: "Jaipur",
  address_1: "12 MI Road",
  address_2: "",
};

describe("validateBilling", () => {
  it("accepts a complete billing address", () => {
    expect(validateBilling(complete)).toEqual({});
  });

  it("requires the party the invoice is made out to", () => {
    expect(validateBilling({ ...complete, full_name: "  " }).full_name).toBeTruthy();
  });

  it("requires a street address", () => {
    expect(validateBilling({ ...complete, address_1: "" }).address_1).toBeTruthy();
  });

  it("requires a city", () => {
    expect(validateBilling({ ...complete, city: "" }).city).toBeTruthy();
  });

  it("rejects a country we do not know", () => {
    expect(validateBilling({ ...complete, country_code: "zz" }).country_code).toBeTruthy();
  });

  it("does not demand a postal code", () => {
    // A registered office abroad may bill without one; blocking the order for
    // it would be worse than an invoice with a blank field.
    expect(validateBilling({ ...complete, postal_code: "" }).postal_code).toBeUndefined();
  });

  it("does not demand a province", () => {
    expect(validateBilling({ ...complete, province: "" }).province).toBeUndefined();
  });

  it("reports every problem at once, not just the first", () => {
    const errors = validateBilling(EMPTY_BILLING);
    expect(Object.keys(errors).sort()).toEqual([
      "address_1",
      "city",
      "country_code",
      "full_name",
    ]);
  });
});

describe("isBlankBilling", () => {
  it("is true for an untouched block", () => {
    expect(isBlankBilling(EMPTY_BILLING)).toBe(true);
  });

  it("treats whitespace as empty", () => {
    expect(isBlankBilling({ ...EMPTY_BILLING, city: "   " })).toBe(true);
  });

  it("is false once anything is typed", () => {
    expect(isBlankBilling({ ...EMPTY_BILLING, city: "Jaipur" })).toBe(false);
  });
});
