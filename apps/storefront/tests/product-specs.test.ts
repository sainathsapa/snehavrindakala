import { describe, expect, it } from "vitest";
import { specsFromProduct } from "../lib/catalogue";

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
    expect(specsFromProduct({ tags: [] }, "ready_to_ship").dispatch).toMatch(/ready to ship/i);
    expect(specsFromProduct({ tags: [] }, "made_to_order").dispatch).toMatch(/2–3 weeks/i);
    expect(specsFromProduct({ tags: [] }, "custom_only").dispatch).toMatch(/commissioned/i);
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
