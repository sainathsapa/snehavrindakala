import { describe, expect, it } from "vitest";
import { specsFromProduct, artistFromProduct } from "../lib/catalogue";

const tag = (value: string) => ({ value });

describe("specsFromProduct", () => {
  it("reads dimensions/medium/framing/year/edition/care from tags", () => {
    const product = {
      tags: [
        tag("dimensions:30 x 40 cm"),
        tag("medium:handmade paper, natural dyes"),
        tag("framing:unframed"),
        tag("year:2024"),
        tag("edition:one-of-one"),
        tag("care:keep from direct sunlight"),
      ],
    };
    const specs = specsFromProduct(product, "ready_to_ship");
    expect(specs).toMatchObject({
      dimensions: "30 x 40 cm",
      medium: "handmade paper, natural dyes",
      framing: "unframed",
      year: "2024",
      edition: "one-of-one",
      care: "keep from direct sunlight",
    });
  });

  it("uses the dispatch tag when present", () => {
    const specs = specsFromProduct({ tags: [tag("dispatch:Ships in 5 days")] }, "ready_to_ship");
    expect(specs.dispatch).toBe("Ships in 5 days");
  });

  it("derives a truthful dispatch phrase from stock type when untagged", () => {
    expect(specsFromProduct({ tags: [] }, "ready_to_ship").dispatch).toMatch(/2–4 business days/i);
    expect(specsFromProduct({ tags: [] }, "made_to_order").dispatch).toMatch(/2–3 weeks/i);
    expect(specsFromProduct({ tags: [] }, "custom_only").dispatch).toMatch(/quote/i);
  });

  it("states timing only, so it does not repeat the availability line above it", () => {
    // The product page prints "Ready to ship" as a status pill one line above the
    // dispatch text. Repeating it here made the page read as a stutter.
    const dispatch = specsFromProduct({ tags: [] }, "ready_to_ship").dispatch ?? "";
    expect(dispatch).not.toMatch(/ready to ship/i);
  });

  it("uses an operator-written dispatch tag verbatim", () => {
    expect(
      specsFromProduct({ tags: [{ value: "dispatch:Ships by 12 March" }] }, "ready_to_ship")
        .dispatch
    ).toBe("Ships by 12 March");
  });

  it("drops empty/whitespace values rather than rendering blank rows", () => {
    const specs = specsFromProduct({ tags: [tag("dimensions:   ")] }, "ready_to_ship");
    expect(specs.dimensions).toBeUndefined();
  });

  it("handles a product with no tags at all", () => {
    const specs = specsFromProduct({}, "ready_to_ship");
    expect(specs.dimensions).toBeUndefined();
    expect(specs.dispatch).toBeTruthy();
  });
});

describe("artistFromProduct", () => {
  it("reads the maker from the artist tag, which is what the store API returns", () => {
    expect(
      artistFromProduct({ tags: [{ value: "artist:Sneha Sainath Sapa" }] })
    ).toBe("Sneha Sainath Sapa");
  });

  it("still reads metadata when a product was created that way", () => {
    expect(artistFromProduct({ metadata: { artist: "Sneha Sainath Sapa" } })).toBe(
      "Sneha Sainath Sapa"
    );
  });

  it("accepts tags as bare strings as well as objects", () => {
    expect(artistFromProduct({ tags: ["stock:ready_to_ship", "artist:Someone"] })).toBe(
      "Someone"
    );
  });

  it("returns undefined when there is no maker, so the page omits the line", () => {
    expect(artistFromProduct({ tags: [] })).toBeUndefined();
    expect(artistFromProduct({})).toBeUndefined();
    expect(artistFromProduct({ tags: [{ value: "artist:   " }] })).toBeUndefined();
  });

  it("does not mistake another tag for the maker", () => {
    expect(
      artistFromProduct({ tags: [{ value: "artform:Madhubani" }] })
    ).toBeUndefined();
  });
});
