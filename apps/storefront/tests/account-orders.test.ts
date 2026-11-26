import { describe, expect, it } from "vitest";
import { mergeGuestOrders } from "../lib/account-orders";

/**
 * The account's order list is a union: orders Medusa linked to the customer, plus
 * guest orders under the same address that belong to nobody. These tests pin the
 * boundary, because the failure mode here is not "missing row" but "someone
 * else's order" — a buyer seeing another household's purchase.
 */

const order = (over: Record<string, unknown>) => ({
  id: "order_1",
  created_at: "2026-01-01T00:00:00.000Z",
  ...over,
});

describe("mergeGuestOrders", () => {
  it("adds a guest order that carries the account's own address", () => {
    const merged = mergeGuestOrders(
      [],
      [order({ id: "order_g1", email: "Buyer@Example.com ", customer_id: null })],
      "buyer@example.com"
    );
    expect(merged.map((o) => o.id)).toEqual(["order_g1"]);
  });

  it("refuses an order belonging to another registered customer", () => {
    const merged = mergeGuestOrders(
      [],
      [order({ id: "order_g2", email: "buyer@example.com", customer_id: "cus_other" })],
      "buyer@example.com"
    );
    expect(merged).toHaveLength(0);
  });

  it("refuses a different address, including a +alias", () => {
    const merged = mergeGuestOrders(
      [],
      [
        order({ id: "order_g3", email: "someone@example.com", customer_id: null }),
        // A plus-alias is a different inbox for this purpose: treating it as the
        // same person would let anyone who knows an address read its orders.
        order({ id: "order_g4", email: "buyer+orders@example.com", customer_id: null }),
      ],
      "buyer@example.com"
    );
    expect(merged).toHaveLength(0);
  });

  it("shows nothing when the account has no email to match on", () => {
    const merged = mergeGuestOrders(
      [],
      [order({ id: "order_g5", email: "buyer@example.com", customer_id: null })],
      ""
    );
    expect(merged).toHaveLength(0);
  });

  it("does not duplicate an order present on both sides", () => {
    const linked = [order({ id: "order_l1", email: "buyer@example.com", customer_id: "cus_1" })];
    const guest = [order({ id: "order_l1", email: "buyer@example.com", customer_id: "cus_1" })];
    const merged = mergeGuestOrders(linked, guest, "buyer@example.com");
    expect(merged).toHaveLength(1);
  });

  it("orders newest first and respects the limit", () => {
    const merged = mergeGuestOrders(
      [order({ id: "order_old", created_at: "2025-01-01T00:00:00.000Z" })],
      [
        order({ id: "order_new", email: "buyer@example.com", customer_id: null, created_at: "2026-06-01T00:00:00.000Z" }),
        order({ id: "order_mid", email: "buyer@example.com", customer_id: null, created_at: "2025-09-01T00:00:00.000Z" }),
      ],
      "buyer@example.com",
      2
    );
    expect(merged.map((o) => o.id)).toEqual(["order_new", "order_mid"]);
  });

  it("keeps every linked order even when its email differs from the account", () => {
    // A buyer may have changed their address at Medusa after ordering. The link
    // is proof enough; email matching is only for the guest branch.
    const merged = mergeGuestOrders(
      [order({ id: "order_l2", email: "old-address@example.com", customer_id: "cus_1" })],
      [],
      "new-address@example.com"
    );
    expect(merged.map((o) => o.id)).toEqual(["order_l2"]);
  });
});
