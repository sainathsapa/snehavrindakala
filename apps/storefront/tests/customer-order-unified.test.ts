import { describe, it, expect } from "vitest";
import {
  buildCustomerOrderView,
  overallStatus,
  UNKNOWN_PARTNER_DISPLAY_NAME,
  type CustomerOrderSource,
} from "@/lib/customer-order/unified";
import type {
  FulfilmentGroup,
  FulfilmentStatus,
  FulfilmentLineItem,
} from "@/lib/fulfilment/types";

const ORDER_ID = "order-1042";

const fl = (
  item_id: string,
  quantity: number,
  title = `Title ${item_id}`
): FulfilmentLineItem => ({ item_id, quantity, title, order_id: ORDER_ID });

const makeGroup = (overrides: Partial<FulfilmentGroup> & { partner_id: string }): FulfilmentGroup => ({
  id: `fg-${overrides.partner_id}`,
  customer_order_id: ORDER_ID,
  status: "assigned",
  items: [],
  assignment_history: [],
  ...overrides,
});

const parent = (items: CustomerOrderSource["items"] = []): CustomerOrderSource => ({
  id: ORDER_ID,
  display_id: 1042,
  created_at: "2026-11-20T10:00:00.000Z",
  items,
});

const directory: Record<string, string> = {
  "partner-A": "Asha Arts",
  "partner-B": "Bihar Handicrafts",
  "partner-C": "Chitra Studio",
};

/* ── overallStatus: pure status aggregation ────────────────────────────────── */

describe("overallStatus — status aggregation", () => {
  const s = (status: FulfilmentStatus) => ({ status });

  const cases: Array<[string, FulfilmentStatus[], string]> = [
    ["no groups", [], "no_fulfilment"],
    ["all assigned", ["assigned", "assigned"], "pending"],
    ["assigned + dispatched", ["assigned", "dispatched"], "in_progress"],
    ["all dispatched", ["dispatched", "dispatched"], "in_progress"],
    ["all delivered", ["delivered", "delivered"], "fulfilled"],
    ["delivered + dispatched", ["delivered", "dispatched"], "partially_fulfilled"],
    ["all cancelled", ["cancelled", "cancelled"], "cancelled"],
    ["delivered + cancelled", ["delivered", "cancelled"], "partially_cancelled"],
    ["assigned + cancelled", ["assigned", "cancelled"], "partially_cancelled"],
    ["any rejected", ["delivered", "rejected"], "attention_needed"],
    ["all rejected", ["rejected", "rejected"], "attention_needed"],
    ["rejected takes precedence over cancellation", ["rejected", "cancelled"], "attention_needed"],
  ];

  for (const [label, statuses, expected] of cases) {
    it(`${label} -> ${expected}`, () => {
      expect(overallStatus(statuses.map(s))).toBe(expected);
    });
  }

  it("reads only the status field and does not mutate its input", () => {
    const groups = Object.freeze([
      Object.freeze({ status: "delivered" as const, id: "x", partner_id: "secret" }),
      Object.freeze({ status: "packing" as const, id: "y", partner_id: "secret2" }),
    ]);
    expect(overallStatus(groups)).toBe("partially_fulfilled");
    expect(groups[0].status).toBe("delivered");
  });
});

/* ── buildCustomerOrderView: multi-partner merge ───────────────────────────── */

describe("buildCustomerOrderView — multi-partner merge", () => {
  const parentOrder = parent([
    { id: "line-1", title: "Painting A", quantity: 2 },
    { id: "line-2", title: "Vase B", quantity: 1 },
    { id: "line-3", title: "Scarf C", quantity: 3 },
    { id: "line-4", title: "Vase B again", quantity: 1 },
  ]);
  const groups: FulfilmentGroup[] = [
    makeGroup({
      partner_id: "partner-A",
      status: "dispatched",
      items: [fl("line-1", 2), fl("line-2", 1)],
    }),
    makeGroup({
      partner_id: "partner-C",
      status: "packing",
      items: [fl("line-3", 3)],
    }),
    makeGroup({
      partner_id: "partner-A", // second product line owned by the SAME partner
      status: "delivered",
      items: [fl("line-4", 1)],
    }),
  ];

  it("returns one unified order with every parent item", () => {
    const view = buildCustomerOrderView(parentOrder, groups, directory);
    expect(view.order_id).toBe(ORDER_ID);
    expect(view.display_id).toBe(1042);
    expect(view.items.map((i) => i.item_id)).toEqual([
      "line-1",
      "line-2",
      "line-3",
      "line-4",
    ]);
  });

  it("annotates each item with its owning partner's PUBLIC display name", () => {
    const view = buildCustomerOrderView(parentOrder, groups, directory);
    expect(view.items.map((i) => i.partner_display_name)).toEqual([
      "Asha Arts",
      "Asha Arts",
      "Chitra Studio",
      "Asha Arts",
    ]);
    expect(view.items.map((i) => i.fulfilment_status)).toEqual([
      "dispatched",
      "dispatched",
      "packing",
      "delivered",
    ]);
  });

  it("reports per-group fulfilment progress by partner (no partner ids)", () => {
    const view = buildCustomerOrderView(parentOrder, groups, directory);
    expect(view.fulfilment).toHaveLength(3);
    expect(view.fulfilment[0]).toEqual({
      partner_display_name: "Asha Arts",
      status: "dispatched",
      item_count: 2,
      total_quantity: 3,
      progress_stage: 4,
      progress_label: "shipped",
    });
    expect(view.fulfilment[1].partner_display_name).toBe("Chitra Studio");
    expect(view.fulfilment[1].progress_label).toBe("in_progress");
    expect(view.fulfilment[2].status).toBe("delivered");
    expect(view.fulfilment[2].progress_stage).toBe(5);
  });

  it("derives the overall status from the group statuses", () => {
    const view = buildCustomerOrderView(parentOrder, groups, directory);
    expect(view.overall_status).toBe("partially_fulfilled");
    expect(view.summary).toEqual({
      total_items: 4,
      total_quantity: 7,
      group_count: 3,
      delivered_group_count: 1,
      active_group_count: 2,
      cancelled_group_count: 0,
      rejected_group_count: 0,
    });
  });
});

/* ── partial fulfilment / single partner / empty ───────────────────────────── */

describe("buildCustomerOrderView — remaining scenarios", () => {
  it("partial fulfilment: one group delivered, another still in progress", () => {
    const view = buildCustomerOrderView(
      parent([
        { id: "l1", title: "Delivered item", quantity: 1 },
        { id: "l2", title: "In-flight item", quantity: 2 },
      ]),
      [
        makeGroup({ partner_id: "partner-A", status: "delivered", items: [fl("l1", 1)] }),
        makeGroup({ partner_id: "partner-B", status: "ready_for_dispatch", items: [fl("l2", 2)] }),
      ],
      directory
    );
    expect(view.overall_status).toBe("partially_fulfilled");
    expect(view.summary.delivered_group_count).toBe(1);
    expect(view.summary.active_group_count).toBe(1);
    expect(view.items[0].fulfilment_status).toBe("delivered");
    expect(view.items[1].partner_display_name).toBe("Bihar Handicrafts");
  });

  it("single-partner case: one group covers all items", () => {
    const view = buildCustomerOrderView(
      parent([
        { id: "l1", quantity: 1 },
        { id: "l2", quantity: 1 },
      ]),
      [makeGroup({ partner_id: "partner-A", status: "delivered", items: [fl("l1", 1), fl("l2", 1)] })],
      directory
    );
    expect(view.fulfilment).toHaveLength(1);
    expect(view.fulfilment[0].partner_display_name).toBe("Asha Arts");
    expect(view.items.every((i) => i.partner_display_name === "Asha Arts")).toBe(true);
    expect(view.overall_status).toBe("fulfilled");
    expect(view.summary.group_count).toBe(1);
  });

  it("empty groups: no fulfilment, items shown as unmapped", () => {
    const view = buildCustomerOrderView(
      parent([{ id: "l1", quantity: 4, title: "Unmapped" }]),
      [],
      directory
    );
    expect(view.overall_status).toBe("no_fulfilment");
    expect(view.fulfilment).toEqual([]);
    expect(view.items[0]).toMatchObject({
      item_id: "l1",
      quantity: 4,
      partner_display_name: null,
      fulfilment_status: null,
    });
    expect(view.summary).toEqual({
      total_items: 1,
      total_quantity: 4,
      group_count: 0,
      delivered_group_count: 0,
      active_group_count: 0,
      cancelled_group_count: 0,
      rejected_group_count: 0,
    });
  });

  it("an item with no group stays unmapped while its siblings are mapped", () => {
    const view = buildCustomerOrderView(
      parent([
        { id: "mapped", quantity: 1 },
        { id: "unmapped", quantity: 1 },
      ]),
      [makeGroup({ partner_id: "partner-B", status: "accepted", items: [fl("mapped", 1)] })],
      directory
    );
    expect(view.items[0].partner_display_name).toBe("Bihar Handicrafts");
    expect(view.items[1].partner_display_name).toBeNull();
    expect(view.items[1].fulfilment_status).toBeNull();
    expect(view.overall_status).toBe("in_progress");
  });
});

/* ── no private/financial data leak ────────────────────────────────────────── */

const FORBIDDEN_KEYS = new Set([
  "partner_id",
  "partnerId",
  "legal_name",
  "contact_email",
  "contact_phone",
  "business_profile",
  "registration_details",
  "commission",
  "commission_rate",
  "payout",
  "payout_amount",
  "earnings",
  "amount",
  "price",
  "unit_price",
  "total",
  "subtotal",
  "tax",
  "tax_total",
  "shipping_total",
  "discount_total",
  "currency",
  "currency_code",
  "payment",
  "payment_id",
  "payment_status",
  "payment_collections",
  "refund",
  "refund_amount",
  "refund_id",
  "assignment_history",
  "rejection_reason",
  "shipment_id",
  "fulfilment_deadline",
  "actor",
  "email",
  "customer",
  "customer_id",
  "shipping_address",
  "billing_address",
  "password_hash",
  "token_version",
]);

function collectKeys(value: unknown, out = new Set<string>()): Set<string> {
  if (Array.isArray(value)) {
    value.forEach((v) => collectKeys(v, out));
  } else if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      out.add(key);
      collectKeys(child, out);
    }
  }
  return out;
}

describe("buildCustomerOrderView — no private/financial field leak", () => {
  const leakingParent = {
    id: ORDER_ID,
    status: "completed",
    fulfillment_status: "fulfilled",
    payment_status: "paid",
    total: 999999,
    subtotal: 888888,
    tax_total: 11111,
    currency_code: "INR",
    payment_collections: [{ id: "pay-secret-id", amount: 999999 }],
    customer: { email: "buyer-private@example.com" },
    shipping_address: { phone: "9999999999" },
    items: [{ id: "l1", title: "Item", quantity: 1, unit_price: 5000, total: 5000 }],
  } as unknown as CustomerOrderSource;

  const leakingGroup = {
    id: "fg-secret-db-id",
    customer_order_id: ORDER_ID,
    partner_id: "partner-private-id",
    status: "dispatched",
    items: [fl("l1", 1)],
    legal_name: "Super Secret Legal Name",
    contact_email: "finance-private@example.com",
    contact_phone: "8888888888",
    business_profile: { gstin: "PRIVATE-GSTIN" },
    registration_details: { bank: "PRIVATE-BANK" },
    commission_rate: 0.3,
    payout_amount: 123456,
    assignment_history: [
      { at: "2026-01-01", from: null, to: "assigned", actor: "ops-private@example.com" },
    ],
    rejection_reason: "internal-only-note",
    shipment_id: "secret-tracking-number",
    fulfilment_deadline: "2026-12-01",
  } as unknown as FulfilmentGroup;

  it("emits only allowlisted keys, never a private or financial key", () => {
    const view = buildCustomerOrderView(leakingParent, [leakingGroup], directory);
    const keys = collectKeys(view);
    const leaked = [...keys].filter((k) => FORBIDDEN_KEYS.has(k));
    expect(leaked).toEqual([]);
  });

  it("never serializes private values or the internal partner id", () => {
    const view = buildCustomerOrderView(leakingParent, [leakingGroup], directory);
    const serialized = JSON.stringify(view);
    for (const secret of [
      "partner-private-id",
      "fg-secret-db-id",
      "Super Secret Legal Name",
      "finance-private@example.com",
      "PRIVATE-GSTIN",
      "PRIVATE-BANK",
      "ops-private@example.com",
      "internal-only-note",
      "secret-tracking-number",
      "pay-secret-id",
      "buyer-private@example.com",
      "9999999999",
      "paid",
      "999999",
      "123456",
    ]) {
      expect(serialized, `leaked: ${secret}`).not.toContain(secret);
    }
    // Only the public display name is exposed for the partner.
    expect(view.fulfilment[0].partner_display_name).toBe(UNKNOWN_PARTNER_DISPLAY_NAME);
  });

  it("uses the public display name and still never emits the partner id", () => {
    const dir = new Map([["partner-private-id", "Public Studio Name"]]);
    const view = buildCustomerOrderView(leakingParent, [leakingGroup], dir);
    const serialized = JSON.stringify(view);
    expect(serialized).toContain("Public Studio Name");
    expect(serialized).not.toContain("partner-private-id");
  });
});

/* ── purity / never alters parent or payment references ────────────────────── */

describe("buildCustomerOrderView — purity and reference safety", () => {
  it("does not mutate frozen parent or group inputs and returns fresh objects", () => {
    const parentItem = Object.freeze({ id: "l1", title: "Item", quantity: 1 });
    const groupItem = Object.freeze(fl("l1", 1));
    const frozenParent = Object.freeze({
      id: ORDER_ID,
      items: Object.freeze([parentItem]),
      payment_collections: Object.freeze([Object.freeze({ id: "pay-1" })]),
    }) as unknown as CustomerOrderSource;
    const frozenGroup = Object.freeze(
      makeGroup({
        partner_id: "partner-A",
        status: "delivered",
        items: Object.freeze([groupItem]) as unknown as FulfilmentLineItem[],
        assignment_history: Object.freeze([]) as any,
      })
    ) as unknown as FulfilmentGroup;
    const groups = Object.freeze([frozenGroup]);

    const view = buildCustomerOrderView(frozenParent, groups, directory);

    expect(view.overall_status).toBe("fulfilled");
    expect(frozenParent.items?.[0]).toBe(parentItem);
    expect(frozenGroup.items[0]).toBe(groupItem);
    // Output objects are fresh copies, not references into the inputs.
    expect(view.items[0]).not.toBe(parentItem);
    expect(view.fulfilment[0]).not.toBe(frozenGroup);
  });

  it("never emits or alters the parent's payment reference", () => {
    const paymentRef = { id: "pay-ref-123", amount: 777 };
    const source = {
      ...parent([{ id: "l1", quantity: 1 }]),
      payment_collections: [paymentRef],
    } as unknown as CustomerOrderSource;

    const view = buildCustomerOrderView(source, [], directory);

    expect(JSON.stringify(view)).not.toContain("pay-ref-123");
    expect(JSON.stringify(view)).not.toContain("payment");
    expect(source.payment_collections).toEqual([paymentRef]);
  });
});
