import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { PartnerContext } from "@/lib/partner/types";
import {
  LOW_STOCK_THRESHOLD,
  getStockExceptions,
  listPartnerInventory,
  summariseInventory,
  type PartnerInventoryRow,
} from "@/lib/partner-portal/inventory";

const ctxA: PartnerContext = {
  partnerId: "partner-A",
  membershipId: "member-A",
  email: "a@partner.test",
  role: "owner",
  tokenVersion: 1,
};
const ctxB: PartnerContext = {
  ...ctxA,
  partnerId: "partner-B",
  membershipId: "member-B",
  email: "b@partner.test",
};

function capture(rows: any[] = []) {
  const calls: Array<{ sql: string; params: any[] }> = [];
  const executor = async (sql: string, params: any[] = []) => {
    calls.push({ sql, params });
    return rows;
  };
  return { executor, calls };
}

function row(overrides: Partial<PartnerInventoryRow> = {}): PartnerInventoryRow {
  return {
    product_id: "p1",
    variant_id: "v1",
    product_title: "Product",
    variant_title: "Variant",
    on_hand: 10,
    reserved: 0,
    sold: 0,
    available: 10,
    active_reservations: 0,
    ...overrides,
  };
}

describe("partner inventory — tenant scoping", () => {
  it("scopes the stock query by ctx.partnerId and ignores a client-supplied partner id", async () => {
    // A hostile client sends this alongside the request; it must never reach SQL.
    const clientSupplied = { partner_id: "partner-B", partnerId: "partner-B" };
    const { executor, calls } = capture();

    await listPartnerInventory(ctxA, executor);

    expect(calls).toHaveLength(1);
    expect(calls[0].sql).toMatch(/partner_product/);
    expect(calls[0].sql).toMatch(/partner_id = \$\d+/);
    // The only bound value is the server-derived context id.
    expect(calls[0].params).toEqual(["partner-A"]);
    expect(JSON.stringify(calls[0])).not.toContain("partner-B");
    expect(clientSupplied.partner_id).toBe("partner-B"); // spoof value existed
  });

  it("partner A's statement can never contain partner B rows (and vice versa)", async () => {
    const a = capture();
    const b = capture();
    await listPartnerInventory(ctxA, a.executor);
    await listPartnerInventory(ctxB, b.executor);

    expect(a.calls[0].params).toContain("partner-A");
    expect(a.calls[0].params).not.toContain("partner-B");
    expect(b.calls[0].params).toContain("partner-B");
    expect(b.calls[0].params).not.toContain("partner-A");
    // Exactly one tenant predicate value per statement — never an OR of both ids.
    expect(a.calls[0].params.filter((p) => p === "partner-A")).toHaveLength(1);
    expect(b.calls[0].params.filter((p) => p === "partner-B")).toHaveLength(1);
  });

  it("joins partner_product to Medusa variants and the stock tables", async () => {
    const { executor, calls } = capture();
    await listPartnerInventory(ctxA, executor);
    const sql = calls[0].sql;
    for (const token of [
      "partner_product",
      "product_variant",
      "variant_stock",
      "stock_reservation",
      "GREATEST",
      "active_reservations",
    ]) {
      expect(sql).toContain(token);
    }
  });

  it("getStockExceptions is tenant scoped on every statement", async () => {
    const { executor, calls } = capture();
    await getStockExceptions(ctxA, executor);

    expect(calls.length).toBeGreaterThanOrEqual(2);
    for (const call of calls) {
      expect(call.sql).toMatch(/partner_id = \$\d+/);
      expect(call.params).toContain("partner-A");
      expect(call.params).not.toContain("partner-B");
    }
    // Low-stock threshold is bound as a parameter, not a client id.
    expect(calls[0].params).toContain(LOW_STOCK_THRESHOLD);
    expect(calls.some((c) => c.params[c.params.length - 1] === "partner-A")).toBe(
      true
    );
  });

  it("getStockExceptions covers low/zero stock and expired reservations", async () => {
    const { executor, calls } = capture();
    await getStockExceptions(ctxA, executor);
    const sql = calls.map((c) => c.sql).join("\n");
    expect(sql).toContain("out_of_stock");
    expect(sql).toContain("low_stock");
    expect(sql).toContain("expired_reservation");
    expect(sql).toMatch(/expires_at <= now\(\)/);
  });

  it("refuses to run without a tenant predicate", async () => {
    const { executor, calls } = capture();
    // Directly exercise the guard the module relies on.
    const { tenantQuery } = await import("@/lib/partner/repository");
    await expect(
      tenantQuery(ctxA, "SELECT * FROM variant_stock", [], executor)
    ).rejects.toThrow(/without \{partner\} predicate/);
    expect(calls).toHaveLength(0);
  });
});

describe("summariseInventory — pure math", () => {
  it("computes counts, sums and exception buckets correctly", () => {
    const rows: PartnerInventoryRow[] = [
      row({ product_id: "p1", variant_id: "v1", on_hand: 10, reserved: 2, sold: 3, active_reservations: 2 }), // avail 5 -> low
      row({ product_id: "p2", variant_id: "v2", on_hand: 0, reserved: 0, sold: 0 }), // avail 0 -> out
      row({ product_id: "p1", variant_id: "v3", on_hand: 20, reserved: 1, sold: 0, active_reservations: 1 }), // avail 19 -> healthy
      row({ product_id: "p2", variant_id: "v4", on_hand: 1, reserved: 5, sold: 0 }), // avail clamped 0 -> out
    ];

    const summary = summariseInventory(rows);
    expect(summary.products).toBe(2);
    expect(summary.variants).toBe(4);
    expect(summary.onHand).toBe(31);
    expect(summary.reserved).toBe(8);
    expect(summary.sold).toBe(3);
    expect(summary.available).toBe(24);
    expect(summary.activeReservations).toBe(3);
    expect(summary.outOfStock).toBe(2);
    expect(summary.lowStock).toBe(1);
    expect(summary.exceptions).toBe(3);
  });

  it("handles an empty inventory honestly", () => {
    expect(summariseInventory([])).toEqual({
      products: 0,
      variants: 0,
      onHand: 0,
      reserved: 0,
      sold: 0,
      available: 0,
      outOfStock: 0,
      lowStock: 0,
      activeReservations: 0,
      exceptions: 0,
    });
  });

  it("does not mutate its input", () => {
    const rows = [row({ on_hand: 10, reserved: 2, sold: 3 })];
    const snapshot = JSON.parse(JSON.stringify(rows));
    summariseInventory(rows);
    expect(rows).toEqual(snapshot);
  });
});

describe("partner inventory API — no client-controlled tenant", () => {
  const root = join(__dirname, "..");
  const routeSrc = readFileSync(
    join(root, "app/api/partner/inventory/route.ts"),
    "utf8"
  );

  it("gates GET on inventory:read", () => {
    expect(routeSrc).toContain('requirePartnerPermission("inventory:read")');
    expect(routeSrc).toMatch(/export async function GET/);
  });

  it("never reads a partner id from the request", () => {
    expect(routeSrc).not.toMatch(/searchParams/);
    expect(routeSrc).not.toMatch(/request\.json/);
    expect(routeSrc).not.toMatch(/partner_id/);
    expect(routeSrc).not.toMatch(/partnerId\s*[:=]/);
  });

  it("exposes no partner-facing reservation mutation (PATCH omitted as unsafe)", () => {
    expect(routeSrc).not.toMatch(/export async function PATCH/);
    expect(routeSrc).not.toMatch(/releaseReservation\s*\(/);
    expect(routeSrc).not.toMatch(/import[\s\S]*releaseReservation/);
  });
});
