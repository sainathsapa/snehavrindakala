import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import {
  PAYABLE_WHENS,
  REFUND_EFFECTS,
  activatePolicy,
  assertKnownPayableWhen,
  assertKnownRefundEffect,
  isKnownPayableWhen,
  isKnownRefundEffect,
  validatePolicy,
} from "@/lib/finance/commission-policy";
import {
  reversalEntriesForRefund,
  shouldReverseEarnings,
} from "@/lib/finance/ledger";
import {
  explainPayability,
  isPayable,
  payabilityContextForEntry,
  selectPayableEntries,
} from "@/lib/finance/settlement";
import type {
  CommissionPolicy,
  EarningsEntry,
  PayabilityContext,
} from "@/lib/finance/types";
import {
  assertDualControl,
  DualControlError,
} from "@/lib/payments/refund-execution";

/**
 * GAP-12 — finance policy actually controls behaviour.
 *
 * PURE + STATIC ONLY. No live DB, no payments, no payouts. The dual-control
 * app-level check is imported from the refund execution module (A04, read-only)
 * and exercised as a pure function. Migration assertions read the SQL source.
 */

const repo = join(__dirname, "..", "..", "..");
const migrationPath = join(
  repo,
  "apps",
  "storefront",
  "db",
  "migrations",
  "008_finance_constraints.sql"
);
const migrationSql = () => readFileSync(migrationPath, "utf8");
const stripComments = (sql: string) =>
  sql.replace(/\/\*[\s\S]*?\*\//g, "").replace(/--[^\n]*/g, "");

function policy(overrides: Partial<CommissionPolicy> = {}): CommissionPolicy {
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
    payable_when: "order_delivered",
    status: "active",
    version: 1,
    effective_from: "2020-01-01T00:00:00Z",
    effective_to: null,
    approved_by: "finance@test",
    ...overrides,
  };
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
  };
}

/** A context where every documented prerequisite is satisfied for a rule. */
function contextFor(
  rule: PayabilityContext["payable_when"],
  overrides: Partial<PayabilityContext> = {}
): PayabilityContext {
  return {
    payable_when: rule,
    orderPaid: true,
    orderDelivered: true,
    orderCancelled: false,
    refundIssued: false,
    pendingReturn: false,
    settlementHeld: false,
    daysSinceDelivery: 45,
    returnWindowDays: 14,
    ...overrides,
  };
}

/* ── A. refund_effect ─────────────────────────────────────────────────────── */

describe("refund_effect vocabulary", () => {
  it("exposes exactly the two documented values", () => {
    expect([...REFUND_EFFECTS]).toEqual(["reverse_earnings", "no_reversal"]);
    expect(isKnownRefundEffect("reverse_earnings")).toBe(true);
    expect(isKnownRefundEffect("no_reversal")).toBe(true);
    expect(isKnownRefundEffect("something_else")).toBe(false);
  });
});

describe("refund_effect controls ledger treatment", () => {
  it("reverse_earnings posts one negative refund_reversal row", () => {
    const p = policy({ refund_effect: "reverse_earnings" });
    expect(shouldReverseEarnings(p.refund_effect)).toBe(true);
    const rows = reversalEntriesForRefund(p, earning(), "refund-1:item-1");
    expect(rows).toHaveLength(1);
    expect(rows[0].entry_type).toBe("refund_reversal");
    expect(rows[0].commission_amount).toBe(-100);
    expect(rows[0].payable_amount).toBe(-900);
    expect(rows[0].reverses_entry_id).toBe("entry-1");
    expect(rows[0].idempotency_key).toBe("refund-1:item-1");
    expect((rows[0].metadata as any).refund_effect).toBe("reverse_earnings");
    // The original historical row is untouched.
    expect(earning().commission_amount).toBe(100);
  });

  it("no_reversal posts nothing and leaves the earning standing", () => {
    const p = policy({ refund_effect: "no_reversal" });
    expect(shouldReverseEarnings(p.refund_effect)).toBe(false);
    expect(reversalEntriesForRefund(p, earning(), "refund-2:item-1")).toEqual(
      []
    );
  });

  it("accepts a bare refund_effect value as well as a policy", () => {
    expect(reversalEntriesForRefund("reverse_earnings", earning(), "k")).toHaveLength(1);
    expect(reversalEntriesForRefund("no_reversal", earning(), "k")).toEqual([]);
  });
});

describe("refund_effect fail-safe", () => {
  it("rejects undefined or unknown values with a clear code", () => {
    expect(() => assertKnownRefundEffect(undefined)).toThrow(
      /UNCONFIGURED_REFUND_EFFECT/
    );
    expect(() => assertKnownRefundEffect("reverse_all_the_things")).toThrow(
      /UNCONFIGURED_REFUND_EFFECT/
    );
    expect(() => shouldReverseEarnings(undefined)).toThrow(
      /UNCONFIGURED_REFUND_EFFECT/
    );
    expect(() =>
      reversalEntriesForRefund(undefined, earning(), "k")
    ).toThrow(/UNCONFIGURED_REFUND_EFFECT/);
  });

  it("cannot activate a policy whose refund_effect is undefined", () => {
    const bad = policy({ refund_effect: undefined as any });
    expect(validatePolicy(bad).valid).toBe(false);
    expect(() => activatePolicy(bad)).toThrow(/UNCONFIGURED_REFUND_EFFECT/);
  });
});

/* ── B. payable_when ──────────────────────────────────────────────────────── */

describe("payable_when vocabulary", () => {
  it("exposes exactly the three documented values", () => {
    expect([...PAYABLE_WHENS]).toEqual([
      "order_paid",
      "order_delivered",
      "return_window_elapsed",
    ]);
    for (const value of PAYABLE_WHENS) {
      expect(isKnownPayableWhen(value)).toBe(true);
    }
    expect(isKnownPayableWhen("on_a_whim")).toBe(false);
  });
});

describe("payable_when controls settlement eligibility", () => {
  it("order_paid: payable on captured payment, no delivery needed", () => {
    const ctx = contextFor("order_paid", { orderDelivered: false });
    expect(explainPayability(ctx).payable).toBe(true);
    expect(isPayable(ctx)).toBe(true);
    expect(
      isPayable(contextFor("order_paid", { orderPaid: false }))
    ).toBe(false);
  });

  it("order_delivered: requires confirmed delivery in addition to payment", () => {
    expect(
      isPayable(contextFor("order_delivered", { orderDelivered: false }))
    ).toBe(false);
    expect(isPayable(contextFor("order_delivered"))).toBe(true);
    expect(
      isPayable(contextFor("order_delivered", { orderPaid: false }))
    ).toBe(false);
  });

  it("return_window_elapsed: only past the configured window", () => {
    expect(
      isPayable(contextFor("return_window_elapsed", { daysSinceDelivery: 14 }))
    ).toBe(false); // boundary day is still inside the window
    expect(
      isPayable(contextFor("return_window_elapsed", { daysSinceDelivery: 13 }))
    ).toBe(false);
    expect(
      isPayable(contextFor("return_window_elapsed", { daysSinceDelivery: 15 }))
    ).toBe(true);
    expect(
      isPayable(contextFor("return_window_elapsed", { returnWindowDays: null }))
    ).toBe(false);
    expect(
      isPayable(contextFor("return_window_elapsed", { daysSinceDelivery: null }))
    ).toBe(false);
  });

  it("universal blockers prevent premature settlement for every rule", () => {
    const blockers: Array<Partial<PayabilityContext>> = [
      { settlementHeld: true },
      { orderCancelled: true },
      { refundIssued: true },
      { pendingReturn: true },
      { orderPaid: false },
    ];
    for (const value of PAYABLE_WHENS) {
      expect(isPayable(contextFor(value))).toBe(true); // baseline is payable
      for (const blocker of blockers) {
        const decision = explainPayability(contextFor(value, blocker));
        expect(decision.payable, `${value} + ${JSON.stringify(blocker)}`).toBe(
          false
        );
        expect(decision.reason.length).toBeGreaterThan(0);
      }
    }
  });

  it("selectPayableEntries consults the resolver when supplied", () => {
    const p = policy({ payable_when: "order_delivered" });
    const entries = [earning({ id: "e-paid" }), earning({ id: "e-unpaid" })];
    const selected = selectPayableEntries(
      entries,
      [p],
      (entry) =>
        contextFor("order_delivered", {
          orderDelivered: entry.id !== "e-unpaid",
        })
    );
    expect(selected.map((e) => e.id)).toEqual(["e-paid"]);
  });

  it("payabilityContextForEntry blocks by default when facts are missing", () => {
    const ctx = payabilityContextForEntry(earning(), policy());
    expect(ctx.payable_when).toBe("order_delivered");
    expect(isPayable(ctx)).toBe(false); // orderPaid/orderDelivered default false
    const assigned = payabilityContextForEntry(
      earning({ settlement_batch_id: "batch-1" }),
      policy(),
      { orderPaid: true, orderDelivered: true }
    );
    expect(assigned.settlementHeld).toBe(true);
    expect(isPayable(assigned)).toBe(false);
  });
});

describe("payable_when fail-safe", () => {
  it("undefined or invalid rules never settle", () => {
    for (const bad of [undefined, null, "whenever", 42]) {
      const decision = explainPayability(contextFor(bad as any));
      expect(decision.payable).toBe(false);
      expect(decision.reason).toMatch(/UNCONFIGURED_PAYABLE_WHEN/);
      expect(isPayable({ ...contextFor("order_paid"), payable_when: bad as any })).toBe(false);
    }
    expect(explainPayability(null).payable).toBe(false);
    expect(() => assertKnownPayableWhen("whenever")).toThrow(
      /UNCONFIGURED_PAYABLE_WHEN/
    );
  });

  it("an invalid rule cannot activate or pass validatePolicy", () => {
    const bad = policy({ payable_when: "whenever" as any });
    expect(validatePolicy(bad).valid).toBe(false);
    expect(() => activatePolicy(bad)).toThrow(/UNCONFIGURED_PAYABLE_WHEN/);
  });

  it("an unknown rule fails closed even without a payability resolver", () => {
    const bad = policy({ payable_when: "whenever" as any });
    // policyConfigured rejects the invalid policy first; either guard must
    // refuse to settle — never silently select entries.
    expect(() =>
      selectPayableEntries([earning()], [bad])
    ).toThrow(/refusing to settle/);
  });
});

/* ── C. approver != initiator ─────────────────────────────────────────────── */

describe("app-level dual control (refund execution, A04 read-only)", () => {
  it("rejects requester == approver", () => {
    expect(() => assertDualControl("owner@example.com", "OWNER@example.com")).toThrow(
      DualControlError
    );
    try {
      assertDualControl("same@example.com", "same@example.com");
      throw new Error("expected assertDualControl to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(DualControlError);
      expect((error as DualControlError).code).toBe("DUAL_CONTROL");
    }
  });

  it("allows two distinct identities and fails closed on missing ones", () => {
    expect(() =>
      assertDualControl("requester@example.com", "approver@example.com")
    ).not.toThrow();
    expect(() => assertDualControl(undefined, "approver@example.com")).toThrow(
      DualControlError
    );
    expect(() => assertDualControl("requester@example.com", "")).toThrow(
      DualControlError
    );
  });
});

/* ── C/D. migration 008 static assertions ─────────────────────────────────── */

describe("migration 008_finance_constraints.sql (static)", () => {
  it("exists and declares itself additive with a forward-recovery note", () => {
    expect(existsSync(migrationPath)).toBe(true);
    const header = migrationSql();
    expect(header).toMatch(/additive/i);
    expect(header).toMatch(/forward recovery/i);
    expect(header).toMatch(/never[\s\S]*?deletes/i);
  });

  it("enforces approver != initiator on settlement_batch and order_refunds", () => {
    const sql = stripComments(migrationSql());
    expect(sql).toMatch(
      /conname\s*=\s*'settlement_batch_approver_ne_initiator'/
    );
    expect(sql).toMatch(
      /ADD CONSTRAINT settlement_batch_approver_ne_initiator/
    );
    expect(sql).toMatch(
      /approved_by IS NULL\s+OR payment_initiated_by IS NULL/
    );
    expect(sql).toMatch(
      /conname\s*=\s*'order_refunds_approver_ne_initiator'/
    );
    expect(sql).toMatch(
      /ADD CONSTRAINT order_refunds_approver_ne_initiator/
    );
    expect(sql).toMatch(/requested_by IS NULL\s+OR approved_by IS NULL/);
    // NULL approval fields in the pending state are legal.
    expect(sql).toMatch(/lower\(btrim\(approved_by\)\)/);
    expect(sql).toMatch(/lower\(btrim\(requested_by\)\)/);
  });

  it("reports historical invalid data and fails safely rather than rewriting it", () => {
    const sql = stripComments(migrationSql());
    expect(sql).toMatch(/SELECT count\(\*\) INTO bad_settlement/);
    expect(sql).toMatch(/SELECT count\(\*\) INTO bad_refunds/);
    expect(sql).toMatch(/RAISE EXCEPTION/);
    expect(sql).toMatch(/Financial history was NOT changed/);
    expect(sql).toMatch(/owner-approved audited correction runbook/);
    // No destructive statements anywhere in the file.
    expect(sql).not.toMatch(/\bDROP\s+TABLE\b/i);
    expect(sql).not.toMatch(/\bDELETE\s+FROM\b/i);
    expect(sql).not.toMatch(/\bTRUNCATE\b/i);
    expect(sql).not.toMatch(/\bUPDATE\b/i);
    // Additions are idempotent via pg_constraint guards.
    expect(sql.match(/IF NOT EXISTS \(/g)?.length ?? 0).toBeGreaterThanOrEqual(4);
  });

  it("pins both policy vocabularies and documents their semantics in the DB", () => {
    const sql = stripComments(migrationSql());
    expect(sql).toMatch(/commission_policy_refund_effect_supported/);
    expect(sql).toMatch(/commission_policy_payable_when_supported/);
    expect(sql).toMatch(/'reverse_earnings','no_reversal'/);
    expect(sql).toMatch(
      /'order_paid','order_delivered','return_window_elapsed'/
    );
    expect(sql).toMatch(/COMMENT ON COLUMN commission_policy\.refund_effect/);
    expect(sql).toMatch(/COMMENT ON COLUMN commission_policy\.payable_when/);
  });
});
