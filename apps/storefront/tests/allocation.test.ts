import { describe, it, expect } from "vitest";
import {
  allocateItemsToPartners,
  getUnassignedItems,
  canTransition,
  isTerminal,
  assertNoDuplicateAllocation,
  hasDuplicateAllocation,
} from "@/lib/fulfilment/allocate";
import type { FulfilmentLineItem } from "@/lib/fulfilment/types";

const item = (
  id: string,
  productId: string | null,
  quantity = 1
): FulfilmentLineItem => ({
  item_id: id,
  product_id: productId,
  quantity,
  order_id: "order-1",
});

const map = {
  "product-C": "partner-C",
  "product-A": "partner-A",
  "product-B": "partner-A", // two products, same partner -> ONE group
};

describe("allocateItemsToPartners — grouping correctness", () => {
  it("creates one group per partner for a single parent customer order", () => {
    const items = [
      item("line-1", "product-C", 2),
      item("line-2", "product-A", 1),
      item("line-3", "product-B", 3),
      item("line-4", "product-C", 1),
    ];
    const groups = allocateItemsToPartners(items, map);

    expect(groups).toHaveLength(2);
    expect(groups.map((g) => g.partner_id)).toEqual(["partner-C", "partner-A"]);
    expect(groups.every((g) => g.customer_order_id === "order-1")).toBe(true);

    const byPartner = Object.fromEntries(groups.map((g) => [g.partner_id, g]));
    expect(byPartner["partner-C"].items.map((i) => i.item_id)).toEqual([
      "line-1",
      "line-4",
    ]);
    expect(byPartner["partner-A"].items.map((i) => i.item_id)).toEqual([
      "line-2",
      "line-3",
    ]);
  });

  it("is deterministic and preserves item order within a group", () => {
    const items = [
      item("line-1", "product-A"),
      item("line-2", "product-C"),
      item("line-3", "product-A"),
    ];
    const first = allocateItemsToPartners(items, map);
    const second = allocateItemsToPartners([...items].reverse(), map);
    expect(first.map((g) => g.partner_id)).toEqual(
      second.map((g) => g.partner_id)
    );
    expect(first[0].items.map((i) => i.item_id)).toEqual(["line-1", "line-3"]);
  });

  it("supports an ES Map as the product->partner mapping", () => {
    const m = new Map([
      ["product-A", "partner-A"],
      ["product-C", "partner-C"],
    ]);
    const groups = allocateItemsToPartners(
      [item("line-1", "product-A"), item("line-2", "product-C")],
      m
    );
    expect(groups.map((g) => g.partner_id)).toEqual(["partner-A", "partner-C"]);
  });

  it("omits items with no owning partner from groups and reports them as unassigned", () => {
    const items = [
      item("line-1", "product-A"),
      item("line-2", "product-UNKNOWN"),
      item("line-3", null),
    ];
    const groups = allocateItemsToPartners(items, map);
    expect(groups).toHaveLength(1);
    expect(groups[0].items.map((i) => i.item_id)).toEqual(["line-1"]);

    expect(getUnassignedItems(items, map).map((i) => i.item_id)).toEqual([
      "line-2",
      "line-3",
    ]);
  });
});

describe("duplicate allocation prevention", () => {
  const dup = [
    { customer_order_id: "order-1", partner_id: "partner-A" },
    { customer_order_id: "order-1", partner_id: "partner-A" },
  ];

  it("detects two groups for the same order + partner", () => {
    expect(hasDuplicateAllocation(dup)).toBe(true);
    expect(() => assertNoDuplicateAllocation(dup)).toThrow(/Duplicate fulfilment/);
  });

  it("allows the same partner on different customer orders", () => {
    const ok = [
      { customer_order_id: "order-1", partner_id: "partner-A" },
      { customer_order_id: "order-2", partner_id: "partner-A" },
    ];
    expect(hasDuplicateAllocation(ok)).toBe(false);
    expect(() => assertNoDuplicateAllocation(ok)).not.toThrow();
  });

  it("allows different partners on the same order", () => {
    const ok = [
      { customer_order_id: "order-1", partner_id: "partner-A" },
      { customer_order_id: "order-1", partner_id: "partner-B" },
    ];
    expect(() => assertNoDuplicateAllocation(ok)).not.toThrow();
  });

  it("allocateItemsToPartners never produces duplicates by construction", () => {
    const items = Array.from({ length: 20 }, (_, n) =>
      item(`line-${n}`, n % 2 ? "product-A" : "product-B")
    );
    expect(() =>
      assertNoDuplicateAllocation(allocateItemsToPartners(items, map))
    ).not.toThrow();
  });
});

describe("fulfilment status machine", () => {
  it("accepts every legal forward transition", () => {
    const legal: Array<[any, any]> = [
      ["assigned", "accepted"],
      ["accepted", "packing"],
      ["packing", "ready_for_dispatch"],
      ["ready_for_dispatch", "dispatched"],
      ["dispatched", "delivered"],
      ["assigned", "rejected"],
      ["assigned", "cancelled"],
      ["rejected", "cancelled"],
    ];
    for (const [from, to] of legal) {
      expect(canTransition(from, to), `${from}->${to}`).toBe(true);
    }
  });

  it("rejects skips, reversals, self-transitions and moves from terminal states", () => {
    const illegal: Array<[any, any]> = [
      ["assigned", "dispatched"],
      ["accepted", "delivered"],
      ["accepted", "assigned"],
      ["packing", "accepted"],
      ["assigned", "assigned"],
      ["delivered", "cancelled"],
      ["cancelled", "accepted"],
      ["rejected", "accepted"],
    ];
    for (const [from, to] of illegal) {
      expect(canTransition(from, to), `${from}->${to}`).toBe(false);
    }
  });

  it("reports only delivered and cancelled as terminal", () => {
    expect(isTerminal("delivered")).toBe(true);
    expect(isTerminal("cancelled")).toBe(true);
    expect(isTerminal("assigned")).toBe(false);
    expect(isTerminal("accepted")).toBe(false);
    // rejected can be administratively cancelled, so it is not a sink.
    expect(isTerminal("rejected")).toBe(false);
  });
});
