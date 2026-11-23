import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { buildPayabilityResolver } from "@/lib/finance/payability-resolver";
import { explainPayability } from "@/lib/finance/settlement";
import type {
  CommissionPolicy,
  EarningsEntry,
  PayabilityContext,
  QueryExecutor,
} from "@/lib/finance/types";

/**
 * A05 (payable_when) is only closed if the settlement route supplies a resolver
 * built from real order/shipment/return/refund state. These tests exercise that
 * resolver with a fake query executor (no live DB) and pin the route wiring.
 * Every unproven fact must fail closed.
 */

const repo = join(__dirname, "..", "..", "..");
const read = (p: string) => readFileSync(join(repo, p), "utf8");

function policy(payable_when: string): CommissionPolicy {
  return {
    id: "policy-1",
    name: "Standard",
    scope: "global",
    scope_ref: null,
    rate_basis: "gross_item_value",
    tax_included: false,
    shipping_included: false,
    rate_percent: 10,
    fixed_amount: null,
    currency: "INR",
    refund_effect: "reverse_earnings",
    payable_when,
    status: "active",
    version: 1,
    effective_from: "2020-01-01T00:00:00Z",
    effective_to: null,
    approved_by: "finance@test",
  } as CommissionPolicy;
}

function earning(overrides: Partial<EarningsEntry> = {}): EarningsEntry {
  return {
    id: "entry-1",
    partner_id: "partner-A",
    order_id: "order-1",
    item_id: "item-1",
    entry_type: "earning",
    gross_basis: 1000,
    discount: 0,
    tax_amount: 0,
    shipping_amount: 0,
    commission_amount: 100,
    payable_amount: 900,
    currency: "INR",
    commission_policy_id: "policy-1",
    reverses_entry_id: null,
    settlement_batch_id: null,
    idempotency_key: "idem-1",
    ...overrides,
  } as EarningsEntry;
}

interface World {
  order?: Record<string, any>;
  returns?: Record<string, any>[];
  refunds?: Record<string, any>[];
  shipments?: Record<string, any>[];
}

function fakeQuery(world: World): QueryExecutor {
  return (async (sql: string) => {
    if (/FROM "order"/.test(sql)) return world.order ? [world.order] : [];
    if (/return_requests/.test(sql)) return world.returns ?? [];
    if (/order_refunds/.test(sql)) return world.refunds ?? [];
    if (/order_shipments/.test(sql)) return world.shipments ?? [];
    throw new Error(`unexpected query: ${sql}`);
  }) as QueryExecutor;
}

const daysAgo = (d: number) =>
  new Date(Date.now() - d * 24 * 60 * 60 * 1000).toISOString();

async function decide(
  payable_when: string,
  world: World,
  windowDays: number | null = 7
) {
  const p = policy(payable_when);
  const resolver = await buildPayabilityResolver([earning()], [p], {
    query: fakeQuery(world),
    returnWindowDays: windowDays,
  });
  const evaluate = resolver as (e: EarningsEntry) => PayabilityContext;
  return explainPayability(evaluate(earning()));
}

describe("buildPayabilityResolver", () => {
  it("settles an order_paid policy only when payment is captured", async () => {
    const paid = await decide("order_paid", {
      order: { id: "order-1", status: "completed", payment_status: "paid", fulfillment_status: "fulfilled" },
    });
    expect(paid.payable).toBe(true);

    const unpaid = await decide("order_paid", {
      order: { id: "order-1", status: "pending", payment_status: "awaiting", fulfillment_status: "pending" },
    });
    expect(unpaid.payable).toBe(false);
    expect(unpaid.reason).toMatch(/ORDER_NOT_PAID/);
  });

  it("settles order_delivered only with a delivered order", async () => {
    const delivered = await decide("order_delivered", {
      order: { id: "order-1", status: "completed", payment_status: "paid", fulfillment_status: "delivered" },
      shipments: [{ order_id: "order-1", status: "delivered", updated_at: daysAgo(2) }],
    });
    expect(delivered.payable).toBe(true);

    const notDelivered = await decide("order_delivered", {
      order: { id: "order-1", status: "completed", payment_status: "paid", fulfillment_status: "shipped" },
    });
    expect(notDelivered.payable).toBe(false);
    expect(notDelivered.reason).toMatch(/ORDER_NOT_DELIVERED/);
  });

  it("uses owner window for return_window_elapsed and never invents one", async () => {
    const world: World = {
      order: { id: "order-1", status: "completed", payment_status: "paid", fulfillment_status: "delivered" },
      shipments: [{ order_id: "order-1", status: "delivered", updated_at: daysAgo(10) }],
    };
    expect((await decide("return_window_elapsed", world, 7)).payable).toBe(true);
    expect((await decide("return_window_elapsed", world, 30)).reason).toMatch(/RETURN_WINDOW_OPEN/);
    expect((await decide("return_window_elapsed", world, null)).reason).toMatch(/RETURN_WINDOW_UNCONFIGURED/);
  });

  it("blocks on refund, pending return or cancellation even when otherwise payable", async () => {
    const base = {
      order: { id: "order-1", status: "completed", payment_status: "paid", fulfillment_status: "delivered" },
      shipments: [{ order_id: "order-1", status: "delivered", updated_at: daysAgo(10) }],
    };
    expect(
      (await decide("order_paid", { ...base, refunds: [{ order_id: "order-1", status: "approved" }] })).reason
    ).toMatch(/REFUND_ISSUED/);
    expect(
      (await decide("order_paid", { ...base, returns: [{ order_id: "order-1", status: "pending" }] })).reason
    ).toMatch(/PENDING_RETURN/);
    expect(
      (await decide("order_paid", { ...base, order: { ...base.order, status: "canceled" } })).reason
    ).toMatch(/ORDER_CANCELLED/);
  });

  it("fails closed when the order row is missing or the policy is unknown", async () => {
    const missingOrder = await decide("order_paid", {});
    expect(missingOrder.payable).toBe(false);

    const p = policy("order_paid");
    const resolver = await buildPayabilityResolver(
      [earning({ commission_policy_id: "no-such-policy" })],
      [p],
      { query: fakeQuery({ order: { id: "order-1", payment_status: "paid" } }) }
    );
    const evaluate = resolver as (e: EarningsEntry) => PayabilityContext;
    expect(explainPayability(evaluate(earning({ commission_policy_id: "no-such-policy" }))).payable).toBe(false);
  });
});

describe("settlements route wiring", () => {
  it("builds a real resolver and enforces it on both the list and batch paths", () => {
    const route = read("apps/storefront/app/api/admin/settlements/route.ts");
    expect(route).toMatch(/buildPayabilityResolver/);
    expect(route).toMatch(/listEligibleLedgerEntries\(undefined, payability\)/);
    expect(route).toMatch(/createBatch\(entries, \{ start, end \}, policies, payability\)/);
  });
});
