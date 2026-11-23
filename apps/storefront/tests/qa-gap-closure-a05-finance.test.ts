/**
 * A10 INDEPENDENT QA — A05 finance policy wiring (pure + static + fake query).
 *
 * Independently pins refund_effect/payable_when fail-closed, dual control, the
 * DB constraints in 008, and that the settlements route builds a PayabilityResolver
 * from real order/shipment/return/refund state and passes it to BOTH listing and
 * batch creation. No live DB, policy values or payouts are used.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  assertKnownPayableWhen,
  assertKnownRefundEffect,
} from "@/lib/finance/commission-policy";
import {
  explainPayability,
  type PayabilityFacts,
} from "@/lib/finance/settlement";
import { buildPayabilityResolver } from "@/lib/finance/payability-resolver";
import { shouldReverseEarnings } from "@/lib/finance/ledger";
import { assertDualControl } from "@/lib/payments/refund-execution";
import type {
  CommissionPolicy,
  EarningsEntry,
  PayabilityContext,
} from "@/lib/finance/types";

const app = join(__dirname, "..");
const read = (rel: string) => readFileSync(join(app, rel), "utf8");

function policy(overrides: Partial<CommissionPolicy> = {}): CommissionPolicy {
  return {
    id: "pol-qa-1",
    name: "QA policy",
    scope: "global",
    scope_ref: null,
    rate_basis: "gross_item_value",
    tax_included: false,
    shipping_included: false,
    rate_percent: 10,
    fixed_amount: null,
    currency: "INR",
    refund_effect: "reverse_earnings",
    payable_when: "order_delivered",
    status: "active",
    version: 1,
    effective_from: null,
    effective_to: null,
    approved_by: "admin-qa",
    ...overrides,
  };
}

function context(overrides: Partial<PayabilityContext> = {}): PayabilityContext {
  return {
    payable_when: "order_paid",
    orderPaid: true,
    orderDelivered: true,
    orderCancelled: false,
    refundIssued: false,
    pendingReturn: false,
    settlementHeld: false,
    daysSinceDelivery: 10,
    returnWindowDays: 7,
    ...overrides,
  };
}

const entry: EarningsEntry = {
  partner_id: "p-qa",
  order_id: "ord-qa-1",
  item_id: "item-qa-1",
  entry_type: "earning",
  gross_basis: 1000,
  discount: 0,
  tax_amount: 0,
  shipping_amount: 0,
  commission_amount: 100,
  payable_amount: 900,
  currency: "INR",
  commission_policy_id: "pol-qa-1",
  reverses_entry_id: null,
  settlement_batch_id: null,
  idempotency_key: "ek-qa-1",
};

describe("A05 — refund_effect / payable_when fail closed", () => {
  it("unknown or missing rule values throw instead of inventing behaviour", () => {
    expect(() => assertKnownRefundEffect("reverse_earnings")).not.toThrow();
    expect(() => assertKnownRefundEffect("no_reversal")).not.toThrow();
    expect(() => assertKnownRefundEffect("burn_it")).toThrow();
    expect(() => assertKnownRefundEffect(undefined)).toThrow();
    expect(() => assertKnownPayableWhen("order_paid")).not.toThrow();
    expect(() => assertKnownPayableWhen("whenever")).toThrow();
    expect(() => assertKnownPayableWhen(null)).toThrow();
  });

  it("an unknown refund effect never posts a reversal", () => {
    expect(shouldReverseEarnings("reverse_earnings")).toBe(true);
    expect(shouldReverseEarnings("no_reversal")).toBe(false);
    expect(() => shouldReverseEarnings("unknown")).toThrow();
  });

  it("explainPayability refuses unknown rules and unproven return-window state", () => {
    expect(explainPayability(context({ payable_when: "UNKNOWN" })).payable).toBe(false);
    expect(explainPayability(context({ payable_when: "whenever" })).payable).toBe(false);
    expect(explainPayability(null).payable).toBe(false);
    expect(
      explainPayability(context({ payable_when: "return_window_elapsed", returnWindowDays: null }))
        .reason
    ).toMatch(/UNCONFIGURED/);
    expect(
      explainPayability(context({ payable_when: "return_window_elapsed", daysSinceDelivery: null }))
        .reason
    ).toMatch(/DELIVERY_DATE_UNKNOWN/);
    expect(
      explainPayability(context({ payable_when: "return_window_elapsed", daysSinceDelivery: 7 }))
        .payable
    ).toBe(false); // boundary day is still inside the window
    expect(
      explainPayability(context({ payable_when: "return_window_elapsed", daysSinceDelivery: 8 }))
        .payable
    ).toBe(true);
  });

  it("dual control (requester != approver) is enforced in code", () => {
    expect(() => assertDualControl("admin-qa", "admin-qa")).toThrow();
    expect(() => assertDualControl("a-qa", "b-qa")).not.toThrow();
  });
});

describe("A05 — PayabilityResolver is built from real order state", () => {
  function fakeQuery(rows: {
    orders?: any[];
    returns?: any[];
    refunds?: any[];
    shipments?: any[];
  }) {
    return async (sql: string, _params: any[] = []): Promise<any[]> => {
      const s = sql.replace(/\s+/g, " ");
      if (/FROM "order"/.test(s)) return rows.orders ?? [];
      if (/return_requests/.test(s)) return rows.returns ?? [];
      if (/order_refunds/.test(s)) return rows.refunds ?? [];
      if (/order_shipments/.test(s)) return rows.shipments ?? [];
      return [];
    };
  }

  it("resolves facts from order/shipment/return/refund rows (no invented values)", async () => {
    const resolver = await buildPayabilityResolver([entry], [policy()], {
      query: fakeQuery({
        orders: [{ id: "ord-qa-1", status: "completed", payment_status: "captured", fulfillment_status: "delivered" }],
        shipments: [{ order_id: "ord-qa-1", status: "delivered", updated_at: "2026-11-01T00:00:00.000Z" }],
      }),
      returnWindowDays: 7,
    });
    const resolved = typeof resolver === "function" ? resolver(entry) : resolver;
    expect(resolved.orderPaid).toBe(true);
    expect(resolved.orderDelivered).toBe(true);
    expect(resolved.refundIssued).toBe(false);
    expect(explainPayability(resolved).payable).toBe(true);
  });

  it("a refund/return/pending hold from real state blocks payability", async () => {
    const resolver = await buildPayabilityResolver([entry], [policy()], {
      query: fakeQuery({
        orders: [{ id: "ord-qa-1", status: "completed", payment_status: "captured", fulfillment_status: "delivered" }],
        refunds: [{ order_id: "ord-qa-1", status: "completed" }],
        returns: [{ order_id: "ord-qa-1", status: "pending" }],
      }),
    });
    const resolved = typeof resolver === "function" ? resolver(entry) : resolver;
    expect(resolved.refundIssued).toBe(true);
    expect(resolved.pendingReturn).toBe(true);
    expect(explainPayability(resolved).payable).toBe(false);
  });

  it("unknown policy or missing order fails closed", async () => {
    const noPolicy = await buildPayabilityResolver([entry], [], { query: fakeQuery({}) });
    const a = typeof noPolicy === "function" ? noPolicy(entry) : noPolicy;
    expect(a.payable_when).toBe("UNKNOWN");
    expect(explainPayability(a).payable).toBe(false);

    const noOrder = await buildPayabilityResolver([entry], [policy()], { query: fakeQuery({}) });
    const b = typeof noOrder === "function" ? noOrder(entry) : noOrder;
    expect(b.orderPaid).toBe(false);
    expect(explainPayability(b).payable).toBe(false);
  });

  it("resolver reads real tables and uses the configured return window", () => {
    const src = read("lib/finance/payability-resolver.ts");
    for (const table of ['FROM "order"', "return_requests", "order_refunds", "order_shipments"]) {
      expect(src, `resolver must read ${table}`).toContain(table);
    }
    expect(src).toMatch(/configuredReturnWindowDays\(\)/);
    expect(src).not.toMatch(/returnWindowDays:\s*\d+/); // no invented window literal
  });
});

describe("A05 — settlements route passes the resolver to list and batch", () => {
  it("builds once from candidates+policies, then feeds both selection paths", () => {
    const src = read("app/api/admin/settlements/route.ts");
    expect(src).toMatch(/import\s*\{[^}]*buildPayabilityResolver/);
    expect(src).toMatch(/buildPayabilityResolver\(candidates,\s*policies\)/);
    expect(src).toMatch(/listEligibleLedgerEntries\(undefined,\s*payability\)/);
    expect(src).toMatch(/createBatch\(entries,[^)]*policies,\s*payability\)/);
  });
});

describe("A05 — DB constraints in migration 008", () => {
  it("adds named dual-control + rule-vocabulary CHECKs with a historical guard", () => {
    const m = read("db/migrations/008_finance_constraints.sql");
    for (const name of [
      "settlement_batch_approver_ne_initiator",
      "order_refunds_approver_ne_initiator",
      "commission_policy_refund_effect_supported",
      "commission_policy_payable_when_supported",
    ]) {
      expect(m, `008 missing ${name}`).toContain(name);
    }
    expect(m).toMatch(/RAISE EXCEPTION/);
    expect(m).toMatch(/refund_effect IN \('reverse_earnings','no_reversal'\)/);
    expect(m).toMatch(/payable_when IN \('order_paid','order_delivered','return_window_elapsed'\)/);
    expect(m).toMatch(/COMMENT ON COLUMN commission_policy\.refund_effect/);
  });

  it("008 never rewrites financial history and is idempotent", () => {
    const m = read("db/migrations/008_finance_constraints.sql");
    const stripped = m.replace(/--[^\n]*/g, "");
    expect(stripped).not.toMatch(/\bUPDATE\b|\bDELETE\s+FROM\b|\bINSERT\s+INTO\b|\bTRUNCATE\b/i);
    expect(m).toMatch(/IF NOT EXISTS/i);
    expect(m).toMatch(/FORWARD RECOVERY/i);
  });
});
