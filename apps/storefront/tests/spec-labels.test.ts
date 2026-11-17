import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The specification block on a product page is the most factual thing on it —
 * size, medium, framing, whether it ships framed. A buyer decides with it.
 *
 * Its heading was translated but its seven row labels were hard-coded English,
 * so on /hi the block read "विवरण" above rows saying "Dimensions", "Dispatch",
 * "Medium & materials". Half a translation, on the part of the page people read
 * to make a decision.
 *
 * These tests pin the fix: the labels come from the message files, and both
 * locales carry all seven. A missing Hindi key would fall back to the key name
 * itself and render "specs.dimensions" on the page, which is worse than English.
 */

const root = join(__dirname, "..");
const component = readFileSync(
  join(root, "components/artwork-specs-panel.tsx"),
  "utf8"
);
const en = JSON.parse(readFileSync(join(root, "messages/en.json"), "utf8"));
const hi = JSON.parse(readFileSync(join(root, "messages/hi.json"), "utf8"));

const KEYS = [
  "dimensions",
  "medium",
  "framing",
  "year",
  "edition",
  "dispatch",
  "care",
] as const;

describe("artwork specification labels", () => {
  it("reads labels from translations, not literals", () => {
    expect(component).toMatch(/getTranslations\("productDetail\.specs"\)/);
    expect(component).toMatch(/\{t\(row\.key\)\}/);

    // The regression: English labels written straight into the row list.
    expect(component).not.toMatch(/label:\s*"Dimensions"/);
    expect(component).not.toMatch(/label:\s*"Medium & materials"/);
  });

  it("translates all seven labels in both locales", () => {
    for (const key of KEYS) {
      expect(en.productDetail.specs[key], `en.${key}`).toBeTruthy();
      expect(hi.productDetail.specs[key], `hi.${key}`).toBeTruthy();
    }
  });

  it("does not leave Hindi equal to English", () => {
    // An untranslated value would pass a truthiness check and ship English.
    for (const key of KEYS) {
      expect(hi.productDetail.specs[key]).not.toBe(en.productDetail.specs[key]);
    }
  });

  it("keeps the row keys aligned with ArtworkSpecs", () => {
    // A key with no message, or a message with no key, is a silent gap.
    const declared = [...component.matchAll(/\{ key: "(\w+)" \}/g)].map(
      (m) => m[1]
    );
    expect(declared.sort()).toEqual([...KEYS].sort());
  });

  it("translates the dispatch line the catalogue generates", () => {
    // "Usually ships in 2-3 weeks" was generated in lib/catalogue.ts and printed
    // verbatim, so the shipping promise was English on every Hindi product page.
    // Those three lines now carry message keys; editorial dispatch tags are
    // still shown exactly as written and must not be routed through these.
    const DISPATCH = ["dispatchReady", "dispatchMadeToOrder", "dispatchCustom"];
    for (const key of DISPATCH) {
      expect(en.productDetail.specs[key], `en.${key}`).toBeTruthy();
      expect(hi.productDetail.specs[key], `hi.${key}`).toBeTruthy();
      expect(hi.productDetail.specs[key]).not.toBe(en.productDetail.specs[key]);
    }

    const catalogue = readFileSync(join(root, "lib/catalogue.ts"), "utf8");
    // The key is only set when no editor tag supplied the line.
    expect(catalogue).toMatch(/const dispatchKey = dispatchTag\s*\?\s*undefined/);
  });
});
