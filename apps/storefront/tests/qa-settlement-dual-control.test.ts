/**
 * AGENT A104 (QA) — Scenario F settlement-integrity verification.
 *
 * These are deterministic, adapter-free integrity tests. All money movement is
 * simulated with in-memory fixtures; NO live charge, refund or payout is made.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * LIVE PROOF (what still needs owner-supplied sandbox credentials / stack):
 * A true end-to-end Scenario F ("approved commission policy -> earnings ledger
 * -> settlement batch -> provider-confirmed payout") cannot be proven here.
 * It requires a running stack (Next + Medusa + Postgres + sandbox payment &
 * fixture adapters) plus these OWNER-SUPPLIED env vars (names only, no values):
 *   - E2E_SANDBOX=1                     (master gate; refuse to run otherwise)
 *   - E2E_FIXTURES_URL, E2E_FIXTURES_TOKEN   (sandbox fixture/seeding service)
 *   - E2E_PARTNER_FINANCE_{EMAIL,PASSWORD}   (a real partner finance identity)
 *   - an owner-APPROVED commission/payout policy (never an invented rate) and
 *     real sandbox provider-confirmation events for a completed payout.
 * The Playwright spec `e2e/payment-sandbox.spec.ts --grep "Scenario F"` covers
 * that path but is AUTHORED — NOT RUN (skipped) and BLOCKED BY OWNER INPUT.
 * Absent the above, these unit tests are evidence of code-level integrity only;
 * only AGENT 00 may mark the Settlements/Finance gates PASS after re-running
 * the live spec and recording evidence in FINAL_GO_TEST_EVIDENCE.md.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { describe, it, expect } from "vitest";
import {
  selectPayableEntries,
  createBatch,
  approveBatch,
  markPaymentInitiated,
  confirmPayment,
} from "@/lib/finance/settlement";
import { buildEarningEntry, buildRefundReversal, postEntries, statementForPartner } from "@/lib/finance/ledger";
import { buildScopedStatement } from "@/lib/partner/repository";
import type {
  CommissionPolicy,
  EarningsEntry,
  PaymentConfirmation,
  QueryExecutor,
  SettlementPeriod,
  SettlementStatus,
} from "@/lib/finance/types";
import type { PartnerContext } from "@/lib/partner/types";

/* ── fixtures (rates/identities are test-only, never business facts) ─────── */

const policy: CommissionPolicy = {
  id: "qa-policy-1",
  name: "QA test policy",
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
  approved_by: "qa-finance-approver@test",
};

const draftPolicy: CommissionPolicy = { ...policy, status: "draft" };

const period: SettlementPeriod = {
  start: "2026-01-01T00:00:00Z",
  end: "2026-02-01T00:00:00Z",
};

function payableEntry(overrides: Partial<EarningsEntry> = {}): EarningsEntry {
  return {
    id: "qa-e-1",
    partner_id: "partner-A",
    order_id: "qa-order-1",
    item_id: "qa-item-1",
    entry_type: "earning",
    gross_basis: 1000,
    discount: 0,
    tax_amount: 0,
    shipping_amount: 0,
    commission_amount: 100,
    payable_amount: 900,
    currency: "INR",
    commission_policy_id: "qa-policy-1",
    reverses_entry_id: null,
    settlement_batch_id: null,
    idempotency_key: "qa-idem-1",
    ...overrides,
  };
}

const payableEntries: EarningsEntry[] = [payableEntry()];

/**
 * In-memory settlement_batch with a faithful WHERE-status guard, so illegal
 * state transitions return zero rows exactly as the real UPDATE ... RETURNING
 * does (and requireRow then throws "wrong state").
 */
function batchStore(initialStatus: SettlementStatus | string) {
  const batch: any = {
    id: "qa-batch-1",
    status: initialStatus,
    period_start: period.start,
    period_end: period.end,
    currency: "INR",
    total_amount: 900,
    line_count: 1,
  };
  const calls: Array<{ sql: string; params: any[] }> = [];
  const executor: QueryExecutor = async (sql, params = []) => {
    calls.push({ sql, params });
    if (!/^\s*UPDATE settlement_batch\b/i.test(sql)) return [];

    const nextMatch = sql.match(/status\s*=\s*'([a-z_]+)'/);
    const next = nextMatch?.[1];
    const where = sql.match(/WHERE[\s\S]*$/i)?.[0] ?? "";
    let allowed: string[] = [];
    const inList = where.match(/status\s+IN\s*\(([^)]+)\)/i);
    const eq = where.match(/status\s*=\s*'([a-z_]+)'/);
    if (inList) allowed = [...inList[1].matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
    else if (eq) allowed = [eq[1]];

    if (next && allowed.includes(String(batch.status))) {
      batch.status = next;
      // Mirror the extra SET assignments the real UPDATE ... RETURNING applies.
      if (/payout_reference=\$/.test(sql)) batch.payout_reference = params[1];
      if (/provider_confirmation=\$/.test(sql)) {
        try {
          batch.provider_confirmation = JSON.parse(params[2]);
        } catch {
          /* non-JSON payload: leave as-is */
        }
      }
      if (/approved_by=\$/.test(sql)) batch.approved_by = params[1];
      return [{ ...batch }];
    }
    return [];
  };
  return { batch, calls, executor };
}

const validConfirmation: PaymentConfirmation = {
  confirmed: true,
  status: "captured",
  provider_event_id: "qa_pay_event_1",
};

/* ── 1. payment_completed requires a real provider confirmation object ───── */

describe("Scenario F — no payment_completed without provider confirmation", () => {
  it("rejects a missing (null/undefined) confirmation object", async () => {
    for (const bad of [null, undefined]) {
      const store = batchStore("payment_initiated");
      await expect(
        confirmPayment("qa-batch-1", "qa_pay_ref_1", bad, store.executor)
      ).rejects.toThrow(/Provider confirmation/);
      // Guard runs before any UPDATE, so no state change is attempted.
      expect(store.calls).toHaveLength(0);
      expect(store.batch.status).toBe("payment_initiated");
    }
  });

  it("rejects truthy-but-incomplete confirmation objects (creation-only / unconfirmed)", async () => {
    const incomplete: PaymentConfirmation[] = [
      { confirmed: true }, // a bare "we created a payout record" is not confirmation
      { confirmed: false, status: "captured", provider_event_id: "qa_ev" },
      { confirmed: true, status: "authorized" }, // not a success status, no event id
    ];
    for (const bad of incomplete) {
      const store = batchStore("payment_initiated");
      await expect(
        confirmPayment("qa-batch-1", "qa_pay_ref_1", bad, store.executor)
      ).rejects.toThrow(/Provider confirmation/);
      expect(store.calls).toHaveLength(0);
      expect(store.batch.status).toBe("payment_initiated");
    }
  });

  it("accepts only a confirmed object with a success status or provider event id", async () => {
    const store = batchStore("payment_initiated");
    const paid = await confirmPayment(
      "qa-batch-1",
      "qa_pay_ref_1",
      validConfirmation,
      store.executor
    );
    expect(paid.status).toBe("payment_completed");
    expect(paid.payout_reference).toBe("qa_pay_ref_1");
    expect(store.batch.status).toBe("payment_completed");
  });
});

/* ── 2. approval requires an approver identity ───────────────────────────── */

describe("Scenario F — approval requires an authorized approver identity", () => {
  // Note: this module gate proves an approver IDENTITY is present. The caller
  // must still enforce that the identity holds finance permission at the API
  // boundary (admin route: requirePermission("settlements:write")); a bare
  // identity alone is never dual-control proof.
  it("fails for undefined, null and blank approvers", async () => {
    for (const bad of [undefined, null, "", "   "]) {
      const store = batchStore("calculated");
      await expect(
        approveBatch("qa-batch-1", bad as unknown as string, store.executor)
      ).rejects.toThrow(/approver identity/);
      expect(store.calls).toHaveLength(0);
      expect(store.batch.status).toBe("calculated");
    }
  });

  it("records the named approver on a valid approval", async () => {
    const store = batchStore("calculated");
    const approved = await approveBatch(
      "qa-batch-1",
      "qa-finance-approver@test",
      store.executor
    );
    expect(approved.status).toBe("approved");
    expect(store.calls[0].params).toEqual([
      "qa-batch-1",
      "qa-finance-approver@test",
    ]);
  });
});

/* ── 3. state machine cannot skip calculate -> approve -> initiate -> complete ── */

describe("Scenario F — settlement state machine cannot skip a step", () => {
  it("cannot initiate payment from 'calculated' (approval is mandatory)", async () => {
    const store = batchStore("calculated");
    await expect(
      markPaymentInitiated("qa-batch-1", "qa-actor@test", "razorpay", store.executor)
    ).rejects.toThrow(/wrong state/);
    expect(store.batch.status).toBe("calculated");
  });

  it("cannot confirm payment from 'calculated' or 'approved' (initiation is mandatory)", async () => {
    for (const state of ["calculated", "approved"]) {
      const store = batchStore(state);
      await expect(
        confirmPayment("qa-batch-1", "qa_pay_ref_1", validConfirmation, store.executor)
      ).rejects.toThrow(/wrong state/);
      expect(store.batch.status).toBe(state);
    }
  });

  it("walks the full legal path and completes only at the end", async () => {
    const store = batchStore("calculated");

    const approved = await approveBatch("qa-batch-1", "qa-finance-approver@test", store.executor);
    expect(approved.status).toBe("approved");

    const initiated = await markPaymentInitiated(
      "qa-batch-1",
      "qa-actor@test",
      "razorpay",
      store.executor
    );
    expect(initiated.status).toBe("payment_initiated");

    const paid = await confirmPayment(
      "qa-batch-1",
      "qa_pay_ref_1",
      validConfirmation,
      store.executor
    );
    expect(paid.status).toBe("payment_completed");

    // The four states were visited in strict order, never skipped.
    expect(store.calls.map((c) => c.sql.match(/status='([a-z_]+)'/)?.[1])).toEqual([
      "approved",
      "payment_initiated",
      "payment_completed",
    ]);
  });
});

/* ── 4. no settlement when there is no active commission policy ──────────── */

describe("Scenario F — no settlement without an active configured policy", () => {
  it("refuses to create a batch with no policy or only a draft policy", () => {
    expect(() => createBatch(payableEntries, period, [])).toThrow(
      /No active configured commission policy/
    );
    expect(() => createBatch(payableEntries, period, [draftPolicy])).toThrow(
      /No active configured commission policy/
    );
    expect(() => selectPayableEntries(payableEntries, [])).toThrow(
      /No active configured commission policy/
    );
  });

  it("only produces a batch when an active, approved policy is supplied", () => {
    expect(() => createBatch(payableEntries, period, [policy])).not.toThrow();
    const batch = createBatch(payableEntries, period, [policy]);
    expect(batch.status).toBe("calculated");
    expect(batch.total_amount).toBe(900);
    expect(batch.line_count).toBe(1);
  });
});

/* ── 5. ledger reversal on refund nets earnings ──────────────────────────── */

describe("Scenario F — refund reversal nets the original earning", () => {
  it("posts a negative-money reversal that zeroes the payable and commission", async () => {
    const earning = buildEarningEntry({
      partnerId: "partner-A",
      orderId: "qa-order-1",
      itemId: "qa-item-1",
      policy,
      amounts: { gross: 1000, discount: 0, tax: 0, shipping: 0 },
      idempotencyKey: "qa-order-1:qa-item-1:earning",
    });
    expect(earning.payable_amount).toBe(900);
    expect(earning.commission_amount).toBe(100);

    const reversal = buildRefundReversal(earning, "qa-refund-1:qa-item-1:reversal");
    expect(reversal.entry_type).toBe("refund_reversal");
    expect(reversal.reverses_entry_id).toBe(earning.id);
    expect(reversal.payable_amount).toBe(-900);
    expect(reversal.commission_amount).toBe(-100);
    expect(earning.payable_amount).toBe(900); // original is immutable

    // Post both to an in-memory ledger and prove the net for this order is zero.
    const inserted: EarningsEntry[] = [];
    const ledgerExecutor: QueryExecutor = async (_sql, params = []) => {
      const row: EarningsEntry = {
        ...payableEntry(),
        id: String(params[0]),
        payable_amount: Number(params[10]), // LEDGER_COLUMNS index 10
        commission_amount: Number(params[9]), // LEDGER_COLUMNS index 9
      };
      inserted.push(row);
      return [row];
    };
    const posted = await postEntries([earning, reversal], ledgerExecutor);
    expect(posted).toHaveLength(2);
    const netPayable = inserted.reduce((sum, r) => sum + Number(r.payable_amount), 0);
    const netCommission = inserted.reduce((sum, r) => sum + Number(r.commission_amount), 0);
    expect(netPayable).toBe(0);
    expect(netCommission).toBe(0);
  });
});

/* ── 6. partner A statement cannot include partner B entries (scoped) ────── */

describe("Scenario F — statements are strictly tenant scoped", () => {
  const ctxA: PartnerContext = {
    partnerId: "partner-A",
    membershipId: "qa-member-A",
    email: "qa-a@partner.test",
    role: "finance",
    tokenVersion: 1,
  };
  const allRows = [
    payableEntry({ id: "a1", partner_id: "partner-A" }),
    payableEntry({ id: "b1", partner_id: "partner-B" }),
    payableEntry({ id: "a2", partner_id: "partner-A" }),
  ];

  it("returns only the authenticated partner's earnings, bound from server context", async () => {
    const calls: Array<{ sql: string; params: any[] }> = [];
    const executor: QueryExecutor = async (sql, params = []) => {
      calls.push({ sql, params });
      const pid = params[params.length - 1];
      return allRows.filter((r) => r.partner_id === pid);
    };
    const rows = await statementForPartner(ctxA, executor);
    expect(rows.map((r) => r.id)).toEqual(["a1", "a2"]);
    expect(rows.every((r) => r.partner_id === "partner-A")).toBe(true);
    expect(rows.some((r) => r.partner_id === "partner-B")).toBe(false);
    expect(calls[0].sql).toContain("partner_id = $1");
    expect(calls[0].params).toEqual(["partner-A"]);
  });

  it("cannot be tricked into reading partner B's rows", async () => {
    const ctxB: PartnerContext = { ...ctxA, partnerId: "partner-B" };
    const executor: QueryExecutor = async (_sql, params = []) =>
      allRows.filter((r) => r.partner_id === params[params.length - 1]);
    const rowsA = await statementForPartner(ctxA, executor);
    const rowsB = await statementForPartner(ctxB, executor);
    expect(rowsA.every((r) => r.partner_id === "partner-A")).toBe(true);
    expect(rowsB.every((r) => r.partner_id === "partner-B")).toBe(true);
    expect(rowsA.some((r) => (rowsB as EarningsEntry[]).includes(r))).toBe(false);
  });

  it("refuses to build a scoped query lacking the {partner} predicate", () => {
    expect(() =>
      buildScopedStatement(ctxA, "SELECT * FROM partner_earnings_ledger")
    ).toThrow(/\{partner\} predicate/);
  });
});
