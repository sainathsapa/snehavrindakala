/**
 * FINAL GO — QA coverage for the pure integration layer (A106).
 *
 * Tests the three-way link partner fulfilment group -> customer-facing order
 * status -> shipment status, in both Scenario A (single partner) and Scenario B
 * (multi-partner cart). Everything is fixture-based and deterministic: the
 * module performs no DB / network / payment / email / deploy I/O and spends no
 * credentials, so these are real business-outcome assertions, not mocks.
 *
 * Gate honesty: these tests prove the decision layer is correct for fixtures.
 * They do NOT claim a live carrier webhook, real partner accounts or a deployed
 * stack — those remain owner-gated / live-only.
 */

import { describe, it, expect } from "vitest";
import {
  deriveCustomerStatus,
  allGroupsDelivered,
  syncStatuses,
  shipmentToGroupStatus,
  PARENT_DELIVERED_STATUS,
  type ShipmentEvent,
} from "@/lib/integration/order-sync";
import { overallStatus } from "@/lib/customer-order/unified";
import { mapShiprocketStatus } from "@/lib/shipping/verify";
import type {
  FulfilmentGroup,
  FulfilmentStatus,
} from "@/lib/fulfilment/types";

const ORDER_ID = "order-sync-9001";

const mkGroup = (
  overrides: Partial<FulfilmentGroup> & { id: string; partner_id: string }
): FulfilmentGroup => ({
  customer_order_id: ORDER_ID,
  status: "assigned",
  items: [],
  assignment_history: [],
  ...overrides,
});

const s = (status: FulfilmentStatus) => ({ status });

const dispatch = (id: string, partner_id: string, shipmentId?: string): FulfilmentGroup =>
  mkGroup({ id, partner_id, status: "dispatched", shipment_id: shipmentId ?? null });

/* ───────────── 1. deriveCustomerStatus: rollup (Scenario A + B) ───────────── */

describe("deriveCustomerStatus — single/multi-partner status rollup", () => {
  it("all groups delivered -> parent delivered ('fulfilled')", () => {
    expect(deriveCustomerStatus([s("delivered")])).toBe("fulfilled");
    expect(deriveCustomerStatus([s("delivered"), s("delivered")])).toBe(
      PARENT_DELIVERED_STATUS
    );
    expect(
      deriveCustomerStatus([s("delivered"), s("delivered"), s("delivered")])
    ).toBe("fulfilled");
  });

  it("no groups -> no_fulfilment", () => {
    expect(deriveCustomerStatus([])).toBe("no_fulfilment");
  });

  it("all assigned -> pending; all in-flight -> in_progress", () => {
    expect(deriveCustomerStatus([s("assigned"), s("assigned")])).toBe("pending");
    expect(deriveCustomerStatus([s("dispatched"), s("packing")])).toBe("in_progress");
  });

  it("partial fulfilment -> partially_fulfilled (delivered + active)", () => {
    expect(deriveCustomerStatus([s("delivered"), s("dispatched")])).toBe(
      "partially_fulfilled"
    );
  });

  it("partial cancellation -> partially_cancelled", () => {
    expect(deriveCustomerStatus([s("delivered"), s("cancelled")])).toBe(
      "partially_cancelled"
    );
    expect(deriveCustomerStatus([s("assigned"), s("cancelled")])).toBe(
      "partially_cancelled"
    );
    expect(deriveCustomerStatus([s("cancelled"), s("cancelled")])).toBe("cancelled");
  });

  it("delegates to A101 overallStatus for every status combination (single source of truth)", () => {
    const statuses: FulfilmentStatus[] = [
      "assigned", "accepted", "packing", "ready_for_dispatch",
      "dispatched", "delivered", "rejected", "cancelled",
    ];
    for (const a of statuses) {
      for (const b of statuses) {
        const groups = [s(a), s(b)];
        expect(deriveCustomerStatus(groups)).toBe(overallStatus(groups));
      }
    }
  });

  it("allGroupsDelivered is true only with >=1 group and every group delivered", () => {
    expect(allGroupsDelivered([])).toBe(false);
    expect(allGroupsDelivered([s("delivered"), s("dispatched")])).toBe(false);
    expect(allGroupsDelivered([s("delivered"), s("delivered")])).toBe(true);
  });

  it("does not mutate its input", () => {
    const groups = Object.freeze([Object.freeze(s("delivered"))]);
    expect(deriveCustomerStatus(groups)).toBe("fulfilled");
    expect(groups[0].status).toBe("delivered");
  });
});

/* ───────── 2. Rejection isolation: never cancels the whole order ─────────── */

describe("rejection isolation — a partner's rejection affects only its own group", () => {
  it("one rejected group -> attention_needed, never cancelled or fulfilled", () => {
    const customer = deriveCustomerStatus([
      s("delivered"), s("rejected"), s("dispatched"),
    ]);
    expect(customer).toBe("attention_needed");
    expect(customer).not.toBe("cancelled");
    expect(customer).not.toBe("fulfilled");
  });

  it("rejection takes precedence over cancellation", () => {
    expect(deriveCustomerStatus([s("rejected"), s("cancelled")])).toBe(
      "attention_needed"
    );
  });

  it("a stray shipment event cannot resurrect a rejected group or touch its sibling", () => {
    const rejected = mkGroup({
      id: "fg-A", partner_id: "partner-A", status: "rejected",
      rejection_reason: "cannot source material",
    });
    const sibling = dispatch("fg-B", "partner-B");
    const beforeSibling = JSON.stringify(sibling);

    const result = syncStatuses(rejected, { status: "delivered" }, [rejected, sibling]);

    expect(result.reason).toBe("rejected_group");
    expect(result.groupStatus).toBe("rejected");
    expect(result.customerStatus).toBe("attention_needed");
    expect(result.customerStatus).not.toBe("cancelled");
    expect(JSON.stringify(sibling)).toBe(beforeSibling);
  });
});

/* ───────────── 3. Shipment event mapping consistency (Scenario A) ────────── */

describe("syncStatuses — shipment event mapping stays consistent (single partner)", () => {
  it("carrier 'Delivered' -> canonical 'delivered' -> group delivered -> parent fulfilled", () => {
    const group = dispatch("fg-A", "partner-A", "ship-A");
    const canonical = mapShiprocketStatus("Delivered");
    expect(canonical).toBe("delivered");

    const event: ShipmentEvent = { status: canonical, shipmentId: "ship-A" };
    const result = syncStatuses(group, event);

    expect(result.shipmentStatus).toBe("delivered");
    expect(result.groupStatus).toBe("delivered");
    expect(result.customerStatus).toBe("fulfilled");
    expect(result.groupChanged).toBe(true);
    expect(result.shipmentApplied).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it("accepts a raw carrier status and maps it through A61's canonical mapper", () => {
    const group = dispatch("fg-A", "partner-A");

    const rawResult = syncStatuses(group, { rawStatus: "Out for Delivery" });
    const canonicalResult = syncStatuses(group, {
      status: mapShiprocketStatus("Out for Delivery"),
    });

    expect(rawResult.shipmentStatus).toBe("out_for_delivery");
    expect(rawResult).toEqual(canonicalResult);
    expect(rawResult.groupStatus).toBe("dispatched");
    expect(rawResult.customerStatus).toBe("in_progress");
  });

  it("every in-flight carrier state keeps the group at 'dispatched'", () => {
    const group = dispatch("fg-A", "partner-A");
    for (const raw of ["Created", "Shipped", "In Transit", "Out for Delivery"]) {
      const result = syncStatuses(group, { rawStatus: raw });
      expect(result.groupStatus).toBe("dispatched");
      expect(result.customerStatus).toBe("in_progress");
    }
  });

  it("a failed delivery is recorded but never invents a group status or regresses it", () => {
    const group = dispatch("fg-A", "partner-A");
    const result = syncStatuses(group, { status: "failed" });

    expect(result.shipmentStatus).toBe("failed");
    expect(result.shipmentApplied).toBe(true);
    expect(result.groupStatus).toBe("dispatched");
    expect(result.groupChanged).toBe(false);
    expect(result.reason).toBe("no_group_equivalent");
    expect(shipmentToGroupStatus("failed")).toBeNull();
  });

  it("an unknown carrier status is never guessed at", () => {
    const group = dispatch("fg-A", "partner-A");
    const result = syncStatuses(group, { rawStatus: "a new carrier status" });

    expect(result.shipmentStatus).toBe("unknown");
    expect(result.shipmentApplied).toBe(false);
    expect(result.groupChanged).toBe(false);
    expect(result.reason).toBe("unknown_status");
  });

  it("a repeated delivered event is a harmless no-op", () => {
    const group = mkGroup({ id: "fg-A", partner_id: "partner-A", status: "delivered" });
    const result = syncStatuses(group, { status: "delivered" });

    expect(result.groupChanged).toBe(false);
    expect(result.reason).toBeUndefined();
    expect(result.groupStatus).toBe("delivered");
    expect(result.customerStatus).toBe("fulfilled");
  });

  it("a shipment event for a different consignment is rejected", () => {
    const group = dispatch("fg-A", "partner-A", "ship-A");
    const result = syncStatuses(group, { status: "delivered", shipmentId: "ship-B" });

    expect(result.reason).toBe("wrong_shipment");
    expect(result.groupStatus).toBe("dispatched");
    expect(result.groupChanged).toBe(false);
  });

  it("respects the forward-only group status machine (no skipped stages)", () => {
    const packing = mkGroup({ id: "fg-A", partner_id: "partner-A", status: "packing" });
    const result = syncStatuses(packing, { status: "delivered" });

    expect(result.reason).toBe("illegal_transition");
    expect(result.groupStatus).toBe("packing");
    expect(result.groupChanged).toBe(false);
  });
});

/* ───────────── 4. Multi-partner sync (Scenario B) ─────────────────────────── */

describe("syncStatuses — multi-partner cart keeps the parent consistent", () => {
  it("delivering one group yields partially_fulfilled; both delivered yields fulfilled", () => {
    const a = dispatch("fg-A", "partner-A", "ship-A");
    const b = dispatch("fg-B", "partner-B", "ship-B");

    const first = syncStatuses(a, { status: "delivered", shipmentId: "ship-A" }, [a, b]);
    expect(first.groupStatus).toBe("delivered");
    expect(first.customerStatus).toBe("partially_fulfilled");
    // Sibling is untouched by A's event.
    expect(b.status).toBe("dispatched");

    const aDelivered: FulfilmentGroup = { ...a, status: "delivered" };
    const second = syncStatuses(
      b,
      { status: "delivered", shipmentId: "ship-B" },
      [aDelivered, b]
    );
    expect(second.groupStatus).toBe("delivered");
    expect(second.customerStatus).toBe("fulfilled");
    expect(second.customerStatus).toBe(PARENT_DELIVERED_STATUS);
  });

  it("customer status is ALWAYS derived from the post-event group statuses", () => {
    const a = mkGroup({ id: "fg-A", partner_id: "partner-A", status: "assigned" });
    const b = mkGroup({ id: "fg-B", partner_id: "partner-B", status: "dispatched" });
    const c = mkGroup({ id: "fg-C", partner_id: "partner-C", status: "delivered" });

    const result = syncStatuses(a, { status: "delivered" }, [a, b, c]);
    const expected = deriveCustomerStatus([s("delivered"), s("dispatched"), s("delivered")]);

    expect(result.customerStatus).toBe(expected);
    expect(result.customerStatus).toBe("partially_fulfilled");
  });

  it("deduplicates a target that appears in allGroups and never mutates inputs", () => {
    const a = dispatch("fg-A", "partner-A");
    const before = JSON.stringify([a]);

    const result = syncStatuses(a, { status: "delivered" }, [a, a]);

    // Two identical ids count once: a single delivered group -> fulfilled (not
    // "partially_fulfilled" from a phantom duplicate).
    expect(result.customerStatus).toBe("fulfilled");
    expect(JSON.stringify([a])).toBe(before);
  });

  it("terminal groups are immutable to carrier events", () => {
    const cancelled = mkGroup({
      id: "fg-A", partner_id: "partner-A", status: "cancelled",
    });
    const result = syncStatuses(cancelled, { status: "delivered" });

    expect(result.reason).toBe("terminal_group");
    expect(result.groupStatus).toBe("cancelled");
    expect(result.groupChanged).toBe(false);
  });
});

/* ───────────── 5. No financial data leaks; purity ─────────────────────────── */

describe("data hygiene — no partner financial data and no mutation", () => {
  it("never emits partner ids, tenant ids, items or financial fields", () => {
    const dirty = mkGroup({
      id: "fg-A",
      partner_id: "partner-A",
      status: "dispatched",
      // Fields a badly-built caller might carry on a row — none may survive.
      amount: 1234,
      commission: 0.25,
      payout_amount: 999,
      earning: 10,
      payment_collections: [{ id: "pay-secret" }],
      refund_amount: 50,
      gstin: "27AAAAA0000A1Z5",
      tax: 88,
      settlement_id: "settle-secret",
      email: "buyer@example.com",
      phone: "9999999999",
    } as unknown as Parameters<typeof mkGroup>[0]);

    const before = JSON.stringify(dirty);
    const result = syncStatuses(dirty, { status: "delivered" });

    const forbidden = [
      "partner_id", "partnerId", "amount", "price", "total", "commission",
      "payout", "payout_amount", "earning", "payment", "payment_collections",
      "refund", "refund_amount", "gst", "gstin", "tax", "settlement",
      "settlement_id", "bank", "email", "phone", "items",
    ];
    for (const key of forbidden) {
      expect(Object.keys(result)).not.toContain(key);
    }

    // Exact allow-list — only the three statuses + diagnostics are emitted.
    expect(Object.keys(result).sort()).toEqual(
      [
        "orderId", "groupId", "customerStatus", "groupStatus",
        "shipmentStatus", "groupChanged", "shipmentApplied",
      ].sort()
    );
    expect(JSON.stringify(dirty)).toBe(before);
  });

  it("deriveCustomerStatus reads only the status field", () => {
    const groups = [s("delivered"), s("delivered")] as Array<
      ReturnType<typeof s> & Record<string, unknown>
    >;
    groups[0]["commission"] = 0.3;
    groups[0]["partner_id"] = "partner-A";

    expect(deriveCustomerStatus(groups)).toBe("fulfilled");
    expect(Object.keys(groups[0])).toContain("partner_id"); // input untouched
  });
});
