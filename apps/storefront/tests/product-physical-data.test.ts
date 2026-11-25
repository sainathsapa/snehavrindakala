/**
 * Shipment physical data must be measured, never guessed.
 *
 * The legacy code sized every parcel as `0.5 kg per item` in a `10x10x5 cm` box
 * and sent that to Shiprocket as fact. Weight decides the courier rate the shop
 * pays; dimensions are what a damage/lost-parcel claim is judged against. These
 * tests pin the replacement rule: a product with no verified measurement cannot
 * be shipped, and no default is ever substituted.
 */

import { describe, it, expect } from "vitest";
import {
  MissingPhysicalDataError,
  resolvePackagePhysicalData,
  type ProductPhysicalData,
} from "@/lib/shipping/product-physical";

const row = (
  productId: string,
  overrides: Partial<ProductPhysicalData> = {}
): ProductPhysicalData => ({
  product_id: productId,
  weight_grams: 1200,
  length_cm: 30,
  breadth_cm: 20,
  height_cm: 10,
  source: "measured",
  verified_by: "admin@example.com",
  verified_at: "2026-03-01T00:00:00.000Z",
  ...overrides,
});

const bags = (...rows: ProductPhysicalData[]) =>
  new Map(rows.map((r) => [r.product_id, r]));

describe("resolvePackagePhysicalData — measured data", () => {
  it("sums weight across quantities and multiples", () => {
    const result = resolvePackagePhysicalData(
      [
        { productId: "prod-a", quantity: 2 }, // 2 × 1200 g = 2400 g
        { productId: "prod-b", quantity: 1 },
      ],
      bags(row("prod-a", { weight_grams: 1200 }), row("prod-b", { weight_grams: 1000 }))
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // 3400 g = 3.4 kg
    expect(result.weightKg).toBe(3.4);
    expect(result.measuredProductIds).toEqual(["prod-a", "prod-b"]);
  });

  it("uses the largest envelope for each dimension", () => {
    const result = resolvePackagePhysicalData(
      [
        { productId: "a", quantity: 1 },
        { productId: "b", quantity: 1 },
      ],
      bags(
        row("a", { length_cm: 45, breadth_cm: 10, height_cm: 5 }),
        row("b", { length_cm: 20, breadth_cm: 35, height_cm: 12 })
      )
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.dimensionsCm).toEqual({ length: 45, breadth: 35, height: 12 });
  });

  it("rounds weight up so the shop never under-declares", () => {
    // 1001 g must not become 1.0 kg.
    const result = resolvePackagePhysicalData(
      [{ productId: "a", quantity: 1 }],
      bags(row("a", { weight_grams: 1001 }))
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.weightKg).toBe(1.01);
  });

  it("accepts numeric columns returned as strings by Postgres", () => {
    const result = resolvePackagePhysicalData(
      [{ productId: "a", quantity: 1 }],
      bags(row("a", { length_cm: "30.5" as any, breadth_cm: "20.5" as any, height_cm: "10.5" as any }))
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Ceil so a fractional measurement never becomes a smaller box.
    expect(result.dimensionsCm).toEqual({ length: 31, breadth: 21, height: 11 });
  });
});

describe("resolvePackagePhysicalData — refuses to invent data", () => {
  it("reports every product with no measurement, sorted, and blocks", () => {
    const result = resolvePackagePhysicalData(
      [
        { productId: "prod-z", quantity: 1 },
        { productId: "prod-a", quantity: 1 },
        { productId: "prod-m", quantity: 3 },
      ],
      bags()
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("missing_product_data");
    expect(result.missingProductIds).toEqual(["prod-a", "prod-m", "prod-z"]);
  });

  it("blocks when only some products are measured", () => {
    const result = resolvePackagePhysicalData(
      [
        { productId: "a", quantity: 1 },
        { productId: "b", quantity: 1 },
      ],
      bags(row("a"))
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.missingProductIds).toEqual(["b"]);
  });

  it("treats a zero or negative measurement as missing, not as a valid parcel", () => {
    const result = resolvePackagePhysicalData(
      [{ productId: "a", quantity: 1 }],
      bags(row("a", { weight_grams: 0, length_cm: 0 }))
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.missingProductIds).toEqual(["a"]);
  });

  it("blocks an order whose lines carry no product id at all", () => {
    const result = resolvePackagePhysicalData(
      [{ productId: null, quantity: 1 }],
      bags(row("a"))
    );
    expect(result.ok).toBe(false);
  });

  it("blocks a zero-quantity order rather than returning a 0 kg parcel", () => {
    const result = resolvePackagePhysicalData(
      [{ productId: "a", quantity: 0 }],
      bags(row("a"))
    );
    expect(result.ok).toBe(false);
  });
});

describe("MissingPhysicalDataError", () => {
  it("names the products so an admin knows exactly what to measure", () => {
    const err = new MissingPhysicalDataError(["prod-a", "prod-b"]);
    expect(err.message).toContain("prod-a");
    expect(err.message).toContain("prod-b");
    expect(err.missingProductIds).toEqual(["prod-a", "prod-b"]);
    expect(err.name).toBe("MissingPhysicalDataError");
  });
});
