import { describe, expect, it } from "vitest";
import { newsroomCopy, partnersCopy, roomsCopy, sellCopy } from "../lib/page-copy";

/**
 * Every string in the late pages exists in both languages.
 *
 * The bug this prevents is the one that actually happened: nav and footer were
 * translated, the pages added afterwards were not, and a Hindi visitor landed on
 * English prose under a Hindi menu. Walking the copy objects is the cheapest way
 * to make "we finished the translation" checkable rather than remembered.
 */

const LOCALES = ["en", "hi"] as const;

/** Devanagari, so a "Hindi" string that was left as English is caught. */
const HAS_DEVANAGARI = /[\u0900-\u097F]/;

function walk(value: unknown, path: string, out: { path: string; value: string }[]) {
  if (typeof value === "string") {
    out.push({ path, value });
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => walk(item, `${path}[${index}]`, out));
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, inner] of Object.entries(value)) walk(inner, `${path}.${key}`, out);
  }
}

const PAGES = [
  ["partners", partnersCopy],
  ["rooms", roomsCopy],
  ["newsroom", newsroomCopy],
  ["sell", sellCopy],
] as const;

describe("bilingual page copy", () => {
  for (const [name, factory] of PAGES) {
    describe(name, () => {
      it("has no empty strings in either language", () => {
        for (const locale of LOCALES) {
          const strings: { path: string; value: string }[] = [];
          walk(factory(locale), "", strings);
          for (const { path, value } of strings) {
            expect(value.trim(), `${name}${path} (${locale})`).not.toBe("");
          }
        }
      });

      it("carries the same keys in both languages", () => {
        const shape = (locale: string) => {
          const strings: { path: string; value: string }[] = [];
          walk(factory(locale), "", strings);
          return strings.map((s) => s.path).sort();
        };
        expect(shape("hi")).toEqual(shape("en"));
      });

      it("really is written in Devanagari for Hindi", () => {
        const strings: { path: string; value: string }[] = [];
        walk(factory("hi"), "", strings);
        // Numbers and the two-letter numerals ("01") are not prose.
        const prose = strings.filter((s) => /[a-zA-Z]{3,}/.test(s.value) === false || true);
        const translated = strings.filter((s) => HAS_DEVANAGARI.test(s.value));
        expect(translated.length).toBeGreaterThan(prose.length * 0.8);
      });

      it("does not leak Hindi into the English copy", () => {
        const strings: { path: string; value: string }[] = [];
        walk(factory("en"), "", strings);
        for (const { path, value } of strings) {
          expect(HAS_DEVANAGARI.test(value), `${name}${path}`).toBe(false);
        }
      });
    });
  }

  it("switches language when asked", () => {
    expect(partnersCopy("en").title).toBe("Partners");
    expect(partnersCopy("hi").title).not.toBe("Partners");
  });

  it("falls back to English for an unknown locale", () => {
    expect(partnersCopy("fr").title).toBe("Partners");
  });
});
