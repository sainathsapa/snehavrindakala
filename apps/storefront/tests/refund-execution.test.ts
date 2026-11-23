import { describe, expect, it, vi } from "vitest";

/**
 * Refund execution is where money would actually move. These tests use only a
 * fake provider and a fake executor: no live credentials, no live money. They
 * pin dual control, idempotency (no second provider call), and the rule that
 * `provider_confirmed` is set only on a real provider confirmation.
 */

vi.mock("@/lib/db", () => ({
  query: vi.fn(async () => []),
}));

import {
  executeRefund,
  syncRefundStatus,
  assertDualControl,
  buildLedgerReversalKey,
  DualControlError,
  RefundApprovalError,
  type DbExecutor,
  type RefundExecutionRow,
} from "../lib/payments/refund-execution";
import {
  getRefundProvider,
  RazorpayRefundProvider,
  RefundProviderNotConfiguredError,
  TestRefundProvider,
  isProviderRefundConfirmed,
  type ProviderRefund,
  type RefundParams,
  type RefundProvider,
} from "../lib/payments/refund-provider";

class FakeProvider implements RefundProvider {
  readonly name = "fake";
  readonly calls: RefundParams[] = [];
  constructor(
    private readonly status = "processed",
    private readonly refId = "rf_provider_1"
  ) {}
  async refund(params: RefundParams): Promise<ProviderRefund> {
    this.calls.push({ ...params });
    return {
      providerRefundId: this.refId,
      status: this.status,
      raw: { id: this.refId, status: this.status },
    };
  }
  async getRefund(providerRefundId: string): Promise<ProviderRefund> {
    return {
      providerRefundId,
      status: this.status,
      raw: { id: providerRefundId, status: this.status },
    };
  }
}

interface FakeDb {
  executor: DbExecutor;
  rows: Map<string, RefundExecutionRow>;
  queries: string[];
}

function makeFakeDb(
  approval: Record<string, any> | null = {
    id: "apr_1",
    order_id: "ord_1",
    amount: 1000,
    status: "approved",
    requested_by: "requester@shop.test",
    approved_by: "approver@shop.test",
  }
): FakeDb {
  const rows = new Map<string, RefundExecutionRow>();
  const queries: string[] = [];
  const executor: DbExecutor = async (sql, params = []) => {
    queries.push(sql);

    if (sql.includes("FROM order_refunds")) {
      return approval ? [approval] : [];
    }

    if (sql.startsWith("INSERT INTO refund_execution")) {
      const key = params[8] as string; // idempotency_key
      if (rows.has(key)) return []; // ON CONFLICT DO NOTHING
      const row: RefundExecutionRow = {
        id: params[0],
        refund_request_id: params[1],
        order_id: params[2],
        partner_id: params[3],
        amount: params[4],
        currency: params[5],
        status: "initiated",
        requested_by: params[6],
        approved_by: params[7],
        idempotency_key: key,
        provider: params[9],
        ledger_reversal_key: params[10],
        provider_refund_id: null,
        provider_response: null,
        inventory_restored: false,
        failure_reason: null,
      };
      rows.set(key, row);
      return [{ ...row }];
    }

    if (
      sql.startsWith("SELECT * FROM refund_execution WHERE idempotency_key")
    ) {
      const row = rows.get(params[0] as string);
      return row ? [{ ...row }] : [];
    }

    if (sql.startsWith("SELECT * FROM refund_execution WHERE id =")) {
      const row = [...rows.values()].find((r) => r.id === params[0]);
      return row ? [{ ...row }] : [];
    }

    if (sql.startsWith("UPDATE refund_execution")) {
      const id = params[0] as string;
      const row = [...rows.values()].find((r) => r.id === id);
      if (!row) return [];
      if (sql.includes("provider_refund_id = $3")) {
        row.status = params[1];
        row.provider_refund_id = params[2];
        row.provider_response = JSON.parse(params[3]);
        row.failure_reason = params[4];
      } else if (sql.includes("failure_reason = $2")) {
        row.status = "failed";
        row.failure_reason = params[1];
      } else {
        row.status = params[1];
        row.provider_response = JSON.parse(params[2]);
      }
      return [{ ...row }];
    }

    return [];
  };
  return { executor, rows, queries };
}

const baseInput = {
  refundRequestId: "apr_1",
  orderId: "ord_1",
  amount: 1000,
  requester: "requester@shop.test",
  approver: "approver@shop.test",
  idempotencyKey: "idem-base",
};

describe("dual control", () => {
  it("rejects when requester and approver are the same person", async () => {
    expect(() =>
      assertDualControl("same@shop.test", "same@shop.test")
    ).toThrow(DualControlError);
    expect(() => assertDualControl("a@shop.test", "A@SHOP.TEST")).toThrow(
      DualControlError
    );
  });

  it("never calls the provider when dual control fails", async () => {
    const db = makeFakeDb();
    const provider = new FakeProvider();
    await expect(
      executeRefund(
        { ...baseInput, approver: "requester@shop.test" },
        provider,
        db.executor
      )
    ).rejects.toBeInstanceOf(DualControlError);
    expect(provider.calls).toHaveLength(0);
  });

  it("requires an existing, approved order_refunds approval", async () => {
    const missing = makeFakeDb(null);
    const provider = new FakeProvider();
    await expect(
      executeRefund(baseInput, provider, missing.executor)
    ).rejects.toBeInstanceOf(RefundApprovalError);

    const pending = makeFakeDb({ ...baseInput, id: "apr_1", status: "pending" });
    await expect(
      executeRefund(baseInput, new FakeProvider(), pending.executor)
    ).rejects.toBeInstanceOf(RefundApprovalError);
  });
});

describe("idempotent refund execution", () => {
  it("does not make a second provider call for a replayed idempotency key", async () => {
    const db = makeFakeDb();
    const provider = new FakeProvider();
    const input = { ...baseInput, idempotencyKey: "idem-key-1" };

    const first = await executeRefund(input, provider, db.executor);
    const second = await executeRefund(input, provider, db.executor);

    expect(first.reused).toBe(false);
    expect(second.reused).toBe(true);
    expect(provider.calls).toHaveLength(1);
    expect(second.execution.id).toBe(first.execution.id);
  });

  it("stores a deterministic ledger reversal key for the finance link", async () => {
    const db = makeFakeDb();
    const result = await executeRefund(
      { ...baseInput, idempotencyKey: "idem-key-2" },
      new FakeProvider(),
      db.executor
    );
    expect(result.execution.ledger_reversal_key).toBe(
      buildLedgerReversalKey(result.execution.id)
    );
    expect(buildLedgerReversalKey("exec_9")).toBe(
      "refund-ledger-reversal:exec_9"
    );
  });
});

describe("provider confirmation governs status", () => {
  it("sets provider_confirmed only when the provider confirms", async () => {
    const db = makeFakeDb();
    const confirmed = await executeRefund(
      { ...baseInput, idempotencyKey: "idem-confirmed" },
      new FakeProvider("processed", "rf_done"),
      db.executor
    );
    expect(confirmed.execution.status).toBe("provider_confirmed");
    expect(confirmed.execution.provider_refund_id).toBe("rf_done");
  });

  it("leaves status unconfirmed when the provider is still pending", async () => {
    const db = makeFakeDb();
    const pending = await executeRefund(
      { ...baseInput, idempotencyKey: "idem-pending" },
      new FakeProvider("pending", "rf_pending"),
      db.executor
    );
    expect(pending.execution.status).toBe("initiated");
    expect(pending.execution.status).not.toBe("provider_confirmed");
    expect(isProviderRefundConfirmed("pending")).toBe(false);
    // Internal approval never marked any order paid.
    expect(db.queries.some((q) => /UPDATE\s+orders|SET status = .paid/i.test(q))).toBe(
      false
    );
  });

  it("syncRefundStatus promotes to provider_confirmed only after the provider says so", async () => {
    const db = makeFakeDb();
    const started = await executeRefund(
      { ...baseInput, idempotencyKey: "idem-sync" },
      new FakeProvider("pending", "rf_sync"),
      db.executor
    );
    expect(started.execution.status).toBe("initiated");

    const synced = await syncRefundStatus(
      started.execution.id,
      new FakeProvider("processed", "rf_sync"),
      db.executor
    );
    expect(synced.status).toBe("provider_confirmed");
  });
});

describe("refund provider adapter selection", () => {
  it("defaults to the deterministic test adapter outside production", () => {
    const provider = getRefundProvider({ NODE_ENV: "test" });
    expect(provider).toBeInstanceOf(TestRefundProvider);
  });

  it("test adapter returns deterministic refs and a retrievable refund", async () => {
    const provider = new TestRefundProvider();
    const a = await provider.refund({
      amount: 1000,
      currency: "INR",
      orderId: "ord_1",
      idempotencyKey: "same-key",
    });
    const b = await provider.refund({
      amount: 1000,
      currency: "INR",
      orderId: "ord_1",
      idempotencyKey: "same-key",
    });
    expect(b.providerRefundId).toBe(a.providerRefundId);
    expect(a.providerRefundId).toMatch(/^test_refund_/);
    expect((await provider.getRefund(a.providerRefundId)).providerRefundId).toBe(
      a.providerRefundId
    );
  });

  it("refuses to fabricate Razorpay credentials", () => {
    expect(() => new RazorpayRefundProvider({ keyId: "", secret: "" })).toThrow(
      RefundProviderNotConfiguredError
    );
    const production = getRefundProvider({ NODE_ENV: "production" });
    return expect(production.refund({
      amount: 1,
      orderId: "o",
      idempotencyKey: "k",
    })).rejects.toBeInstanceOf(RefundProviderNotConfiguredError);
  });
});
