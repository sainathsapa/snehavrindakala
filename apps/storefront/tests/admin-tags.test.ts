import { describe, it, expect } from "vitest";
import { mergeTags, specsFromTags, tagValue } from "@/lib/admin-tags";

/**
 * The admin can now edit the artwork specifications — dimensions, medium,
 * framing, year, edition, care — which the storefront has rendered all along but
 * which nothing could write. They are stored as `key:value` product tags.
 *
 * The danger of that storage is the save. Medusa replaces a product's tag list
 * wholesale, so a request that submits only the fields a form happened to render
 * wipes everything else. That is exactly how a dimension entered last week
 * disappears when someone fixes a price. These tests pin the merge rule.
 */

describe("product tag merge", () => {
  const existing = [
    "artist:Sneha Sainath Sapa",
    "stock:ready_to_ship",
    "medium:Natural pigment on handmade paper",
    "dimensions:30 × 40 cm",
  ];

  it("keeps specifications the request did not mention", () => {
    // A title/price edit submits neither specs nor artist.
    expect(mergeTags(existing, {})).toEqual(existing);
  });

  it("replaces only the keys it submits", () => {
    const out = mergeTags(existing, { specs: { dimensions: "40 × 60 cm" } });
    expect(out).toContain("dimensions:40 × 60 cm");
    expect(out).not.toContain("dimensions:30 × 40 cm");
    // Untouched keys survive.
    expect(out).toContain("medium:Natural pigment on handmade paper");
    expect(out).toContain("artist:Sneha Sainath Sapa");
  });

  it("drops the tag when a field is cleared", () => {
    const out = mergeTags(existing, { specs: { dimensions: "" } });
    expect(out.some((t) => t.startsWith("dimensions:"))).toBe(false);
    // ... and does not store a blank one.
    expect(out.some((t) => t === "dimensions:")).toBe(false);
  });

  it("ignores keys omitted from a partial update", () => {
    // "framing" is absent, not empty: it must not be removed.
    const out = mergeTags([...existing, "framing:Unframed"], {
      specs: { year: "2025" },
    });
    expect(out).toContain("framing:Unframed");
    expect(out).toContain("year:2025");
  });

  it("preserves values containing colons", () => {
    const out = mergeTags([], {
      specs: { care: "Keep dry; avoid direct sun: it fades madder" },
    });
    expect(tagValue(out, "care")).toBe("Keep dry; avoid direct sun: it fades madder");
  });

  it("still updates artist and stock without touching specs", () => {
    const out = mergeTags(existing, {
      artist: "Another Maker",
      stock_type: "made_to_order",
    });
    expect(out).toContain("artist:Another Maker");
    expect(out).not.toContain("artist:Sneha Sainath Sapa");
    expect(out).toContain("stock:made_to_order");
    expect(out).toContain("dimensions:30 × 40 cm");
  });

  it("reads specifications back for the form", () => {
    // An empty prefill would erase real values on the next save.
    const specs = specsFromTags(existing);
    expect(specs.dimensions).toBe("30 × 40 cm");
    expect(specs.medium).toBe("Natural pigment on handmade paper");
    expect(specs.framing).toBe("");
  });

  it("reads tags given as objects as well as strings", () => {
    const specs = specsFromTags([
      { id: "t1", value: "dimensions:12 × 18 cm" },
      { id: "t2", value: "year:2024" },
    ]);
    expect(specs.dimensions).toBe("12 × 18 cm");
    expect(specs.year).toBe("2024");
  });

  it("carries provenance and condition through a save that does not touch them", () => {
    // These are the two fields that make "one of one" checkable. They are long
    // prose the owner types once, so losing them to a price edit would mean
    // retyping a record that cannot be reconstructed from anywhere else.
    const withRecord = [
      ...existing,
      "provenance:From the artist's studio, 2024",
      "condition:Excellent; a faint mark on the reverse",
    ];

    const after = mergeTags(withRecord, { specs: { dimensions: "32 × 42 cm" } });
    expect(after).toContain("provenance:From the artist's studio, 2024");
    expect(after).toContain("condition:Excellent; a faint mark on the reverse");
    expect(after).toContain("dimensions:32 × 42 cm");
    expect(after).not.toContain("dimensions:30 × 40 cm");

    // Clearing one removes its tag rather than storing `condition:` with no
    // value, which would render as an empty row on the product page.
    const cleared = mergeTags(withRecord, { specs: { condition: "" } });
    expect(cleared.some((tag) => tag.startsWith("condition:"))).toBe(false);
  });
});
