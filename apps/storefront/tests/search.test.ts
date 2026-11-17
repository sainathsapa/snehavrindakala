import { describe, it, expect } from "vitest";
import { tokens, matchesAll, scoreFor, TYPE_RANK } from "@/lib/search-match";
import { slugify } from "@/lib/slugs";

/**
 * Search has now been wrong three ways at once, and each was invisible from the
 * code that caused it:
 *
 *   1. A Hindi query returned every category in the shop. `slugify` strips
 *      everything outside a-z0-9, so "मधुबनी" became "", and
 *      `handle.includes("")` is true for every handle. The filter that was
 *      meant to narrow results matched all of them.
 *   2. A multi-word query only matched as one contiguous string. "sneha sainath
 *      sapa" found nothing while each of its three words appeared all over the
 *      site.
 *   3. Results with equal scores came back in whatever order the five lookups
 *      finished, so paintings were interleaved with policy pages.
 *
 * The helpers are exported so these stay pinned without a live catalogue.
 */

describe("search matching", () => {
  it("produces an empty slug for Devanagari, which must not match handles", () => {
    // This is the fact the category filter depends on. If slugify ever starts
    // transliterating, this test fails and the guard needs revisiting.
    expect(slugify("मधुबनी")).toBe("");
    expect(slugify("मधुबनी कला")).toBe("");

    // The bug in one line: an empty needle matches every haystack.
    expect("folk".includes("")).toBe(true);
  });

  it("requires every word, in any order", () => {
    const needles = tokens("sneha sainath sapa");
    expect(needles).toEqual(["sneha", "sainath", "sapa"]);

    const haystack = "Made with care by Sneha Sainath Sapa";
    expect(matchesAll(haystack, needles)).toBe(true);

    // Reordered still matches, because the words are what matter.
    expect(matchesAll(haystack, tokens("sapa sneha"))).toBe(true);

    // A word that is absent must fail the whole query.
    expect(matchesAll(haystack, tokens("sneha vermont"))).toBe(false);
  });

  it("never reports a match for an empty needle list", () => {
    // A blank query must not behave like the empty-slug case above.
    expect(matchesAll("anything", [])).toBe(false);
    expect(tokens("   ")).toEqual([]);
  });

  it("matches Hindi text", () => {
    expect(matchesAll("मधुबनी उत्सव", tokens("मधुबनी"))).toBe(true);
    expect(matchesAll("Warli", tokens("मधुबनी"))).toBe(false);
  });

  it("scores a title hit above a body-only hit", () => {
    const needles = tokens("madhubani");
    expect(scoreFor("Madhubani Celebration", "", needles)).toBe(2);
    expect(scoreFor("Celebration", "a madhubani painting", needles)).toBe(1);
    expect(scoreFor("Warli Harvest", "a warli painting", needles)).toBe(0);
  });

  it("ranks products above editorial for equal matches", () => {
    // The ordering the shop asked for: something you can buy outranks a page
    // about it, but only when they match equally well.
    const order = (
      ["product", "maker", "category", "art-form", "journal", "glossary", "page"] as const
    ).map((t) => TYPE_RANK[t]);

    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(TYPE_RANK.product).toBe(0);
    expect(TYPE_RANK.page).toBeGreaterThan(TYPE_RANK["art-form"]);
  });
});
