import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ART_FORM_HINDI, hindiFor } from "../lib/art-form-hindi";

/**
 * The Hindi art-form essays.
 *
 * These columns existed and were empty, so `/hi/art-forms/folk` rendered the
 * English essay under Hindi navigation. The tests below check the two ways that
 * can go wrong again: a form with no Hindi, and a form with *some* Hindi (a
 * translated title over an English essay), which is harder to notice than no
 * translation at all.
 */

const root = join(__dirname, "..");
const read = (path: string) => readFileSync(join(root, path), "utf8");

const siteContent = read("lib/site-content.ts");
const slugs = [
  "painting",
  "folk",
  "home-decor",
  "textile",
  "paper",
  "wearable",
];

const DEVANAGARI = /[\u0900-\u097F]/;

describe("coverage", () => {
  it("has an entry for every default art form", () => {
    for (const slug of slugs) {
      expect(ART_FORM_HINDI[slug], `${slug} has no Hindi`).toBeTruthy();
    }
  });

  it("has all six fields for every form", () => {
    for (const slug of slugs) {
      const entry = hindiFor(slug);
      expect(entry, `${slug} is incomplete`).not.toBeNull();
      for (const field of [
        "name",
        "description",
        "story",
        "origin",
        "materials",
        "quote",
      ] as const) {
        expect(entry![field].trim().length, `${slug}.${field} is empty`).toBeGreaterThan(2);
      }
    }
  });

  it("refuses a partial record rather than mixing languages mid-essay", () => {
    // hindiFor is the gate the seed and the backfill rely on.
    expect(hindiFor("does-not-exist")).toBeNull();
  });
});

describe("the prose is actually Hindi", () => {
  it("every field is written in Devanagari", () => {
    for (const slug of slugs) {
      const entry = ART_FORM_HINDI[slug];
      for (const [field, value] of Object.entries(entry)) {
        expect(DEVANAGARI.test(value), `${slug}.${field} is not in Devanagari`).toBe(true);
      }
    }
  });

  it("no essay is a stub", () => {
    // The English essays run to several paragraphs. A four-line Hindi essay under
    // the same heading would be a reader being handed less than the English one.
    for (const slug of slugs) {
      expect(ART_FORM_HINDI[slug].story.length, `${slug}.story is short`).toBeGreaterThan(600);
      expect(
        ART_FORM_HINDI[slug].description.length,
        `${slug}.description is short`
      ).toBeGreaterThan(20);
    }
  });

  it("carries no stray non-Hindi words", () => {
    // Latin script is legitimate for proper nouns (Madhubani, Bhopa) when the
    // source uses it, but a whole English sentence is not.
    for (const slug of slugs) {
      const entry = ART_FORM_HINDI[slug];
      for (const [field, value] of Object.entries(entry)) {
        const latinWords = (value.match(/\b[A-Za-z]{3,}\b/g) || []).filter(
          (word: string) =>
            ![
              "Madhubani",
              "Warli",
              "Gond",
              "Pattachitra",
              "Kalamkari",
              "Bhopa",
              "Banarasi",
              "Kanchipuram",
              "Kutch",
              "Sambalpuri",
              "Chanderi",
              "Dhokra",
              "Channapatna",
              "Meenakari",
              "Thewa",
              "Sanganer",
              "Kalighat",
            ].includes(word)
        );
        expect(latinWords, `${slug}.${field} contains untranslated English`).toEqual([]);
      }
    }
  });
});

describe("wiring", () => {
  it("the seed writes both languages", () => {
    expect(siteContent).toMatch(/name_hi/);
    expect(siteContent).toMatch(/ART_FORM_HINDI/);
    // A fresh install must not need a second script to get Hindi.
    expect(siteContent).toMatch(/ON CONFLICT \(slug\) DO NOTHING/);
  });

  it("the backfill only fills empty columns", () => {
    // An editor's wording must survive a deploy.
    expect(siteContent).toMatch(/CASE WHEN name_hi = ''/);
    expect(siteContent).toMatch(/CASE WHEN story_hi = ''/);
  });
});
