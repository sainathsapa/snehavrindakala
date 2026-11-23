/**
 * AGENT A04 (remediation) — refund/inventory restoration verification.
 *
 * Closes QA finding A110: `inventory_restored` is no longer a dead column.
 * Everything here uses an in-memory fake DB and a deterministic fake provider —
 * NO live Razorpay call, NO real Postgres, NO fabricated credentials or stock.
 *
 * Invariants under test:
 *  - a refund approval alone NEVER restocks;
 *  - eligibility is derived from existing return/cancellation state + the
 *    documented policy (returns/process.ts restockDecision + RESTOCKABLE_CONDITIONS);
 *  - an undefined owner policy input fails safe to an observable PENDING action;
 *  - restoration is transactional, idempotent (UNIQUE action/movement keys) and
 *    concurrency-safe; inventory_restored flips only AFTER a real restoration;
 *  - a failure leaves an observable FAILED action and never a false flag.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Neutralise the real pool. Every function under test takes an injected
// executor; the mock only prevents an accidental connection at module load.
vi.mock("@/lib/db", () => ({
  query: vi.fn(async () => []),
  transaction: vi.fn(async (fn: any) => fn({ query: async () => ({ rows: [] }) })),
}));

import {
  executeRefund,
  markRefundInventoryRestored,
  restoreInventoryForRefund,
  type ExecuteRefundInput,
  type RefundRestorationInput,
  type RefundRestorationItem,
} from "@/lib/payments/refund-execution";
import { deriveRestockEligibility, type RestockPolicyInput } from "@/lib/returns/process";
import { restorationActionKey, restorationMovementKey } from "@/lib/inventory";

/* ── fake provider ────────────────────────────────────────────────────────── */

const provider = {
  name: "qa-fake",
  async refund(params: any) {
    return { providerRefundId: "pr_" + params.idempotencyKey, status: "processed", raw: { environment: "test" } };
  },
  async getRefund(id: string) {
    return { providerRefundId: id, status: "processed", raw: { environment: "test" } };
  },
};

/* ── fake DB ──────────────────────────────────────────────────────────────── */

interface Stock {
  variant_id: string;
  on_hand: number;
  reserved: number;
  sold: number;
}
interface Reservation {
  id: string;
  variant_id: string;
  cart_id: string;
  quantity: number;
  status: string;
  order_id: string | null;
}
interface ExecRow {
  id: string;
  refund_request_id: string | null;
  order_id: string;
  partner_id: string | null;
  amount: number;
  currency: string;
  status: string;
  requested_by: string;
  approved_by: string;
  idempotency_key: string;
  provider: string;
  provider_refund_id: string | null;
  provider_response: unknown;
  ledger_reversal_key: string | null;
  inventory_restored: boolean;
  inventory_restoration_state: string;
  inventory_eligibility_reason: string | null;
  inventory_restored_by: string | null;
  inventory_restored_at: string | null;
  failure_reason: string | null;
}
interface ActionRow {
  id: string;
  action_key: string;
  status: string;
  order_id: string;
  refund_execution_id: string | null;
  refund_request_id: string | null;
  return_request_id: string | null;
  order_item_id: string | null;
  variant_id: string | null;
  eligibility_reason: string | null;
  trigger: string | null;
  actor: string | null;
  attempts: number;
  last_error: string | null;
}
interface MovementRow {
  id: string;
  movement_key: string;
  direction: string;
  order_id: string;
  order_item_id: string | null;
  variant_id: string | null;
  quantity: number;
  refund_execution_id: string | null;
  refund_request_id: string | null;
  return_request_id: string | null;
  actor: string | null;
  reason: string | null;
  restoration_action_key: string | null;
}

const APPROVAL = {
  id: "apr_1",
  order_id: "ord_1",
  amount: 1000,
  status: "approved",
  requested_by: "requester@qa.test",
  approved_by: "approver@qa.test",
};

class FakeDb {
  approval: any = { ...APPROVAL };
  execs = new Map<string, ExecRow>();
  execByKey = new Map<string, ExecRow>();
  actions = new Map<string, ActionRow>();
  movements = new Map<string, MovementRow>();
  stocks = new Map<string, Stock>();
  reservations = new Map<string, Reservation>();
  calls: Array<{ sql: string; params: any[] }> = [];

  seedStock(variantId: string, sold = 1, onHand = 5) {
    this.stocks.set(variantId, { variant_id: variantId, on_hand: onHand, reserved: 0, sold });
  }
  seedConsumed(id: string, variantId: string, qty = 1, orderId = "ord_1") {
    this.reservations.set(id, {
      id,
      variant_id: variantId,
      cart_id: "cart_" + id,
      quantity: qty,
      status: "consumed",
      order_id: orderId,
    });
  }
  seedExecution(id: string, key = id) {
    const row: ExecRow = {
      id,
      refund_request_id: APPROVAL.id,
      order_id: APPROVAL.order_id,
      partner_id: null,
      amount: APPROVAL.amount,
      currency: "INR",
      status: "provider_confirmed",
      requested_by: APPROVAL.requested_by,
      approved_by: APPROVAL.approved_by,
      idempotency_key: key,
      provider: "qa-fake",
      provider_refund_id: "pr_" + key,
      provider_response: {},
      ledger_reversal_key: null,
      inventory_restored: false,
      inventory_restoration_state: "not_required",
      inventory_eligibility_reason: null,
      inventory_restored_by: null,
      inventory_restored_at: null,
      failure_reason: null,
    };
    this.execs.set(id, row);
    this.execByKey.set(key, row);
    return row;
  }

  /** In-memory model of just the SQL the restoration code issues. */
  executor = async (sql: string, params: any[] = []): Promise<any[]> => {
    this.calls.push({ sql, params });

    if (sql.includes("FROM order_refunds")) return this.approval ? [this.approval] : [];

    if (sql.startsWith("INSERT INTO refund_execution")) {
      const key = String(params[8]);
      if (this.execByKey.has(key)) return []; // ON CONFLICT DO NOTHING
      const row: ExecRow = {
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
        provider_refund_id: null,
        provider_response: null,
        ledger_reversal_key: params[10] as string | null,
        inventory_restored: false,
        inventory_restoration_state: "not_required",
        inventory_eligibility_reason: null,
        inventory_restored_by: null,
        inventory_restored_at: null,
        failure_reason: null,
      };
      this.execs.set(row.id, row);
      this.execByKey.set(key, row);
      return [{ ...row }];
    }

    if (sql.startsWith("SELECT * FROM refund_execution WHERE idempotency_key")) {
      const row = this.execByKey.get(String(params[0]));
      return row ? [{ ...row }] : [];
    }
    if (sql.startsWith("SELECT * FROM refund_execution WHERE id =")) {
      const row = this.execs.get(String(params[0]));
      return row ? [{ ...row }] : [];
    }

    if (sql.startsWith("INSERT INTO inventory_restoration_action")) {
      const key = String(params[1]);
      if (this.actions.has(key)) return []; // ON CONFLICT DO NOTHING
      const row: ActionRow = {
        id: String(params[0]),
        action_key: key,
        refund_execution_id: params[2] as string | null,
        refund_request_id: params[3] as string | null,
        return_request_id: params[4] as string | null,
        order_id: String(params[5]),
        order_item_id: params[6] as string | null,
        variant_id: params[7] as string | null,
        status: String(params[8]),
        eligibility_reason: params[9] as string | null,
        trigger: params[10] as string | null,
        actor: params[11] as string | null,
        attempts: 0,
        last_error: null,
      };
      this.actions.set(key, row);
      return [{ ...row }];
    }
    if (sql.startsWith("SELECT * FROM inventory_restoration_action WHERE action_key")) {
      const row = this.actions.get(String(params[0]));
      return row ? [{ ...row }] : [];
    }
    if (sql.startsWith("UPDATE inventory_restoration_action")) {
      const row = this.actions.get(String(params[0]));
      if (!row) return [];
      row.status = String(params[1]);
      if (params[2] != null) row.eligibility_reason = String(params[2]);
      if (params[3] != null) row.actor = String(params[3]);
      row.attempts += Number(params[4] ?? 0);
      row.last_error = params[5] as string | null;
      return [{ ...row }];
    }

    if (sql.startsWith("INSERT INTO inventory_movement")) {
      const key = String(params[1]);
      if (this.movements.has(key)) return []; // ON CONFLICT DO NOTHING
      // VALUES ($1,$2,'restock',$3,...): 'restock' is a literal, so all
      // following columns are shifted one index relative to the params array.
      const row: MovementRow = {
        id: String(params[0]),
        movement_key: key,
        direction: "restock",
        order_id: String(params[2]),
        order_item_id: params[3] as string | null,
        variant_id: params[4] as string | null,
        quantity: Number(params[5]),
        refund_execution_id: params[6] as string | null,
        refund_request_id: params[7] as string | null,
        return_request_id: params[8] as string | null,
        actor: params[9] as string | null,
        reason: params[10] as string | null,
        restoration_action_key: params[11] as string | null,
      };
      this.movements.set(key, row);
      return [{ ...row }];
    }

    if (sql.startsWith("SELECT id, variant_id, quantity FROM stock_reservation")) {
      return [...this.reservations.values()]
        .filter(
          (r) =>
            r.order_id === String(params[0]) &&
            r.status === "consumed" &&
            (!params[1] || r.variant_id === String(params[1]))
        )
        .map((r) => ({ ...r }));
    }
    if (sql.startsWith("UPDATE stock_reservation")) {
      const row = this.reservations.get(String(params[0]));
      if (row && row.status === "consumed") row.status = "released";
      return [];
    }
    if (sql.startsWith("UPDATE variant_stock")) {
      const row = this.stocks.get(String(params[0]));
      if (row) row.sold = Math.max(0, row.sold - Number(params[1]));
      return [];
    }

    if (sql.startsWith("UPDATE refund_execution")) {
      const row = this.execs.get(String(params[0]));
      if (!row) return [];
      if (sql.includes("inventory_restored = $2")) {
        if (row.inventory_restored) return []; // WHERE inventory_restored = FALSE
        row.inventory_restored = Boolean(params[1]);
        row.inventory_restoration_state = String(params[2]);
        row.inventory_restored_by = String(params[3]);
        row.inventory_restored_at = "2026-01-01T00:00:00.000Z";
      } else if (sql.includes("inventory_restoration_state = $2")) {
        row.inventory_restoration_state = String(params[1]);
        row.inventory_eligibility_reason = params[2] as string | null;
      } else if (sql.includes("provider_refund_id = $3")) {
        row.status = String(params[1]);
        row.provider_refund_id = params[2] as string | null;
        row.provider_response = JSON.parse(String(params[3] ?? "{}"));
        row.failure_reason = params[4] as string | null;
      } else if (sql.includes("status = 'failed'")) {
        row.status = "failed";
        row.failure_reason = String(params[1]);
      } else {
        row.status = String(params[1]);
        row.provider_response = JSON.parse(String(params[2] ?? "{}"));
      }
      return [{ ...row }];
    }

    return [];
  };

  execution(key = "exec_base"): ExecRow {
    const row = this.execs.get(key);
    if (!row) throw new Error(`No execution ${key}`);
    return row;
  }
}

/* ── fixture builders ─────────────────────────────────────────────────────── */

const ACTOR = "ops@qa.test";
let idem = 0;
function baseInput(overrides: Partial<ExecuteRefundInput> = {}): ExecuteRefundInput {
  idem += 1;
  return {
    refundRequestId: APPROVAL.id,
    orderId: APPROVAL.order_id,
    amount: APPROVAL.amount,
    requester: APPROVAL.requested_by,
    approver: APPROVAL.approved_by,
    idempotencyKey: `qa-inv-${idem}`,
    ...overrides,
  };
}

const returnedPolicy: RestockPolicyInput = {
  physicallyReceived: true,
  inspected: true,
  restockApproved: true,
  condition: "new",
};

function returnLine(overrides: Partial<RefundRestorationItem> = {}): RefundRestorationItem {
  return {
    trigger: "return_inspected",
    item: {},
    policy: { ...returnedPolicy },
    ...overrides,
  };
}

function restoration(items: RefundRestorationItem[]): RefundRestorationInput {
  return { actor: ACTOR, reason: "QA restoration", items };
}

function seededDb(variant = "v1", sold = 1): FakeDb {
  const db = new FakeDb();
  db.seedStock(variant, sold);
  db.seedConsumed("res_" + variant, variant, sold);
  return db;
}

beforeEach(() => {
  idem = 0;
  vi.clearAllMocks();
});

/* ── 1. pre-dispatch cancellation: mechanical restoration ─────────────────── */

describe("A04 — pre-dispatch cancellation", () => {
  it("restores consumed stock and sets inventory_restored only after success", async () => {
    const db = seededDb();
    const result = await executeRefund(
      baseInput({
        restoration: restoration([
          {
            trigger: "pre_dispatch_cancellation",
            item: {},
            policy: { dispatched: false },
            variantId: "v1",
          },
        ]),
      }),
      provider,
      db.executor
    );

    expect(result.reused).toBe(false);
    expect(result.execution.inventory_restored).toBe(true);
    expect(result.execution.inventory_restoration_state).toBe("restored");
    expect(result.execution.inventory_restored_by).toBe(ACTOR);
    expect(result.execution.inventory_restored_at).toBeTruthy();
    expect(db.stocks.get("v1")!.sold).toBe(0);
    expect(db.reservations.get("res_v1")!.status).toBe("released");
    expect(db.movements.size).toBe(1);
    const movement = [...db.movements.values()][0];
    expect(movement.direction).toBe("restock");
    expect(movement.quantity).toBe(1);
    expect(movement.variant_id).toBe("v1");
    expect(movement.actor).toBe(ACTOR);
    expect(movement.refund_execution_id).toBe(result.execution.id);
  });

  it("a pre-dispatch cancellation with an unrecorded dispatch status fails safe (pending)", async () => {
    const db = seededDb();
    const key = "exec_unknown_dispatch";
    db.seedExecution(key);
    const result = await restoreInventoryForRefund(
      {
        executionId: key,
        orderId: APPROVAL.order_id,
        actor: ACTOR,
        restoration: restoration([
          { trigger: "pre_dispatch_cancellation", item: {}, policy: {} },
        ]),
      },
      db.executor
    );
    expect(result.state).toBe("pending");
    expect(result.restoredItems).toBe(0);
    expect(db.stocks.get("v1")!.sold).toBe(1); // unchanged
    expect([...db.actions.values()][0].status).toBe("pending");
    expect(db.execs.get(key)!.inventory_restored).toBe(false);
  });
});

/* ── 2. eligible returned item ───────────────────────────────────────────── */

describe("A04 — eligible returned item", () => {
  it("restocks a physical item received, inspected, approved and resellable", async () => {
    const db = seededDb();
    const result = await executeRefund(
      baseInput({
        restoration: restoration([
          returnLine({ orderItemId: "item_1", variantId: "v1" }),
        ]),
      }),
      provider,
      db.executor
    );
    expect(result.execution.inventory_restored).toBe(true);
    expect(result.execution.inventory_restoration_state).toBe("restored");
    expect(db.stocks.get("v1")!.sold).toBe(0);
    expect(db.movements.size).toBe(1);
    expect([...db.movements.values()][0].order_item_id).toBe("item_1");
    const action = [...db.actions.values()][0];
    expect(action.status).toBe("restored");
    expect(action.actor).toBe(ACTOR);
  });

  it("pure eligibility derivation matches the documented policy", () => {
    expect(deriveRestockEligibility("return_inspected", {}, returnedPolicy).eligible).toBe(true);
    expect(
      deriveRestockEligibility("return_approved", {}, returnedPolicy).eligible
    ).toBe(false);
    expect(
      deriveRestockEligibility("refund_approved_only", {}, returnedPolicy).eligible
    ).toBe(false);
    expect(
      deriveRestockEligibility("restock_approved", { unique_artwork: true }, returnedPolicy)
        .eligible
    ).toBe(false);
  });
});

/* ── 3. non-restockable damaged item ─────────────────────────────────────── */

describe("A04 — non-restockable / unique items", () => {
  it("does not restock a damaged item and records a not_eligible action", async () => {
    const db = seededDb();
    const result = await executeRefund(
      baseInput({
        restoration: restoration([
          returnLine({ variantId: "v1", policy: { ...returnedPolicy, condition: "damaged" } }),
        ]),
      }),
      provider,
      db.executor
    );
    expect(result.execution.inventory_restored).toBe(false);
    expect(result.execution.inventory_restoration_state).toBe("not_eligible");
    expect(db.stocks.get("v1")!.sold).toBe(1); // unchanged
    expect(db.movements.size).toBe(0);
    expect([...db.actions.values()][0].status).toBe("not_eligible");
    expect([...db.actions.values()][0].eligibility_reason).toMatch(/RESTOCKABLE_CONDITIONS/);
  });

  it("never restocks a one-of-a-kind artwork even when approval is present", async () => {
    const db = seededDb();
    const result = await restoreInventoryForRefund(
      {
        executionId: "exec_unique",
        orderId: APPROVAL.order_id,
        actor: ACTOR,
        restoration: restoration([
          { trigger: "restock_approved", item: { one_of_one: true }, policy: returnedPolicy },
        ]),
      },
      db.executor
    );
    expect(result.state).toBe("not_eligible");
    expect(db.stocks.get("v1")!.sold).toBe(1);
  });
});

/* ── 4. refund without physical return ───────────────────────────────────── */

describe("A04 — refund without physical return / approval alone", () => {
  it("a refund-without-return never restocks stock", async () => {
    const db = seededDb();
    const result = await executeRefund(
      baseInput({
        restoration: restoration([
          { trigger: "refund_without_return", item: {}, policy: returnedPolicy },
        ]),
      }),
      provider,
      db.executor
    );
    expect(result.execution.inventory_restored).toBe(false);
    expect(db.stocks.get("v1")!.sold).toBe(1);
    expect(db.movements.size).toBe(0);
  });

  it("an approved refund with NO restoration context never touches inventory (A110 safe default)", async () => {
    const db = seededDb();
    const result = await executeRefund(baseInput(), provider, db.executor);
    expect(result.execution.status).toBe("provider_confirmed");
    expect(result.execution.inventory_restored).toBe(false);
    expect(db.movements.size).toBe(0);
    expect(db.actions.size).toBe(0);
    expect(db.calls.some((c) => /inventory_restored\s*=\s*true/i.test(c.sql))).toBe(false);
  });

  it("a return that is only requested/approved does not restock", async () => {
    const db = seededDb();
    for (const trigger of ["return_requested", "return_approved"] as const) {
      const result = await restoreInventoryForRefund(
        {
          executionId: `exec_${trigger}`,
          orderId: APPROVAL.order_id,
          actor: ACTOR,
          restoration: restoration([{ trigger, item: {}, policy: returnedPolicy }]),
        },
        db.executor
      );
      expect(result.state).toBe("not_eligible");
    }
    expect(db.stocks.get("v1")!.sold).toBe(1);
    expect(db.movements.size).toBe(0);
  });
});

/* ── 5. failed stock restoration ─────────────────────────────────────────── */

describe("A04 — failed restoration stays observable, never falsely restored", () => {
  it("records a FAILED action when no consumed reservation exists", async () => {
    const db = new FakeDb(); // stock tracked but no consumed reservation seeded
    db.seedStock("v1", 1);
    db.seedExecution("exec_failed");
    const result = await restoreInventoryForRefund(
      {
        executionId: "exec_failed",
        orderId: APPROVAL.order_id,
        actor: ACTOR,
        restoration: restoration([returnLine({ variantId: "v1" })]),
      },
      db.executor
    );
    expect(result.state).toBe("failed");
    expect(result.failedItems).toBe(1);
    expect(result.restoredItems).toBe(0);
    expect(db.movements.size).toBe(0);
    const action = [...db.actions.values()][0];
    expect(action.status).toBe("failed");
    expect(action.last_error).toMatch(/No consumed stock reservation/);
    expect(db.execs.get("exec_failed")!.inventory_restored).toBe(false);
    expect(db.execs.get("exec_failed")!.inventory_restoration_state).toBe("failed");
  });

  it("markRefundInventoryRestored never flips an already-flagged row and needs an actor", async () => {
    const db = seededDb();
    const key = "exec_mark";
    db.seedExecution(key, "k");
    const first = await markRefundInventoryRestored(key, ACTOR, db.executor);
    expect(first?.inventory_restored).toBe(true);
    expect(first?.inventory_restored_by).toBe(ACTOR);
    const second = await markRefundInventoryRestored(key, "other@qa.test", db.executor);
    expect(second).toBeNull(); // WHERE inventory_restored = FALSE -> no row
  });
});

/* ── 6. duplicate restoration ────────────────────────────────────────────── */

describe("A04 — duplicate restoration is idempotent", () => {
  it("a sequential replay does not restore stock twice", async () => {
    const db = seededDb();
    db.seedExecution("exec_dup");
    const params = {
      executionId: "exec_dup",
      orderId: APPROVAL.order_id,
      actor: ACTOR,
      restoration: restoration([returnLine({ variantId: "v1" })]),
    };
    const first = await restoreInventoryForRefund(params, db.executor);
    const second = await restoreInventoryForRefund(params, db.executor);

    expect(first.restoredItems).toBe(1);
    expect(second.alreadyRestoredItems).toBe(1);
    expect(second.restoredItems).toBe(0);
    expect(db.stocks.get("v1")!.sold).toBe(0);
    expect(db.movements.size).toBe(1);
    // Same deterministic keys on both calls.
    const actionKey = restorationActionKey("exec_dup", "v1");
    expect(restorationMovementKey(actionKey)).toBe([...db.movements.values()][0].movement_key);
  });
});

/* ── 7. concurrent processing ────────────────────────────────────────────── */

describe("A04 — concurrent processing", () => {
  it("two simultaneous restorations produce exactly one movement and one stock decrement", async () => {
    const db = seededDb();
    db.seedExecution("exec_concurrent");
    const params = {
      executionId: "exec_concurrent",
      orderId: APPROVAL.order_id,
      actor: ACTOR,
      restoration: restoration([returnLine({ variantId: "v1" })]),
    };
    const [a, b] = await Promise.all([
      restoreInventoryForRefund(params, db.executor),
      restoreInventoryForRefund(params, db.executor),
    ]);

    const actualRestores = a.restoredItems + b.restoredItems;
    const replayReports = a.alreadyRestoredItems + b.alreadyRestoredItems;
    expect(actualRestores).toBe(1);
    expect(replayReports).toBe(1);
    expect(db.movements.size).toBe(1);
    expect(db.stocks.get("v1")!.sold).toBe(0);
    expect(db.actions.size).toBe(1);
  });
});

/* ── 8. partial refund / quantity cap ────────────────────────────────────── */

describe("A04 — partial refund restores at most the item quantity", () => {
  it("a partial money refund restores only the requested unit of two consumed units", async () => {
    const db = new FakeDb();
    db.seedStock("v1", 2);
    db.seedConsumed("res_a", "v1", 1);
    db.seedConsumed("res_b", "v1", 1);
    const result = await executeRefund(
      baseInput({
        amount: 400, // partial refund of the 1000 total
        restoration: restoration([
          returnLine({ variantId: "v1", quantity: 1 }),
        ]),
      }),
      provider,
      db.executor
    );
    expect(result.execution.amount).toBe(400);
    expect(result.execution.inventory_restored).toBe(true);
    expect(db.stocks.get("v1")!.sold).toBe(1); // 2 - 1
    expect([...db.movements.values()][0].quantity).toBe(1);
    const released = [...db.reservations.values()].filter((r) => r.status === "released");
    expect(released).toHaveLength(1);
  });
});

/* ── 9. multiple items with mixed eligibility ────────────────────────────── */

describe("A04 — multiple items with mixed eligibility", () => {
  it("restocks only the eligible item in a mixed return", async () => {
    const db = new FakeDb();
    db.seedStock("good", 1);
    db.seedStock("bad", 1);
    db.seedConsumed("res_good", "good", 1);
    db.seedConsumed("res_bad", "bad", 1);

    const result = await executeRefund(
      baseInput({
        restoration: restoration([
          returnLine({ orderItemId: "i_good", variantId: "good", policy: returnedPolicy }),
          returnLine({
            orderItemId: "i_bad",
            variantId: "bad",
            policy: { ...returnedPolicy, condition: "damaged" },
          }),
        ]),
      }),
      provider,
      db.executor
    );

    expect(result.execution.inventory_restored).toBe(true);
    expect(db.stocks.get("good")!.sold).toBe(0);
    expect(db.stocks.get("bad")!.sold).toBe(1); // unchanged
    expect(db.movements.size).toBe(1);
    expect([...db.movements.values()][0].variant_id).toBe("good");
    const statuses = [...db.actions.values()].map((a) => a.status).sort();
    expect(statuses).toEqual(["not_eligible", "restored"]);
  });

  it("restores nothing when every item is ineligible", async () => {
    const db = new FakeDb();
    db.seedStock("bad", 1);
    db.seedConsumed("res_bad", "bad", 1);
    db.seedExecution("exec_all_bad");
    const result = await restoreInventoryForRefund(
      {
        executionId: "exec_all_bad",
        orderId: APPROVAL.order_id,
        actor: ACTOR,
        restoration: restoration([
          returnLine({ variantId: "bad", policy: { ...returnedPolicy, condition: "defective" } }),
        ]),
      },
      db.executor
    );
    expect(result.state).toBe("not_eligible");
    expect(result.execution?.inventory_restored).toBe(false);
    expect(db.movements.size).toBe(0);
  });
});

/* ── 10. migration is additive and safe ──────────────────────────────────── */

describe("A04 — migration 007 is additive and forward-recoverable", () => {
  const sql = readFileSync(
    join(process.cwd(), "db/migrations/007_refund_inventory.sql"),
    "utf8"
  );

  it("uses IF NOT EXISTS / ON CONFLICT DO NOTHING everywhere", () => {
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS/);
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS/);
    expect(sql).toMatch(/UNIQUE \(action_key\)/);
    expect(sql).toMatch(/UNIQUE \(movement_key\)/);
  });

  it("never deletes or alters existing financial history and documents recovery", () => {
    expect(sql).not.toMatch(/\bDROP\b|\bDELETE\b/i);
    expect(sql).toMatch(/NEVER deletes, alters or rewrites existing business\/financial/i);
    expect(sql).toMatch(/Forward recovery note/i);
    expect(sql).toMatch(/restored twice/i);
  });
});
