import { describe, expect, it } from "vitest";
import { HINDI_TO_ENGLISH, matchesGroups, queryGroups } from "../lib/search-words";

/**
 * Hindi search.
 *
 * The shop is bilingual in the nav and was English-only in the search box: a
 * visitor typing "मिट्टी" (clay) found nothing while a terracotta vase sat on the
 * shelf. These tests pin the two properties that make the bridge safe.
 */

describe("queryGroups", () => {
  it("keeps the typed word first, so it still drives ranking", () => {
    const [group] = queryGroups("मिट्टी");
    expect(group[0]).toBe("मिट्टी");
    expect(group).toContain("terracotta");
  });

  it("passes an English query through untouched", () => {
    expect(queryGroups("terracotta vase")).toEqual([["terracotta"], ["vase"]]);
  });

  it("splits on whitespace and lowercases", () => {
    expect(queryGroups("  Madhubani   Fish ")).toEqual([["madhubani"], ["fish"]]);
  });
});

describe("matchesGroups", () => {
  it("matches a Hindi material against the English word in a title", () => {
    expect(matchesGroups("Hand-painted Terracotta Vase", queryGroups("मिट्टी"))).toBe(true);
  });

  it("matches a Hindi animal against an English motif", () => {
    expect(matchesGroups("Madhubani Fish & Lotus", queryGroups("मछली"))).toBe(true);
  });

  it("still requires every word of a two-word query", () => {
    // Silver AND vessel: a photograph of a silver spoon must not match.
    const groups = queryGroups("चांदी बर्तन");
    expect(matchesGroups("Silver Filigree Box", groups)).toBe(false);
    expect(matchesGroups("Silver Filigree Vessel", groups)).toBe(true);
  });

  it("does not match everything on an empty query", () => {
    expect(matchesGroups("anything at all", queryGroups(""))).toBe(false);
  });

  it("does not match an unrelated work", () => {
    expect(matchesGroups("Gond Tree of Life", queryGroups("चांदी"))).toBe(false);
  });
});

describe("the synonym table", () => {
  it("never lists an empty alternative", () => {
    for (const [word, values] of Object.entries(HINDI_TO_ENGLISH)) {
      expect(word.trim().length).toBeGreaterThan(0);
      expect(values.length).toBeGreaterThan(0);
      for (const value of values) expect(value.trim().length).toBeGreaterThan(0);
    }
  });

  it("never maps a word to itself", () => {
    for (const [word, values] of Object.entries(HINDI_TO_ENGLISH)) {
      expect(values).not.toContain(word);
    }
  });
});
