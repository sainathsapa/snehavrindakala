import { describe, it, expect } from "vitest";
import {
  selectPayableEntries,
  createBatch,
  persistBatch,
  approveBatch,
  markPaymentInitiated,
  confirmPayment,
  failPayment,
} from "@/lib/finance/settlement";
import type {
  CommissionPolicy,
  EarningsEntry,
  PaymentConfirmation,
  SettlementPeriod,
} from "@/lib/finance/types";

const policy: CommissionPolicy = {
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
};

const draftPolicy: CommissionPolicy = { ...policy, status: "draft" };
const period: SettlementPeriod = {
  start: "2026-01-01T00:00:00Z",
  end: "2026-02-01T00:00:00Z",
};

function payableEntry(overrides: Partial<EarningsEntry> = {}): EarningsEntry {
  return {
    id: "e-1",
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

const payableEntries = [
  payableEntry({ id: "e-1", payable_amount: 900 }),
  payableEntry({
    id: "e-2",
    partner_id: "partner-B",
    payable_amount: 450,
  }),
];

/** In-memory settlement_batch with a faithful WHERE-status guard. */
function batchStore(initialStatus: string) {
  const batch: any = {
    id: "batch-1",
    status: initialStatus,
    period_start: period.start,
    period_end: period.end,
    currency: "INR",
    total_amount: 1350,
    line_count: 2,
  };
  const calls: Array<{ sql: string; params: any[] }> = [];
  const executor = async (sql: string, params: any[] = []) => {
    calls.push({ sql, params });
    if (/^\s*UPDATE settlement_batch/i.test(sql)) {
      const assignments = [...sql.matchAll(/status\s*=\s*'([a-z_]+)'/g)].map(
        (m) => m[1]
      );
      const inMatch = sql.match(/status\s+IN\s+\(([^)]+)\)/);
      let expected: string[];
      if (inMatch) {
        expected = [...inMatch[1].matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
      } else {
        expected = [assignments[assignments.length - 1]];
      }
      const next = assignments[0];
      if (expected.includes(batch.status)) {
        batch.status = next;
        return [{ ...batch }];
      }
      return [];
    }
    return [];
  };
  return { batch, executor, calls };
}

describe("createBatch — policy gate and payable selection", () => {
  it("builds a calculated batch with correct totals", () => {
    const batch = createBatch(payableEntries, period, [policy]);
    expect(batch.status).toBe("calculated");
    expect(batch.total_amount).toBe(1350);
    expect(batch.line_count).toBe(2);
    expect(batch.currency).toBe("INR");
    expect(batch.id).toBeTruthy();
  });

  it("refuses to settle when no active configured policy exists", () => {
    expect(() => createBatch(payableEntries, period, [])).toThrow(
      /No active configured commission policy/
    );
    expect(() => createBatch(payableEntries, period, [draftPolicy])).toThrow(
      /No active configured commission policy/
    );
    expect(() => selectPayableEntries(payableEntries, [])).toThrow();
  });

  it("selects only unassigned, positive, policy-linked earnings", () => {
    const mixed = [
      ...payableEntries,
      payableEntry({ id: "old", settlement_batch_id: "batch-old", payable_amount: 10 }),
      payableEntry({ id: "zero", payable_amount: 0 }),
      payableEntry({ id: "no-policy", commission_policy_id: null }),
      payableEntry({ id: "reversal", entry_type: "refund_reversal", payable_amount: 900 }),
    ];
    const batch = createBatch(mixed, period, [policy]);
    expect(batch.line_count).toBe(2);
    expect(batch.total_amount).toBe(1350);
    expect(() =>
      createBatch([mixed[2], mixed[3]], period, [policy])
    ).toThrow(/No payable entries/);
  });
});

describe("persistBatch — inserts batch, items and assignment markers", () => {
  it("writes idempotent items and never rewrites money values", async () => {
    const calls: Array<{ sql: string; params: any[] }> = [];
    const executor = async (sql: string, params: any[] = []) => {
      calls.push({ sql, params });
      return [];
    };
    const batch = createBatch(payableEntries, period, [policy]);
    await persistBatch(batch, payableEntries, executor);

    expect(calls[0].sql).toContain("INSERT INTO settlement_batch");
    expect(calls[0].sql).toContain("ON CONFLICT (id) DO NOTHING");
    const itemInserts = calls.filter((c) =>
      c.sql.includes("INSERT INTO settlement_batch_item")
    );
    expect(itemInserts).toHaveLength(2);
    expect(itemInserts[0].sql).toContain(
      "ON CONFLICT (batch_id, ledger_entry_id) DO NOTHING"
    );
    const assignments = calls.filter((c) =>
      c.sql.includes("UPDATE partner_earnings_ledger SET settlement_batch_id")
    );
    expect(assignments).toHaveLength(2);
    expect(assignments[0].sql).toContain("settlement_batch_id IS NULL");
    expect(assignments[0].params).toEqual([batch.id, "e-1"]);
  });
});

describe("settlement state machine", () => {
  const confirmation: PaymentConfirmation = {
    confirmed: true,
    status: "captured",
    provider_event_id: "pay_event_123",
  };

  it("approves calculated->approved only", async () => {
    const store = batchStore("calculated");
    const result = await approveBatch("batch-1", "finance@test", store.executor);
    expect(result.status).toBe("approved");
    expect(store.calls[0].params).toEqual(["batch-1", "finance@test"]);

    const wrong = batchStore("approved");
    await expect(
      approveBatch("batch-1", "finance@test", wrong.executor)
    ).rejects.toThrow(/wrong state/);
    await expect(approveBatch("batch-1", "", store.executor)).rejects.toThrow(
      /approver identity/
    );
  });

  it("requires approval before initiating payment", async () => {
    const store = batchStore("approved");
    const result = await markPaymentInitiated(
      "batch-1",
      "finance@test",
      "razorpay",
      store.executor
    );
    expect(result.status).toBe("payment_initiated");

    const wrong = batchStore("calculated");
    await expect(
      markPaymentInitiated("batch-1", "finance@test", "razorpay", wrong.executor)
    ).rejects.toThrow(/wrong state/);
  });

  it("never marks a batch paid without real provider confirmation", async () => {
    const store = batchStore("payment_initiated");
    await expect(
      confirmPayment("batch-1", "pay_123", null, store.executor)
    ).rejects.toThrow(/Provider confirmation/);
    await expect(
      confirmPayment(
        "batch-1",
        "pay_123",
        { confirmed: false, status: "authorized" },
        store.executor
      )
    ).rejects.toThrow(/Provider confirmation/);
    // A bare record-creation style object is not confirmation either.
    await expect(
      confirmPayment("batch-1", "pay_123", { confirmed: true }, store.executor)
    ).rejects.toThrow(/Provider confirmation/);
    expect(store.batch.status).toBe("payment_initiated");

    const paid = await confirmPayment(
      "batch-1",
      "pay_123",
      confirmation,
      store.executor
    );
    expect(paid.status).toBe("payment_completed");
  });

  it("cannot jump straight from calculated to payment_completed", async () => {
    const store = batchStore("calculated");
    await expect(
      confirmPayment("batch-1", "pay_123", confirmation, store.executor)
    ).rejects.toThrow(/wrong state/);
  });

  it("records payment failures from initiated/approved states", async () => {
    const store = batchStore("payment_initiated");
    const failed = await failPayment("batch-1", "gateway timeout", store.executor);
    expect(failed.status).toBe("payment_failed");
    const wrong = batchStore("payment_completed");
    await expect(
      failPayment("batch-1", "too late", wrong.executor)
    ).rejects.toThrow(/wrong state/);
  });
});
