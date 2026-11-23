import { describe, it, expect } from "vitest";
import {
  buildEarningEntry,
  buildRefundReversal,
  postEntries,
  statementForPartner,
} from "@/lib/finance/ledger";
import type { CommissionPolicy, EarningsEntry } from "@/lib/finance/types";
import type { PartnerContext } from "@/lib/partner/types";

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

/** Fake ledger DB that enforces the unique idempotency_key constraint. */
function fakeLedgerDb() {
  const keys = new Set<string>();
  const calls: Array<{ sql: string; params: any[] }> = [];
  const executor = async (sql: string, params: any[] = []) => {
    calls.push({ sql, params });
    if (/^\s*INSERT INTO partner_earnings_ledger/i.test(sql)) {
      expect(sql).toMatch(/ON CONFLICT \(idempotency_key\) DO NOTHING/);
      const key = String(params[15]); // idempotency_key position
      if (keys.has(key)) return [];
      keys.add(key);
      return [{ id: params[0], idempotency_key: key }];
    }
    return [];
  };
  return { executor, calls, keys };
}

describe("buildEarningEntry", () => {
  it("computes commission and produces a complete ledger row", () => {
    const row = buildEarningEntry({
      partnerId: "partner-A",
      orderId: "order-1",
      itemId: "item-1",
      policy,
      amounts: { gross: 1000, discount: 0, tax: 0, shipping: 0 },
      idempotencyKey: "event-1:item-1",
    });
    expect(row.entry_type).toBe("earning");
    expect(row.partner_id).toBe("partner-A");
    expect(row.gross_basis).toBe(1000);
    expect(row.commission_amount).toBe(100);
    expect(row.payable_amount).toBe(900);
    expect(row.commission_policy_id).toBe("policy-1");
    expect(row.settlement_batch_id).toBeNull();
    expect(row.reverses_entry_id).toBeNull();
    expect(row.idempotency_key).toBe("event-1:item-1");
    expect(row.id).toBeTruthy();
  });
});

describe("buildRefundReversal", () => {
  it("negates amounts and links the new row via reverses_entry_id", () => {
    const original = earning();
    const reversal = buildRefundReversal(original, "refund-1:item-1");
    expect(reversal.entry_type).toBe("refund_reversal");
    expect(reversal.reverses_entry_id).toBe("entry-1");
    expect(reversal.commission_amount).toBe(-100);
    expect(reversal.payable_amount).toBe(-900);
    expect(reversal.gross_basis).toBe(-1000);
    expect(reversal.partner_id).toBe("partner-A");
    expect(reversal.id).not.toBe(original.id);
    expect(reversal.idempotency_key).toBe("refund-1:item-1");
    // The original row is left untouched.
    expect(original.commission_amount).toBe(100);
  });
});

describe("postEntries — idempotent, append-only", () => {
  it("inserts new keys once and silently drops duplicate keys", async () => {
    const db = fakeLedgerDb();
    const a = earning({ id: "e-1", idempotency_key: "idem-A" });
    const b = earning({ id: "e-2", idempotency_key: "idem-B" });

    const first = await postEntries([a, b], db.executor);
    expect(first).toHaveLength(2);
    expect(db.keys.size).toBe(2);

    // Same events redelivered — no duplicate rows are created.
    const second = await postEntries([a, b], db.executor);
    expect(second).toHaveLength(0);
    expect(db.keys.size).toBe(2);

    // A different payload under an already-used key is also a no-op.
    const changed = earning({
      id: "e-x",
      idempotency_key: "idem-A",
      payable_amount: 999999,
    });
    expect(await postEntries([changed], db.executor)).toHaveLength(0);
    expect(db.keys.size).toBe(2);
  });
});

const ctxA: PartnerContext = {
  partnerId: "partner-A",
  membershipId: "member-A",
  email: "a@partner.test",
  role: "owner",
  tokenVersion: 1,
};

describe("statementForPartner — strict tenant scoping", () => {
  const allRows = [
    earning({ id: "a1", partner_id: "partner-A" }),
    earning({ id: "b1", partner_id: "partner-B" }),
    earning({ id: "a2", partner_id: "partner-A" }),
  ];

  it("returns only the authenticated partner's earnings", async () => {
    const calls: Array<{ sql: string; params: any[] }> = [];
    const executor = async (sql: string, params: any[] = []) => {
      calls.push({ sql, params });
      const pid = params[params.length - 1];
      return allRows.filter((row) => row.partner_id === pid);
    };
    const rows = await statementForPartner(ctxA, executor);
    expect(rows.map((r) => r.id)).toEqual(["a1", "a2"]);
    expect(calls[0].sql).toContain("partner_id = $1");
    expect(calls[0].params).toEqual(["partner-A"]);
  });

  it("cannot be tricked into reading partner B's rows", async () => {
    const ctxB: PartnerContext = { ...ctxA, partnerId: "partner-B" };
    const executor = async (_sql: string, params: any[] = []) =>
      allRows.filter((row) => row.partner_id === params[params.length - 1]);
    const rowsA = await statementForPartner(ctxA, executor);
    const rowsB = await statementForPartner(ctxB, executor);
    expect(rowsA.every((r) => r.partner_id === "partner-A")).toBe(true);
    expect(rowsB.every((r) => r.partner_id === "partner-B")).toBe(true);
  });
});
