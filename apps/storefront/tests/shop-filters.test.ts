import { describe, expect, it } from "vitest";
import { applyShopFilters, sortItems, availableMediums } from "../lib/shop-filters";
import type { CatalogueItem } from "../lib/catalogue";

function item(overrides: Partial<CatalogueItem>): CatalogueItem {
  return {
    handle: "x",
    title: "Work",
    artist: "Maker",
    price: 100000, // ₹1000 in paise
    currency: "inr",
    stockType: "ready_to_ship",
    image: "/x.jpg",
    isNew: false,
    artForms: ["folk"],
    collection: "Folk",
    seeded: false,
    specs: { medium: "handmade paper" },
    ...overrides,
  };
}

const items: CatalogueItem[] = [
  item({ handle: "a", title: "Madhubani Fish", price: 500000, artForms: ["folk"], collection: "Folk", isNew: true }),
  item({ handle: "b", title: "Terracotta Vase", price: 220000, artForms: ["home-decor"], collection: "Home & Decorative Art", stockType: "ready_to_ship", specs: { medium: "terracotta" } }),
  item({ handle: "c", title: "Cotton Throw", price: 900000, artForms: ["textile"], collection: "Textile", stockType: "made_to_order", specs: { medium: "cotton" } }),
];

describe("applyShopFilters", () => {
  it("returns everything with no filters", () => {
    expect(applyShopFilters(items, {})).toHaveLength(3);
  });

  it("filters by art form key", () => {
    const out = applyShopFilters(items, { form: "folk" });
    expect(out.map((i) => i.handle)).toEqual(["a"]);
  });

  it("filters by availability", () => {
    const out = applyShopFilters(items, { availability: "ready" });
    expect(out.map((i) => i.handle).sort()).toEqual(["a", "b"]);
  });

  it("filters by price range in rupees (converted to paise)", () => {
    // ₹2000–₹6000 → 200000..600000 paise
    const out = applyShopFilters(items, { min: 2000, max: 6000 });
    expect(out.map((i) => i.handle).sort()).toEqual(["a", "b"]);
  });

  it("filters by medium substring, case-insensitive", () => {
    const out = applyShopFilters(items, { medium: "cotton" });
    expect(out.map((i) => i.handle)).toEqual(["c"]);
  });

  it("text query matches title", () => {
    const out = applyShopFilters(items, { query: "fish" });
    expect(out.map((i) => i.handle)).toEqual(["a"]);
  });

  it("sorts by price ascending and descending", () => {
    expect(sortItems(items, "price-asc").map((i) => i.handle)).toEqual(["b", "a", "c"]);
    expect(sortItems(items, "price-desc").map((i) => i.handle)).toEqual(["c", "a", "b"]);
  });
});

describe("availableMediums", () => {
  it("lists distinct mediums sorted", () => {
    expect(availableMediums(items)).toEqual(["cotton", "handmade paper", "terracotta"]);
  });
});
