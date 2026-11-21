import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Every work in this shop is one of one, and nothing enforced that: stock levels
 * are empty across the catalogue, so `inventory_quantity` was null everywhere
 * and a sold work still showed "Add to Cart". One work had already appeared in
 * three order line items.
 *
 * "Sold" is derived from order line items rather than a flag someone maintains,
 * so the studio cannot forget to tick a box and a cancellation puts the work back
 * by itself.
 */

const root = join(__dirname, "..");
const read = (path: string) => readFileSync(join(root, path), "utf8");

const rows: unknown[] = [];
let failNext = false;

vi.mock("@/lib/db", () => ({
  query: vi.fn(async () => {
    if (failNext) throw new Error("db down");
    return rows;
  }),
}));

beforeEach(() => {
  rows.length = 0;
  failNext = false;
  vi.resetModules();
});

describe("isSold", () => {
  it("matches only known ids and tolerates nulls", async () => {
    const { isSold } = await import("../lib/sold-works");
    const sold = new Set(["variant_1"]);
    expect(isSold(sold, "variant_1")).toBe(true);
    expect(isSold(sold, "variant_2")).toBe(false);
    expect(isSold(sold, null)).toBe(false);
    expect(isSold(sold, undefined)).toBe(false);
  });
});

describe("isUniqueWork", () => {
  it("treats ready-to-ship and unlabelled work as one of one", async () => {
    const { isUniqueWork } = await import("../lib/sold-works");
    expect(isUniqueWork("ready_to_ship")).toBe(true);
    expect(isUniqueWork(null)).toBe(true);
    expect(isUniqueWork(undefined)).toBe(true);
  });

  it("lets a work that can be made again stay on sale", async () => {
    const { isUniqueWork } = await import("../lib/sold-works");
    expect(isUniqueWork("made_to_order")).toBe(false);
    expect(isUniqueWork("custom_only")).toBe(false);
  });
});

describe("soldVariantIds", () => {
  it("returns the variants that appear in order line items", async () => {
    rows.push(
      { product_handle: "a", variant_id: "variant_a" },
      { product_handle: "b", variant_id: "variant_b" },
      { product_handle: "c", variant_id: null }
    );
    const { soldVariantIds } = await import("../lib/sold-works");
    const sold = await soldVariantIds();
    expect([...sold].sort()).toEqual(["variant_a", "variant_b"]);
  });

  it("ignores cancelled orders, because the work came back", async () => {
    const { soldVariantIds } = await import("../lib/sold-works");
    await soldVariantIds();
    const { query } = await import("@/lib/db");
    const sql = (query as unknown as { mock: { calls: string[][] } }).mock.calls
      .map((call) => call[0])
      .join("\n");
    expect(sql).toMatch(/status NOT IN \('canceled'\)/);
    expect(sql).toMatch(/order_line_item/);
  });

  it("returns an empty set rather than throwing when the read fails", async () => {
    failNext = true;
    const { soldVariantIds } = await import("../lib/sold-works");
    await expect(soldVariantIds()).resolves.toEqual(new Set());
  });
});

describe("where the guard is enforced", () => {
  it("the product page folds sold into availability", () => {
    const page = read("app/[locale]/products/[handle]/page.tsx");
    expect(page).toMatch(/soldVariantIds/);
    expect(page).toMatch(/sold=\{soldHere\}/);
  });

  it("adding to the cart is refused server-side, not just hidden", () => {
    const action = read("app/[locale]/cart/actions.ts");
    expect(action).toMatch(/isSold\(sold, variantId\)/);
  });

  it("both checkout steps refuse a work sold while the cart sat waiting", () => {
    for (const file of [
      "app/api/store/checkout/payment-session/route.ts",
      "app/api/store/checkout/complete/route.ts",
    ]) {
      const source = read(file);
      expect(source, file).toMatch(/soldVariantIds/);
      expect(source, file).toMatch(/work_already_sold/);
    }
  });


it("the admin product list says which works are gone", () => {
    const api = read("app/api/admin/products/route.ts");
    expect(api).toMatch(/soldHandles/);
    expect(api).toMatch(/sold: sold\.has/);
    const page = read("app/admin/products/page.tsx");
    expect(page).toMatch(/p\.sold/);
  });

  it("every grid that shows a work marks the sold ones", () => {
    for (const file of [
      "app/[locale]/shop/page.tsx",
      "app/[locale]/shop/[category]/page.tsx",
      "app/[locale]/art-forms/[slug]/page.tsx",
      "app/[locale]/artists/[slug]/page.tsx",
      "app/[locale]/makers/page.tsx",
    ]) {
      const source = read(file);
      expect(source, file).toMatch(/soldHandles\(\)/);
      expect(source, file).toMatch(/sold=\{sold\.has\(item\.handle\)\}/);
    }
  });

  it("the sold copy does not promise editions that do not exist", () => {
    const options = read("components/product-options.tsx");
    // The phrase may survive in a comment explaining why it was wrong; it must
    // not survive as copy a reader can see.
    expect(options).not.toMatch(/>\s*This work is between editions/);
    expect(options).toMatch(/soldNote/);
  });
});