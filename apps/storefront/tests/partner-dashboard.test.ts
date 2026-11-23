import { describe, expect, it } from "vitest";
import {
  buildRecentOrders,
  computePartnerDashboard,
  countActiveOrders,
  isActiveFulfilmentStatus,
  sumPendingEarnings,
} from "../lib/partner-portal/dashboard";

describe("partner overview aggregation", () => {
  it("counts only fulfilment groups that are still active", () => {
    const groups = [
      { status: "assigned" },
      { status: "accepted" },
      { status: "packing" },
      { status: "ready_for_dispatch" },
      { status: "dispatched" },
      { status: "delivered" },
      { status: "cancelled" },
      { status: "rejected" },
      { status: "something_new" },
      {},
    ];
    expect(countActiveOrders(groups)).toBe(5);
    expect(isActiveFulfilmentStatus("dispatched")).toBe(true);
    expect(isActiveFulfilmentStatus("delivered")).toBe(false);
    expect(isActiveFulfilmentStatus(undefined)).toBe(false);
  });

  it("sums only unsettled, signed payable amounts (string numerics included)", () => {
    const earnings = [
      { payable_amount: "100.50", settlement_batch_id: null },
      { payable_amount: "-20.25", settlement_batch_id: null },
      { payable_amount: "500.00", settlement_batch_id: "batch-1" },
      { payable_amount: "10", settlement_batch_id: "" },
      { payable_amount: "junk", settlement_batch_id: undefined },
    ];
    const result = sumPendingEarnings(earnings);
    // 100.50 - 20.25 + 10 = 90.25; the batch row is excluded entirely.
    expect(result.amount).toBe(90.25);
    expect(result.entries).toBe(4);
  });

  it("orders recent orders newest-first, caps the list and tolerates bad dates", () => {
    const groups = [
      { id: "old", customer_order_id: "ord-1", status: "delivered", items: [1], created_at: "2024-01-01T00:00:00Z" },
      { id: "new", customer_order_id: "ord-2", status: "assigned", items: [1, 2, 3], created_at: "2025-06-01T00:00:00Z" },
      { id: "bad", customer_order_id: "ord-3", status: "packing", created_at: "not-a-date" },
    ];
    const orders = buildRecentOrders(groups, 2);
    expect(orders.map((o) => o.id)).toEqual(["new", "old"]);
    expect(orders[0].itemCount).toBe(3);
    expect(buildRecentOrders(groups, 1)[0].id).toBe("new");
    // Invalid dates become a null label rather than throwing.
    expect(buildRecentOrders(groups, 10).find((o) => o.id === "bad")?.createdAt).toBeNull();
  });

  it("computes all figures together from the three repository arrays", () => {
    const groups = [
      { id: "g1", customer_order_id: "o1", status: "assigned", items: [1], created_at: "2025-05-01T00:00:00Z" },
      { id: "g2", customer_order_id: "o2", status: "delivered", items: [1, 2], created_at: "2025-05-02T00:00:00Z" },
    ];
    const products = [{ id: "p1" }, { id: "p2" }, { id: "p3" }];
    const earnings = [
      { payable_amount: "250.00", settlement_batch_id: null },
      { payable_amount: "999.00", settlement_batch_id: "settled" },
    ];

    const data = computePartnerDashboard(groups, products, earnings);
    expect(data.counts).toEqual({
      activeOrders: 1,
      products: 3,
      pendingEarnings: 250,
      pendingEarningsEntries: 1,
    });
    expect(data.recentOrders).toHaveLength(2);
    expect(data.recentOrders[0].customerOrderId).toBe("o2");
  });

  it("returns honest zeros and an empty list for an empty dataset", () => {
    const data = computePartnerDashboard([], [], []);
    expect(data.counts).toEqual({
      activeOrders: 0,
      products: 0,
      pendingEarnings: 0,
      pendingEarningsEntries: 0,
    });
    expect(data.recentOrders).toEqual([]);
  });
});
