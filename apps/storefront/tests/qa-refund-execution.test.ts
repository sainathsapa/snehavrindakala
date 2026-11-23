/**
 * AGENT A110 (QA) — Scenario E refund-execution verification.
 *
 * Independent verification of A56's `lib/payments/refund-execution.ts` and
 * `lib/payments/refund-provider.ts`. All money movement is simulated with an
 * in-memory DbExecutor and the deterministic TestRefundProvider — NO live
 * Razorpay call, NO fabricated credentials, NO real refund or email.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * LIVE PROOF still needs owner-supplied inputs (names only, never values):
 *   E2E_SANDBOX=1, E2E_FIXTURES_URL / E2E_FIXTURES_TOKEN,
 *   E2E_ADMIN_REQUESTER_*, E2E_ADMIN_APPROVER_*, E2E_PARTNER_A_*, plus real
 *   Razorpay sandbox credentials. The Playwright spec
 *   `e2e/payment-sandbox.spec.ts --grep "Scenario E"` covers that full path but
 *   is AUTHORED — NOT RUN, BLOCKED BY OWNER INPUT. These unit tests therefore
 *   prove code-level integrity only; only AGENT 00 may mark the Refunds gate
 *   PASS after re-running the live spec and recording evidence.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// executeRefund's default executor is imported at module load; always pass our
// own executor, and neutralise the real DB so an accidental default call cannot
// touch a database.
vi.mock("@/lib/db", () => ({ query: vi.fn(async () => []) }));

import {
  assertDualControl,
  buildLedgerReversalKey,
  DualControlError,
  executeRefund,
  RefundApprovalError,
  syncRefundStatus,
  type DbExecutor,
  type ExecuteRefundInput,
  type RefundExecutionRow,
} from "@/lib/payments/refund-execution";
import {
  getRefundProvider,
  isProviderRefundConfirmed,
  RazorpayRefundProvider,
  razorpayRefundConfigStatus,
  RefundProviderNotConfiguredError,
  TestRefundProvider,
  type ProviderRefund,
  type RefundParams,
  type RefundProvider,
} from "@/lib/payments/refund-provider";

/* ── fixtures: identities/amounts are test-only, never business facts ─────── */

const APPROVAL = {
  id: "qa_apr_1",
  order_id: "qa_ord_1",
  amount: 1250,
  status: "approved",
  requested_by: "requester.qa@shop.test",
  approved_by: "approver.qa@shop.test",
};

const baseInput: ExecuteRefundInput = {
  refundRequestId: APPROVAL.id,
  orderId: APPROVAL.order_id,
  amount: APPROVAL.amount,
  requester: APPROVAL.requested_by,
  approver: APPROVAL.approved_by,
  idempotencyKey: "qa-idem-base",
  currency: "INR",
  partnerId: "partner-qa-A",
  paymentId: "pay_qa_1",
};

/** Provider double that records every call — proves "no second provider call". */
class SpyProvider implements RefundProvider {
  readonly name = "qa-spy";
  readonly calls: RefundParams[] = [];
  constructor(
    private readonly status = "processed",
    private readonly refId = "qa_provider_refund_1"
  ) {}
  async refund(params: RefundParams): Promise<ProviderRefund> {
    this.calls.push({ ...params });
    return {
      providerRefundId: this.refId,
      status: this.status,
      raw: { id: this.refId, status: this.status, environment: "test" },
    };
  }
  async getRefund(providerRefundId: string): Promise<ProviderRefund> {
    return {
      providerRefundId,
      status: this.status,
      raw: { id: providerRefundId, environment: "test" },
    };
  }
}

interface QaDb {
  executor: DbExecutor;
  calls: Array<{ sql: string; params: any[] }>;
  rows: Map<string, RefundExecutionRow>;
  insertCount: number;
}

/**
 * Faithful in-memory model of the subset of SQL refund-execution issues. It
 * enforces the same ON CONFLICT (idempotency_key) DO NOTHING behaviour, so a
 * replay cannot claim a second row — that is what A56 relies on to avoid a
 * second provider call.
 */
function makeDb(approval: Record<string, any> | null = { ...APPROVAL }): QaDb {
  const calls: QaDb["calls"] = [];
  const rows = new Map<string, RefundExecutionRow>();
  let insertCount = 0;

  const executor: DbExecutor = async (sql, params = []) => {
    calls.push({ sql, params });

    if (sql.includes("FROM order_refunds")) {
      return approval ? [approval] : [];
    }

    if (sql.startsWith("INSERT INTO refund_execution")) {
      const key = String(params[8]);
      if (rows.has(key)) return []; // ON CONFLICT DO NOTHING
      insertCount += 1;
      const row: RefundExecutionRow = {
        id: String(params[0]),
        refund_request_id: params[1] as string | null,
        order_id: String(params[2]),
        partner_id: params[3] as string | null,
        amount: Number(params[4]),
        currency: String(params[5]),
        status: "initiated",
        requested_by: String(params[6]),
        approved_by: String(params[7]),
        idempotency_key: key,
        provider: String(params[9]),
        ledger_reversal_key: params[10] as string | null,
        provider_refund_id: null,
        provider_response: null,
        inventory_restored: false,
        failure_reason: null,
      };
      rows.set(key, row);
      return [{ ...row }];
    }

    const byKey = sql.match(/WHERE\s+idempotency_key\s*=\s*\$1/i);
    if (byKey && sql.trim().toUpperCase().startsWith("SELECT")) {
      const row = rows.get(String(params[0]));
      return row ? [{ ...row }] : [];
    }

    if (sql.startsWith("UPDATE refund_execution")) {
      const id = String(params[0]);
      const row = [...rows.values()].find((r) => r.id === id);
      if (!row) return [];
      if (sql.includes("provider_refund_id = $3")) {
        row.status = String(params[1]) as RefundExecutionRow["status"];
        row.provider_refund_id = params[2] as string | null;
        row.provider_response = JSON.parse(String(params[3] ?? "{}"));
        row.failure_reason = params[4] as string | null;
      } else if (sql.includes("status = 'failed'")) {
        row.status = "failed";
        row.failure_reason = String(params[1]);
      } else {
        row.status = String(params[1]) as RefundExecutionRow["status"];
        row.provider_response = JSON.parse(String(params[2] ?? "{}"));
      }
      return [{ ...row }];
    }

    if (sql.trim().toUpperCase().startsWith("SELECT") && sql.includes("WHERE id = $1")) {
      const row = [...rows.values()].find((r) => r.id === String(params[0]));
      return row ? [{ ...row }] : [];
    }

    return [];
  };

  return { executor, calls, rows, get insertCount() { return insertCount; } };
}

const fetchSpy = () => vi.spyOn(globalThis, "fetch");

beforeEach(() => {
  vi.restoreAllMocks();
});

/* ── 1. dual control ──────────────────────────────────────────────────────── */

describe("Scenario E — dual control", () => {
  it("rejects requester === approver (case/whitespace insensitive)", () => {
    expect(() => assertDualControl("same@shop.test", "same@shop.test")).toThrow(
      DualControlError
    );
    expect(() => assertDualControl(" Same@Shop.test ", "same@SHOP.test")).toThrow(
      DualControlError
    );
    expect(() => assertDualControl("a@shop.test", " ")).toThrow(DualControlError);
  });

  it("never calls the provider or claims a row when the same person requests and approves", async () => {
    const db = makeDb();
    const provider = new SpyProvider();
    await expect(
      executeRefund(
        { ...baseInput, requester: "twin@shop.test", approver: "TWIN@shop.test" },
        provider,
        db.executor
      )
    ).rejects.toBeInstanceOf(DualControlError);
    expect(provider.calls).toHaveLength(0);
    expect(db.insertCount).toBe(0);
  });
});

/* ── 2. approval is a permission, not a transfer ──────────────────────────── */

describe("Scenario E — no provider call without an approved order_refunds row", () => {
  const badApprovals: Array<[string, Record<string, any> | null]> = [
    ["missing approval row", null],
    ["pending approval", { ...APPROVAL, status: "pending" }],
    ["no recorded approver", { ...APPROVAL, approved_by: "   " }],
    ["approval for a different order", { ...APPROVAL, order_id: "another-order" }],
  ];

  for (const [label, approval] of badApprovals) {
    it(`refuses to execute for ${label}`, async () => {
      const db = makeDb(approval);
      const provider = new SpyProvider();
      await expect(
        executeRefund(baseInput, provider, db.executor)
      ).rejects.toBeInstanceOf(RefundApprovalError);
      expect(provider.calls).toHaveLength(0);
      expect(db.insertCount).toBe(0);
    });
  }

  it("a 'completed' approval is accepted (approved/completed are the only valid states)", async () => {
    const db = makeDb({ ...APPROVAL, status: "completed" });
    const result = await executeRefund(baseInput, new SpyProvider(), db.executor);
    expect(result.reused).toBe(false);
    expect(result.execution.status).toBe("provider_confirmed");
  });

  it("never mutates order status — approving a refund cannot mark an order paid", async () => {
    const db = makeDb();
    await executeRefund(baseInput, new SpyProvider(), db.executor);
    const mutatesOrders = db.calls.some((c) =>
      /UPDATE\s+orders\b|UPDATE\s+order\b|SET\s+status\s*=\s*'paid'/i.test(c.sql)
    );
    expect(mutatesOrders).toBe(false);
  });
});

/* ── 3. idempotency ───────────────────────────────────────────────────────── */

describe("Scenario E — idempotency key prevents a second provider.refund call", () => {
  it("replays return the stored execution without contacting the provider again", async () => {
    const db = makeDb();
    const provider = new SpyProvider();
    const input = { ...baseInput, idempotencyKey: "qa-idem-replay" };

    const first = await executeRefund(input, provider, db.executor);
    const second = await executeRefund(input, provider, db.executor);

    expect(first.reused).toBe(false);
    expect(second.reused).toBe(true);
    expect(provider.calls).toHaveLength(1);
    expect(db.insertCount).toBe(1);
    expect(second.execution.id).toBe(first.execution.id);
    expect(second.providerRefund.providerRefundId).toBe(
      first.providerRefund.providerRefundId
    );
    expect(provider.calls[0].idempotencyKey).toBe("qa-idem-replay");
  });

  it("an empty idempotency key is rejected before any DB or provider work", async () => {
    const db = makeDb();
    const provider = new SpyProvider();
    await expect(
      executeRefund({ ...baseInput, idempotencyKey: "   " }, provider, db.executor)
    ).rejects.toMatchObject({ code: "IDEMPOTENCY_REQUIRED" });
    expect(provider.calls).toHaveLength(0);
    expect(db.insertCount).toBe(0);
  });

  it("a distinct idempotency key is a genuinely new execution", async () => {
    const db = makeDb();
    const provider = new SpyProvider();
    await executeRefund({ ...baseInput, idempotencyKey: "qa-key-1" }, provider, db.executor);
    const second = await executeRefund(
      { ...baseInput, idempotencyKey: "qa-key-2" },
      provider,
      db.executor
    );
    expect(second.reused).toBe(false);
    expect(provider.calls).toHaveLength(2);
    expect(db.insertCount).toBe(2);
  });
});

/* ── 4. provider confirmation governs status ─────────────────────────────── */

describe("Scenario E — provider_confirmed only when provider returns confirmation", () => {
  it("processes a confirmed refund to provider_confirmed with its provider id", async () => {
    const db = makeDb();
    const result = await executeRefund(
      { ...baseInput, idempotencyKey: "qa-idem-confirmed" },
      new SpyProvider("processed", "qa_done_ref"),
      db.executor
    );
    expect(result.execution.status).toBe("provider_confirmed");
    expect(result.execution.provider_refund_id).toBe("qa_done_ref");
    expect(result.execution.failure_reason).toBeNull();
    expect(result.providerRefund.providerRefundId).toBe("qa_done_ref");
  });

  it("keeps an unconfirmed provider response at initiated (never pretend money moved)", async () => {
    for (const unconfirmed of ["pending", "created", "authorized", "failed"]) {
      const db = makeDb();
      const result = await executeRefund(
        { ...baseInput, idempotencyKey: `qa-idem-${unconfirmed}` },
        new SpyProvider(unconfirmed, `qa_${unconfirmed}_ref`),
        db.executor
      );
      expect(result.execution.status).toBe("initiated");
      expect(result.execution.status).not.toBe("provider_confirmed");
      expect(isProviderRefundConfirmed(unconfirmed)).toBe(false);
      expect(result.execution.failure_reason).toMatch(/not confirmed/i);
    }
  });

  it("syncRefundStatus only promotes after the provider says confirmed", async () => {
    const db = makeDb();
    const started = await executeRefund(
      { ...baseInput, idempotencyKey: "qa-idem-sync" },
      new SpyProvider("pending", "qa_sync_ref"),
      db.executor
    );
    expect(started.execution.status).toBe("initiated");

    const stillPending = await syncRefundStatus(
      started.execution.id,
      new SpyProvider("pending", "qa_sync_ref"),
      db.executor
    );
    expect(stillPending.status).toBe("initiated");

    const confirmed = await syncRefundStatus(
      started.execution.id,
      new SpyProvider("captured", "qa_sync_ref"),
      db.executor
    );
    expect(confirmed.status).toBe("provider_confirmed");
    expect(isProviderRefundConfirmed("CAPTURED")).toBe(true);
  });
});

/* ── 5. ledger reversal key ───────────────────────────────────────────────── */

describe("Scenario E — ledger reversal key generated for the finance link", () => {
  it("is generated, persisted, deterministic and unique per execution", async () => {
    expect(buildLedgerReversalKey("exec_42")).toBe("refund-ledger-reversal:exec_42");

    const db = makeDb();
    const a = await executeRefund(
      { ...baseInput, idempotencyKey: "qa-idem-key-a" },
      new SpyProvider(),
      db.executor
    );
    const b = await executeRefund(
      { ...baseInput, idempotencyKey: "qa-idem-key-b" },
      new SpyProvider(),
      db.executor
    );

    expect(a.execution.ledger_reversal_key).toBe(
      buildLedgerReversalKey(a.execution.id)
    );
    expect(b.execution.ledger_reversal_key).toBe(
      buildLedgerReversalKey(b.execution.id)
    );
    expect(a.execution.ledger_reversal_key).not.toBe(b.execution.ledger_reversal_key);
    const insert = db.calls.find((c) => c.sql.startsWith("INSERT INTO refund_execution"));
    expect(insert?.params[10]).toBe(a.execution.ledger_reversal_key);
  });
});

/* ── 6. inventory_restored is gated by eligibility ────────────────────────── */

/**
 * QA finding: A56's executeRefund() never sets `inventory_restored = true` — it
 * has no eligibility input and its INSERT omits the column, leaving the DB
 * default (false). For this made-to-order/one-of-one catalogue that conservative
 * default is SAFE (a sold piece must not be auto-restocked). The test below
 * passes an explicit eligibility signal into the fixture and asserts the flag
 * is only ever set for an ineligible (false) case here; the "eligible -> true"
 * half is NOT implemented in A56 and is surfaced to the Lead in the report.
 */
const inventoryCases = [
  { label: "made-to-order / one-of-one work", eligible: false },
  { label: "digital work", eligible: false },
  { label: "condition not resellable", eligible: false },
  { label: "no explicit eligibility granted", eligible: false },
];

describe("Scenario E — inventory_restored flag only set when eligible", () => {
  for (const c of inventoryCases) {
    it(`does not restore inventory for ${c.label}`, async () => {
      const db = makeDb();
      // Eligibility is passed in by the caller/integration; refund execution
      // must not flip the flag without it.
      const eligibilityPassedIn = c.eligible;
      const result = await executeRefund(
        {
          ...baseInput,
          idempotencyKey: `qa-idem-inv-${c.label.replace(/\W+/g, "-")}`,
          // A56 ignores unknown keys today; kept here to document the contract
          // the integration is expected to supply.
          ...({ inventoryEligible: eligibilityPassedIn } as Record<string, unknown>),
        } as ExecuteRefundInput,
        new SpyProvider(),
        db.executor
      );
      expect(eligibilityPassedIn).toBe(false);
      expect(result.execution.inventory_restored).toBe(false);
      const insert = db.calls.find((call) =>
        call.sql.startsWith("INSERT INTO refund_execution")
      );
      expect(insert?.sql ?? "").not.toMatch(/inventory_restored\s*=/i);
    });
  }

  it("no code path in refund execution flips inventory_restored to true", async () => {
    const db = makeDb();
    const result = await executeRefund(
      { ...baseInput, idempotencyKey: "qa-idem-inv-never" } as ExecuteRefundInput,
      new SpyProvider(),
      db.executor
    );
    expect(result.execution.inventory_restored).toBe(false);
    expect(
      db.calls.some((c) => /inventory_restored\s*=\s*true/i.test(c.sql))
    ).toBe(false);
  });
});

/* ── 7. test adapter only — never live Razorpay ──────────────────────────── */

describe("Scenario E — the test provider is used, never live Razorpay", () => {
  it("non-production configuration selects the deterministic TestRefundProvider", () => {
    for (const env of [{ NODE_ENV: "test" }, { NODE_ENV: "development" }, {}]) {
      const provider = getRefundProvider(env as NodeJS.ProcessEnv);
      expect(provider).toBeInstanceOf(TestRefundProvider);
      expect(provider.name).toBe("test");
    }
  });

  it("executes a refund with the test adapter and touches no network", async () => {
    const fetch = fetchSpy();
    const provider = getRefundProvider({ NODE_ENV: "test" });
    const db = makeDb();
    const result = await executeRefund(baseInput, provider, db.executor);

    expect(result.execution.status).toBe("provider_confirmed");
    expect(result.execution.provider).toBe("test");
    expect(result.execution.provider_refund_id).toMatch(/^test_refund_/);
    expect((result.providerRefund.raw as any).environment).toBe("test");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("TestRefundProvider dedupes on idempotency key without a network call", async () => {
    const fetch = fetchSpy();
    const provider = new TestRefundProvider();
    const params: RefundParams = {
      amount: 10,
      currency: "INR",
      orderId: "qa_ord_1",
      idempotencyKey: "qa-test-dedupe",
    };
    const a = await provider.refund(params);
    const b = await provider.refund(params);
    expect(b.providerRefundId).toBe(a.providerRefundId);
    expect(provider.calls).toHaveLength(2); // calls recorded, but id is deterministic
    expect(fetch).not.toHaveBeenCalled();
  });
});

/* ── 8. unconfigured production provider throws loudly ───────────────────── */

describe("Scenario E — unconfigured production provider throws", () => {
  it("production with no credentials returns a provider that refuses to move money", async () => {
    const provider = getRefundProvider({ NODE_ENV: "production" });
    await expect(
      provider.refund({
        amount: 10,
        orderId: "qa_ord_1",
        idempotencyKey: "qa-prod-idem",
        paymentId: "pay_qa_1",
      })
    ).rejects.toBeInstanceOf(RefundProviderNotConfiguredError);
    await expect(provider.getRefund("rf_any")).rejects.toBeInstanceOf(
      RefundProviderNotConfiguredError
    );
  });

  it("never fabricates credentials and reports exactly what is missing", () => {
    const status = razorpayRefundConfigStatus({} as NodeJS.ProcessEnv);
    expect(status.configured).toBe(false);
    expect(status.missing).toEqual(
      expect.arrayContaining(["RAZORPAY_KEY_ID", expect.stringContaining("RAZORPAY_SECRET")])
    );
    expect(() =>
      new RazorpayRefundProvider({ keyId: "", secret: "" })
    ).toThrow(RefundProviderNotConfiguredError);
  });

  it("a failed provider call records 'failed', never 'provider_confirmed'", async () => {
    const db = makeDb();
    const provider = getRefundProvider({ NODE_ENV: "production" });
    await expect(executeRefund(baseInput, provider, db.executor)).rejects.toBeInstanceOf(
      RefundProviderNotConfiguredError
    );
    const stored = [...db.rows.values()][0];
    expect(stored.status).toBe("failed");
    expect(stored.provider_refund_id).toBeNull();
    expect(stored.failure_reason).toMatch(/not configured/i);
  });
});
