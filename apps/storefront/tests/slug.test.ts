import { describe, expect, it } from "vitest";
import { slugify, productSlug, isOpaqueHandle, uniqueHandle } from "@/lib/slug";

describe("slugify", () => {
  it("lower-cases and hyphenates", () => {
    expect(slugify("Madhubani Folk Painting")).toBe("madhubani-folk-painting");
  });

  it("turns an ampersand into 'and' rather than dropping it", () => {
    // "Home & Decor" must not become "home-decor" here — that collides with the
    // taxonomy slug and loses a word from the URL.
    expect(slugify("Home & Decor")).toBe("home-and-decor");
  });

  it("strips diacritics so the URL stays ASCII", () => {
    expect(slugify("Pattachitrā")).toBe("pattachitra");
  });

  it("drops apostrophes instead of hyphenating them", () => {
    expect(slugify("Artist's Brush")).toBe("artists-brush");
  });

  it("collapses runs of punctuation and trims edges", () => {
    expect(slugify("  --Woven / Silk -- ")).toBe("woven-silk");
  });

  it("never returns a trailing hyphen after truncation", () => {
    const long = slugify("a".repeat(60) + " " + "b".repeat(60));
    expect(long.endsWith("-")).toBe(false);
    // Bounded by whatever the cap is, not by a copy of the number — the cap had
    // to grow when the house settled on one maker with a three-word name.
    expect(long.length).toBeLessThanOrEqual(90);
  });
});

describe("productSlug", () => {
  it("leads with the title", () => {
    expect(productSlug({ title: "Madhubani Folk Painting" })).toBe(
      "madhubani-folk-painting"
    );
  });

  it("adds the art form and the maker", () => {
    expect(
      productSlug({
        title: "Embroidered Cotton Throw",
        artist: "Sneha Sainath Sapa",
        artForm: "Embroidery",
      })
    ).toBe("embroidered-cotton-throw-embroidery-sneha-sainath-sapa");
  });

  it("does not repeat a tradition the title already names", () => {
    // Without the guard this becomes "madhubani-folk-painting-madhubani".
    const slug = productSlug({
      title: "Madhubani Folk Painting",
      artist: "Sneha Sainath Sapa",
      artForm: "Madhubani",
    });
    expect(slug.match(/madhubani/g)).toHaveLength(1);
  });

  it("skips placeholder artists", () => {
    // "Commission only" is not a person and must not appear in a URL.
    expect(
      productSlug({
        title: "Custom Portrait Commission",
        artist: "Commission only",
      })
    ).toBe("custom-portrait-commission");
  });

  it("falls back to a non-empty handle", () => {
    expect(productSlug({ title: "!!!" })).toBe("artwork");
  });
});

describe("isOpaqueHandle", () => {
  it("flags bare numbers and prod_ ids", () => {
    // This is the bug that shipped: /products/003.
    expect(isOpaqueHandle("003")).toBe(true);
    expect(isOpaqueHandle("prod_003")).toBe(true);
  });

  it("flags UUIDs", () => {
    expect(isOpaqueHandle("5f2a1c3e-9b7d-4a21-8e0f-123456789abc")).toBe(true);
    expect(isOpaqueHandle("prod_5f2a1c3e-9b7d-4a21")).toBe(true);
  });

  it("flags short consonant-only codes", () => {
    expect(isOpaqueHandle("xyz")).toBe(true);
  });

  it("flags null and empty", () => {
    expect(isOpaqueHandle(null)).toBe(true);
    expect(isOpaqueHandle("")).toBe(true);
  });

  it("accepts a readable handle", () => {
    expect(isOpaqueHandle("madhubani-folk-painting")).toBe(false);
    expect(isOpaqueHandle("terracotta-vase")).toBe(false);
  });
});

describe("uniqueHandle", () => {
  it("returns the base when free", () => {
    expect(uniqueHandle("vase", new Set())).toBe("vase");
  });

  it("suffixes on collision", () => {
    expect(uniqueHandle("vase", new Set(["vase"]))).toBe("vase-2");
    expect(uniqueHandle("vase", new Set(["vase", "vase-2"]))).toBe("vase-3");
  });
});
