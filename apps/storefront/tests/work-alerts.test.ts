import { describe, expect, it } from "vitest";
import { matchesWork, normaliseArtForm, parsePriceMax } from "../lib/work-alerts";

/**
 * The matching rule is the only part of the alert feature that can be wrong
 * quietly: an over-eager match mails someone about a work they cannot afford or
 * did not ask for, and an under-eager one silently never mails anyone.
 *
 * Everything else is a form and a table, so the tests live here.
 */
describe("matchesWork", () => {
  const madhubani = { artForms: ["madhubani"], price: 18000 };

  it("matches on tradition and budget together", () => {
    expect(matchesWork({ art_form: "madhubani", price_max: 25000 }, madhubani)).toBe(true);
  });

  it("does not match a different tradition", () => {
    expect(matchesWork({ art_form: "patachitra", price_max: 25000 }, madhubani)).toBe(false);
  });

  it("treats an empty tradition as 'anything', not as 'nothing'", () => {
    expect(matchesWork({ art_form: "", price_max: null }, madhubani)).toBe(true);
    expect(matchesWork({ art_form: "", price_max: 25000 }, madhubani)).toBe(true);
  });

  it("excludes a work above the stated budget rather than rounding it in", () => {
    expect(matchesWork({ art_form: "madhubani", price_max: 17000 }, madhubani)).toBe(false);
    expect(matchesWork({ art_form: "madhubani", price_max: 18000 }, madhubani)).toBe(true);
  });

  it("treats a missing budget as no limit", () => {
    expect(matchesWork({ art_form: "madhubani", price_max: null }, madhubani)).toBe(true);
  });

  it("does not match an unpriced work to a budgeted alert", () => {
    // The price is unknown, so we cannot say it fits. Better to stay quiet.
    expect(
      matchesWork({ art_form: "", price_max: 25000 }, { artForms: [], price: null })
    ).toBe(false);
    // With no budget, an unpriced work is still a possible fit.
    expect(
      matchesWork({ art_form: "", price_max: null }, { artForms: [], price: null })
    ).toBe(true);
  });
});

describe("parsePriceMax", () => {
  it("keeps a positive number and rounds it", () => {
    expect(parsePriceMax(25000)).toBe(25000);
    expect(parsePriceMax("25000.4")).toBe(25000);
    expect(parsePriceMax("₹25,000")).toBe(25000);
  });

  it("treats blank and nonsense as 'no limit', never as zero", () => {
    // Zero would silently match nothing, which reads as a working filter.
    for (const value of ["", null, undefined, "abc", 0, -5]) {
      expect(parsePriceMax(value)).toBeNull();
    }
  });
});

describe("normaliseArtForm", () => {
  it("lowercases and strips characters a slug cannot contain", () => {
    expect(normaliseArtForm("  Madhubani ")).toBe("madhubani");
    expect(normaliseArtForm("Pattachitra/Patua")).toBe("pattachitrapatua");
    expect(normaliseArtForm("phad-painting")).toBe("phad-painting");
  });

  it("returns an empty string for anything that is not a string", () => {
    expect(normaliseArtForm(null)).toBe("");
    expect(normaliseArtForm(7)).toBe("");
  });
});
