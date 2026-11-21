import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanGiftNote, parseGiftWrap } from "../lib/gift";

const root = join(__dirname, "..");
const read = (path: string) => readFileSync(join(root, path), "utf8");

describe("cleanGiftNote", () => {
  it("keeps the shape of what someone wrote", () => {
    expect(cleanGiftNote("  For Amma,\nwith love  ")).toBe("For Amma,\nwith love");
  });

  it("normalises Windows line endings rather than storing carriage returns", () => {
    expect(cleanGiftNote("one\r\ntwo")).toBe("one\ntwo");
  });

  it("caps at what fits on a card", () => {
    expect(cleanGiftNote("x".repeat(500))).toHaveLength(300);
  });

  it("treats anything that is not a string as no note", () => {
    for (const value of [null, undefined, 42, {}]) {
      expect(cleanGiftNote(value)).toBe("");
    }
  });
});

describe("parseGiftWrap", () => {
  it("accepts what a form and a JSON client actually send", () => {
    for (const value of [true, "on", "true", "1"]) {
      expect(parseGiftWrap(value)).toBe(true);
    }
  });

  it("does not treat an empty string or a missing field as opted in", () => {
    for (const value of [false, "", "false", "0", null, undefined]) {
      expect(parseGiftWrap(value)).toBe(false);
    }
  });
});

/**
 * The note has to survive the trip from the cart to the order, and then be
 * visible in the two places that matter: the buyer's order page and the packing
 * bench. Anything less and the words are collected and thrown away.
 */
describe("gift note wiring", () => {
  it("is saved onto the cart before payment", () => {
    expect(read("app/api/store/checkout/gift/route.ts")).toMatch(
      /updateCart\(cartId/
    );
  });

  it("is copied onto the order when checkout completes", () => {
    const route = read("app/api/store/checkout/complete/route.ts");
    expect(route).toMatch(/saveGiftForOrder/);
    // From the cart, not from the request: the note must be the one written
    // before the money moved, and a client cannot retype it afterwards.
    expect(route).toMatch(/cart\.metadata\?\.gift_note/);
  });

  it("is shown to the buyer and to the packer", () => {
    expect(read("app/[locale]/order/[id]/page.tsx")).toMatch(/getGiftForOrder/);
    expect(read("app/admin/orders/[id]/page.tsx")).toMatch(/order\.gift/);
    expect(read("app/api/admin/orders/[id]/route.ts")).toMatch(/getGiftForOrder/);
  });
});
