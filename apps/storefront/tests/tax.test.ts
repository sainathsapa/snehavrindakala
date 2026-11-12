/**
 * GST unit tests.
 *
 * These exist because the previous implementation shipped two silent tax bugs:
 * prices were treated as exclusive when they are inclusive, and the home state
 * was hard-coded to "MH" so almost every order took the IGST branch.
 */

import { describe, expect, it } from "vitest";
import {
  calculateTax,
  normaliseState,
  taxLabel,
  DEFAULT_GST_RATE,
  DEFAULT_HOME_STATE,
} from "../lib/tax";

describe("calculateTax", () => {
  it("extracts tax from a GST-inclusive amount", () => {
    // ₹1050 inclusive at 5% => ₹50 tax, ₹1000 taxable
    const result = calculateTax(105_000);
    expect(result.total).toBe(105_000);
    expect(result.total_tax).toBe(5_000);
    expect(result.taxable_amount).toBe(100_000);
  });

  it("splits tax evenly between CGST and SGST for a home-state order", () => {
    const result = calculateTax(105_000, DEFAULT_HOME_STATE);
    expect(result.is_inter_state).toBe(false);
    expect(result.igst).toBe(0);
    expect(result.cgst + result.sgst).toBe(result.total_tax);
    expect(Math.abs(result.cgst - result.sgst)).toBeLessThanOrEqual(1);
  });

  it("uses IGST for an out-of-state order", () => {
    const result = calculateTax(105_000, "Maharashtra");
    expect(result.is_inter_state).toBe(true);
    expect(result.cgst).toBe(0);
    expect(result.sgst).toBe(0);
    expect(result.igst).toBe(result.total_tax);
  });

  it("never produces a taxable amount above the gross amount", () => {
    for (const amount of [0, 1, 999, 100_000, 9_999_999]) {
      const result = calculateTax(amount);
      expect(result.taxable_amount + result.total_tax).toBe(amount);
      expect(result.taxable_amount).toBeLessThanOrEqual(amount);
    }
  });

  it("treats a missing state as a home-state sale", () => {
    // Without an address we cannot prove an inter-state supply, so the safer
    // default is intra-state rather than guessing IGST.
    const result = calculateTax(105_000, null);
    expect(result.is_inter_state).toBe(false);
  });

  it("is insensitive to state casing and whitespace", () => {
    const a = calculateTax(105_000, "karnataka");
    const b = calculateTax(105_000, "  KARNATAKA  ");
    const c = calculateTax(105_000, DEFAULT_HOME_STATE);
    expect(a.is_inter_state).toBe(c.is_inter_state);
    expect(b.is_inter_state).toBe(c.is_inter_state);
  });

  it("handles negative and non-finite input without throwing", () => {
    expect(calculateTax(-500).total).toBe(0);
    expect(calculateTax(NaN).total).toBe(0);
    expect(calculateTax(Infinity).total).toBe(0);
  });

  it("respects a custom rate", () => {
    // ₹1180 inclusive at 18% => ₹180 tax
    const result = calculateTax(118_000, DEFAULT_HOME_STATE, { gstRate: 18 });
    expect(result.total_tax).toBe(18_000);
    expect(result.taxable_amount).toBe(100_000);
  });
});

describe("normaliseState", () => {
  it("trims, lowercases and tolerates undefined", () => {
    expect(normaliseState("  Karnataka ")).toBe("karnataka");
    expect(normaliseState(undefined)).toBe("");
    expect(normaliseState(null)).toBe("");
  });
});

describe("taxLabel", () => {
  it("describes the split for the applied rate", () => {
    const intra = calculateTax(105_000, DEFAULT_HOME_STATE);
    expect(taxLabel(intra)).toBe(`CGST ${DEFAULT_GST_RATE / 2}% + SGST ${DEFAULT_GST_RATE / 2}%`);

    const inter = calculateTax(105_000, "Maharashtra");
    expect(taxLabel(inter)).toBe(`IGST ${DEFAULT_GST_RATE}%`);
  });
});
