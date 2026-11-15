import { describe, expect, it } from "vitest";
import {
  COUNTRIES,
  INDIA_CITIES,
  REGIONS,
  citiesFor,
  countryByCode,
  postalInputMode,
  postalMaxLength,
  regionsFor,
  suggestRegion,
} from "../lib/location";
import {
  EMPTY_ADDRESS,
  composePhone,
  firstInvalidField,
  isBlank,
  localPhoneDigits,
  rankOptions,
  validateAddress,
  validatePhone,
  validatePostal,
} from "../lib/location/search";

describe("country list", () => {
  it("has a dial code and a postal label for every destination", () => {
    for (const country of COUNTRIES) {
      expect(country.name.length).toBeGreaterThan(0);
      expect(country.dialCode).toMatch(/^\d+$/);
      expect(country.postalLabel.length).toBeGreaterThan(0);
    }
  });

  it("resolves a code case-insensitively", () => {
    expect(countryByCode("IN")?.name).toBe("India");
    expect(countryByCode(" gb ")?.name).toBe("United Kingdom");
  });

  it("returns undefined for an unknown or empty code", () => {
    expect(countryByCode("zz")).toBeUndefined();
    expect(countryByCode("")).toBeUndefined();
    expect(countryByCode(null)).toBeUndefined();
  });
});

describe("regions depend on the country", () => {
  it("lists real Indian states and union territories", () => {
    const states = regionsFor("in");
    expect(states).toContain("Rajasthan");
    expect(states).toContain("Ladakh");
    // The modern spelling, not the retired one — this is what a courier reads.
    expect(states).toContain("Odisha");
    expect(states).not.toContain("Orissa");
  });

  it("does not leak one country's regions into another", () => {
    expect(regionsFor("us")).toContain("California");
    expect(regionsFor("us")).not.toContain("Rajasthan");
  });

  it("returns nothing for a country we cannot enumerate", () => {
    expect(regionsFor("zz")).toEqual([]);
    expect(regionsFor(undefined)).toEqual([]);
  });

  it("every region key belongs to a country we ship to", () => {
    const shipped = new Set(COUNTRIES.map((country) => country.code));
    for (const code of Object.keys(REGIONS)) {
      expect(shipped.has(code)).toBe(true);
    }
  });
});

describe("cities depend on the state", () => {
  it("lists cities for an Indian state", () => {
    expect(citiesFor("in", "Rajasthan")).toContain("Jaipur");
    expect(citiesFor("in", "Rajasthan")).toContain("Bikaner");
  });

  it("does not return another state's cities", () => {
    expect(citiesFor("in", "Kerala")).not.toContain("Jaipur");
  });

  it("returns nothing for a state with no curated list, so the field is free text", () => {
    expect(citiesFor("in", "Not A State")).toEqual([]);
    expect(citiesFor("us", "California")).toEqual([]);
    expect(citiesFor(undefined, "Rajasthan")).toEqual([]);
  });

  it("every city list belongs to a region that exists", () => {
    const states = new Set(REGIONS.in);
    for (const state of Object.keys(INDIA_CITIES)) {
      expect(states.has(state)).toBe(true);
      expect(INDIA_CITIES[state].length).toBeGreaterThan(0);
    }
  });
});

describe("suggestRegion", () => {
  it("reads the Indian postal circle from the first two digits", () => {
    expect(suggestRegion("in", "302001")).toBe("Rajasthan");
    expect(suggestRegion("in", "110001")).toBe("Delhi");
    expect(suggestRegion("in", "560001")).toBe("Karnataka");
    expect(suggestRegion("in", "700001")).toBe("West Bengal");
  });

  it("refuses to guess from an incomplete or invalid PIN", () => {
    expect(suggestRegion("in", "302")).toBeUndefined();
    expect(suggestRegion("in", "002001")).toBeUndefined();
    expect(suggestRegion("in", "")).toBeUndefined();
  });

  it("reads a US ZIP prefix", () => {
    expect(suggestRegion("us", "10001")).toBe("New York");
    expect(suggestRegion("us", "90001")).toBe("California");
  });

  it("returns nothing for countries without a reliable mapping", () => {
    expect(suggestRegion("gb", "SW1A 1AA")).toBeUndefined();
    expect(suggestRegion("de", "10115")).toBeUndefined();
  });

  it("only ever suggests a region that is actually listed for the country", () => {
    const states = new Set(regionsFor("in"));
    for (const code of ["110001", "302001", "560001", "700001", "841301", "190001"]) {
      const region = suggestRegion("in", code);
      if (region) expect(states.has(region)).toBe(true);
    }
  });
});

describe("postal input helpers", () => {
  it("caps the length to the destination's format", () => {
    expect(postalMaxLength("in")).toBe(6);
    expect(postalMaxLength("us")).toBe(5);
    expect(postalMaxLength("gb")).toBe(8);
  });

  it("uses a numeric keypad only for numeric formats", () => {
    expect(postalInputMode("in")).toBe("numeric");
    expect(postalInputMode("gb")).toBe("text");
    expect(postalInputMode("ca")).toBe("text");
  });
});

describe("rankOptions", () => {
  const options = ["Jaipur", "Jaisalmer", "Jodhpur", "New York", "Udaipur", "Jammu"];

  it("puts an exact match first", () => {
    expect(rankOptions(options, "jaipur")[0]).toBe("Jaipur");
  });

  it("puts prefix matches before interior matches", () => {
    const ranked = rankOptions(options, "jai");
    expect(ranked.slice(0, 2)).toEqual(["Jaipur", "Jaisalmer"]);
    expect(ranked).not.toContain("Udaipur");
  });

  it("matches a later word, so 'york' finds New York", () => {
    expect(rankOptions(options, "york")).toEqual(["New York"]);
  });

  it("is case and accent insensitive", () => {
    expect(rankOptions(["Île-de-France", "Brittany"], "ile")).toEqual(["Île-de-France"]);
  });

  it("returns an empty list when nothing matches", () => {
    expect(rankOptions(options, "zzz")).toEqual([]);
  });

  it("returns the list unchanged when the query is empty", () => {
    expect(rankOptions(options, "")).toEqual(options);
  });

  it("respects the limit", () => {
    expect(rankOptions(options, "", 2)).toHaveLength(2);
  });
});

describe("validatePhone", () => {
  it("accepts real lengths with punctuation", () => {
    expect(validatePhone("+91 98765 43210")).toBeNull();
    expect(validatePhone("(212) 555-0100")).toBeNull();
  });

  it("rejects an empty, too short or too long number", () => {
    expect(validatePhone("")).toMatch(/enter a phone/i);
    expect(validatePhone("123")).toMatch(/too short/i);
    expect(validatePhone("1234567890123456789")).toMatch(/too long/i);
  });
});

describe("validatePostal", () => {
  it("accepts each supported format", () => {
    expect(validatePostal("302001", "in")).toBeNull();
    expect(validatePostal("10001", "us")).toBeNull();
    expect(validatePostal("K1A 0B1", "ca")).toBeNull();
    expect(validatePostal("SW1A 1AA", "gb")).toBeNull();
    expect(validatePostal("1012 AB", "nl")).toBeNull();
  });

  it("rejects an Indian PIN starting with zero or too short", () => {
    expect(validatePostal("002001", "in")).toMatch(/six digits/i);
    expect(validatePostal("302", "in")).toMatch(/six digits/i);
  });

  it("names the destination's own label in the empty-field message", () => {
    expect(validatePostal("", "gb")).toMatch(/postcode/i);
    expect(validatePostal("", "in")).toMatch(/pin code/i);
  });

  it("accepts anything non-empty for a country whose format we do not know", () => {
    expect(validatePostal("whatever", "zz")).toBeNull();
  });
});

describe("validateAddress", () => {
  const valid = {
    full_name: "Sneha Sapa",
    email: "sneha@example.com",
    phone: "+919876543210",
    country_code: "in",
    postal_code: "302001",
    province: "Rajasthan",
    city: "Jaipur",
    address_1: "12 MI Road, near Panch Batti",
    address_2: "",
  };

  it("accepts a complete address", () => {
    expect(validateAddress(valid)).toEqual({});
  });

  it("treats the second line as optional", () => {
    expect(validateAddress({ ...valid, address_2: "" })).toEqual({});
  });

  it("reports every missing field, not just the first", () => {
    const errors = validateAddress({ ...EMPTY_ADDRESS });
    expect(Object.keys(errors).sort()).toEqual(
      ["address_1", "city", "country_code", "email", "full_name", "phone", "postal_code", "province"].sort()
    );
  });

  it("rejects a malformed email", () => {
    expect(validateAddress({ ...valid, email: "sneha@example" }).email).toBeTruthy();
    expect(validateAddress({ ...valid, email: "a b@c.com" }).email).toBeTruthy();
  });

  it("rejects a too-short street line", () => {
    expect(validateAddress({ ...valid, address_1: "12" }).address_1).toMatch(/house or building/i);
  });

  it("rejects a country we do not ship to", () => {
    expect(validateAddress({ ...valid, country_code: "zz" }).country_code).toBeTruthy();
  });
});

describe("firstInvalidField", () => {
  it("returns the top-most field in visual order", () => {
    const errors = { city: "x", postal_code: "y", full_name: "z" };
    expect(firstInvalidField(errors)).toBe("full_name");
  });

  it("returns null when there is nothing wrong", () => {
    expect(firstInvalidField({})).toBeNull();
  });
});

describe("phone composition", () => {
  it("adds the country calling code", () => {
    expect(composePhone("9876543210", "91")).toBe("+919876543210");
  });

  it("does not double the code when it was typed in", () => {
    const digits = localPhoneDigits("+91 98765 43210", "91");
    expect(digits).toBe("9876543210");
    expect(composePhone(digits, "91")).toBe("+919876543210");
  });

  it("leaves a number alone when we have no dial code", () => {
    expect(composePhone("5550100", "")).toBe("5550100");
  });
});

describe("isBlank", () => {
  it("is true for an untouched form", () => {
    expect(isBlank(EMPTY_ADDRESS)).toBe(true);
  });

  it("is false as soon as anything is typed", () => {
    expect(isBlank({ ...EMPTY_ADDRESS, city: "Jaipur" })).toBe(false);
  });
});
