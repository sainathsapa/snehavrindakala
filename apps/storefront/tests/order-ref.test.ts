import { describe, expect, it } from "vitest";
import {
  formatOrderRef,
  makeOrderRef,
  normalizeOrderRef,
} from "../lib/order-ref";

describe("order reference", () => {
  it("is twelve Crockford characters", () => {
    for (let i = 0; i < 200; i += 1) {
      expect(makeOrderRef()).toMatch(/^[0-9ABCDEFGHJKMNPQRSTVWXYZ]{12}$/);
    }
  });

  it("never contains the characters people mistype", () => {
    const forbidden = /[ILOU]/;
    for (let i = 0; i < 200; i += 1) {
      expect(forbidden.test(makeOrderRef())).toBe(false);
    }
  });

  it("does not repeat over many draws", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 2000; i += 1) seen.add(makeOrderRef());
    // 60 bits: a collision in 2000 draws would mean the generator is broken,
    // not unlucky.
    expect(seen.size).toBe(2000);
  });

  it("formats for reading aloud", () => {
    // Three characters per group: short enough to say over the phone, long
    // enough that the code still reads as one thing.
    expect(formatOrderRef("7Q4K2M9DRX3P")).toBe("SV-7Q4-K2M-9DR-X3P");
  });

  it("accepts a reference the way people actually type it", () => {
    const ref = "7Q4K2M9DRX3P";
    const typed = [
      "7Q4K2M9DRX3P",
      "7q4k2m9drx3p",
      "SV-7Q4K-2M9D-RX3P",
      "sv 7q4k 2m9d rx3p",
      " SV-7q4k-2m9d-rx3p ",
    ];
    for (const value of typed) {
      expect(normalizeOrderRef(value)).toBe(ref);
    }
  });

  it("forgives O/0 and I/L/1 confusions", () => {
    // The alphabet excludes I, L, O and U precisely so these can be mapped back.
    expect(normalizeOrderRef("SV-7Q4K-2M9D-RX3P")).toBe("7Q4K2M9DRX3P");
    expect(normalizeOrderRef("OQ4K2M9DRX3P")).toBe("0Q4K2M9DRX3P");
    expect(normalizeOrderRef("7Q4K2M9DRX3I")).toBe("7Q4K2M9DRX31");
  });

  it("rejects anything that is not a reference", () => {
    for (const value of [
      "",
      "1", // a display id: the counter this replaced
      "1042",
      "order_01M89YX26ST35Y5AKWN9S22V3M",
      "7Q4K2M9DRX3", // too short
      "7Q4K2M9DRX3PP", // too long
      "7Q4K2M9DRX3U", // U is not in the alphabet
      "hello world",
      "SV-",
    ]) {
      expect(normalizeOrderRef(value)).toBe("");
    }
  });
});
