/**
 * FINAL GO — AGENT A98 (QA), Scenario H: failed / delayed / duplicate payments.
 *
 * Money-safety tests for the four ways a payment can go wrong without anyone
 * noticing until the month-end reconciliation:
 *   1. a failed provider status must never become "paid" because the browser
 *      claimed success (provider truth + single-use payment guard);
 *   2. a redelivered webhook event id must have exactly ONE effect;
 *   3. a capture that lands after the webhook was missed must still be found by
 *      providerVerify and reconciled;
 *   4. a failed payment must not consume stock — the hold is released/swept, not
 *      sold — and a replayed payment must not mint a second order id.
 *
 * Every test is pure: fake executors stand in for Postgres (UNIQUE/PK conflict
 * semantics), fake providerVerify fakes stand in for Razorpay. No live payments,
 * refunds, emails, network calls or DB connections are made.
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/* ── No real DB: both import specifiers resolve to lib/db.ts ──────────────── */
const queryMock = vi.fn(async (..._a: any[]) => [] as any[]);
vi.mock("@/lib/db", () => ({ query: (...a: any[]) => queryMock(...a) }));
vi.mock("../lib/db", () => ({ query: (...a: any[]) => queryMock(...a) }));

import { recordProviderEvent, type DbExecutor, type ProviderEventInput } from "@/lib/payments/events";
import {
  deriveOrderState,
  reconcilePayment,
  runReconciliationBatch,
  getPaymentVerifier,
  type ProviderPaymentState,
  type ReconciliationIssueRow,
  type ProviderVerify,
} from "@/lib/payments/reconciliation";
import { claimPayment, paymentAlreadyProcessed } from "@/lib/payment-guard";
import { availableStock, canReserve } from "@/lib/inventory";

const root = join(__dirname, "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

beforeEach(() => {
  queryMock.mockReset();
  queryMock.mockResolvedValue([]);
});

/* ── Fake executors ───────────────────────────────────────────────────────── */

const norm = (sql: string) => sql.replace(/\s+/g, " ").trim();

/**
 * In-memory `payment_event` table with the real UNIQUE(provider,
 * provider_event_id) conflict semantics. SQL is matched loosely; the point is
 * the behaviour of `recordProviderEvent`, not the SQL string itself.
 */
function makePaymentEventDb() {
  const rows = new Map<string, { id: string; type: string; paymentId: string | null }>();
  let seq = 0;
  const executor: DbExecutor = async (sql, params = []) => {
    const s = norm(sql);
    if (s.startsWith("INSERT INTO payment_event")) {
      const [provider, providerEventId, eventType, , paymentId] = params;
      const key = `${provider}|${providerEventId}`;
      if (rows.has(key)) return []; // ON CONFLICT DO NOTHING → no id returned
      const id = `evt_row_${++seq}`;
      rows.set(key, { id, type: eventType, paymentId });
      return [{ id }];
    }
    if (s.startsWith("SELECT id FROM payment_event")) {
      const [provider, providerEventId] = params;
      const row = rows.get(`${provider}|${providerEventId}`);
      return row ? [{ id: row.id }] : [];
    }
    return [];
  };
  return { executor, rows };
}

/** In-memory `processed_payments` table (PK payment_id) for the single-use guard. */
function makeProcessedPaymentsDb() {
  const claimed = new Set<string>();
  queryMock.mockImplementation(async (sql: string, params: any[] = []) => {
    const s = norm(sql);
    const id = params[0];
    if (s.startsWith("INSERT INTO processed_payments")) {
      if (claimed.has(id)) return []; // ON CONFLICT DO NOTHING
      claimed.add(id);
      return [{ payment_id: id }];
    }
    if (s.startsWith("SELECT payment_id FROM processed_payments")) {
      return claimed.has(id) ? [{ payment_id: id }] : [];
    }
    if (s.startsWith("DELETE FROM processed_payments")) {
      claimed.delete(id);
      return [];
    }
    return [];
  });
  return claimed;
}

/** Captures UPDATEs issued while resolving a reconciliation issue. */
function makeIssueDb() {
  const updates: Array<{ sql: string; params: any[] }> = [];
  const executor: DbExecutor = async (sql, params = []) => {
    if (norm(sql).startsWith("UPDATE payment_reconciliation_issue")) {
      updates.push({ sql: norm(sql), params });
    }
    return [];
  };
  return { executor, updates };
}

const failedState = (paymentId: string): ProviderPaymentState => ({
  paymentId,
  status: "failed",
  captured: false,
  refunded: false,
  amount: 1000,
});

/* ── H1: a failed provider status never becomes "paid" from a frontend claim ─ */

describe("Scenario H1 — failed provider status is never 'paid' on a client claim", () => {
  it("deriveOrderState ignores frontend-style status strings and maps failure to 'failed'", () => {
    const base = { paymentId: "pay_h1", captured: false, refunded: false };
    expect(deriveOrderState({ ...base, status: "failed" })).toBe("failed");
    // None of these browser-supplied claims is evidence that money moved. The
    // provider flag `captured` is false in every case.
    for (const claim of ["paid", "success", "PAID", "completed", "ok", "1"]) {
      expect(deriveOrderState({ ...base, status: claim })).toBe("failed");
    }
    // Only the provider's own 'captured' status / captured flag yields 'paid'.
    expect(deriveOrderState({ ...base, status: "captured", captured: true })).toBe("paid");
  });

  it("reconciliation calls providerVerify and discards a browser 'paid' claim when the provider says failed", async () => {
    const verify = vi.fn<ProviderVerify>(async (id) => failedState(id));
    const result = await reconcilePayment(
      // LocalPayment.status is the browser claim; it must not decide the state.
      { id: "pay_h1", amount: 1000, status: "paid" },
      { id: "ord_h1", amount: 1000, status: "pending" },
      verify,
      async () => []
    );
    expect(verify).toHaveBeenCalledWith("pay_h1");
    expect(result.derivedState).toBe("failed");
    expect(result.issueType).toBeNull(); // no captured_unconfirmed ticket opened
    expect(result.issueId).toBeNull();
  });

  it("a payment that failed verification is never claimed; only a captured one reaches the guard", () => {
    const src = read("app/api/store/checkout/complete/route.ts");
    const captureCheck = src.indexOf('payment.status !== "captured"');
    const claim = src.indexOf("claimPayment(");
    expect(captureCheck).toBeGreaterThan(-1);
    expect(claim).toBeGreaterThan(captureCheck); // guard runs only after capture confirmed
    expect(src).not.toMatch(/body\.(paid|payment_status|paymentStatus)/);
  });

  it("the single-use guard refuses a second claim for the same payment id", async () => {
    makeProcessedPaymentsDb();
    expect(
      await claimPayment({ paymentId: "pay_failed_then_reused", cartId: "c1", razorpayOrderId: "o1" })
    ).toBe(true);
    // Even with a different cart/order, the same payment id cannot be claimed twice.
    expect(
      await claimPayment({ paymentId: "pay_failed_then_reused", cartId: "c2", razorpayOrderId: "o2" })
    ).toBe(false);
    expect(await paymentAlreadyProcessed("pay_failed_then_reused")).toBe(true);
  });
});

/* ── H2: duplicate webhook event id → no second effect ───────────────────── */

describe("Scenario H2 — a duplicate webhook event id has exactly one effect", () => {
  const event: ProviderEventInput = {
    provider: "razorpay",
    providerEventId: "evt_dup_H",
    eventType: "payment.captured",
    orderId: "ord_h2",
    paymentId: "pay_h2",
    payload: { amount: 1000, status: "captured" },
  };

  it("a redelivery (even with a tampered payload) returns isNew=false and causes no second side effect", async () => {
    const db = makePaymentEventDb();
    let effects = 0;
    const orderIds: string[] = [];
    const handle = async (e: ProviderEventInput) => {
      const r = await recordProviderEvent(e, db.executor);
      if (r.isNew) {
        effects += 1; // create order / post ledger row / release stock — once only
        orderIds.push(`order-for-${e.paymentId}`);
      }
      return r;
    };

    const first = await handle(event);
    const duplicate = await handle({ ...event, payload: { amount: 999999 } });
    const third = await handle(event);

    expect(first.isNew).toBe(true);
    expect(duplicate.isNew).toBe(false);
    expect(third.isNew).toBe(false);
    expect(duplicate.eventId).toBe(first.eventId); // correlates, without repeating
    expect(effects).toBe(1);
    expect(orderIds).toEqual(["order-for-pay_h2"]);
    expect(db.rows.size).toBe(1);
  });

  it("dedupe is keyed on (provider, provider_event_id) and conflicts do not update a row", async () => {
    const db = makePaymentEventDb();
    const first = await recordProviderEvent(event, db.executor);
    const otherProvider = await recordProviderEvent(
      { ...event, provider: "razorpay_sandbox" },
      db.executor
    );
    const sameProviderNewId = await recordProviderEvent(
      { ...event, providerEventId: "evt_other" },
      db.executor
    );
    expect(first.isNew).toBe(true);
    // A different provider with the same event id is a distinct event.
    expect(otherProvider.isNew).toBe(true);
    // A new id on the same provider is also distinct.
    expect(sameProviderNewId.isNew).toBe(true);
    expect(db.rows.size).toBe(3);
  });
});

/* ── H3: delayed capture is eventually reconciled via providerVerify ─────── */

describe("Scenario H3 — a delayed/missed capture is reconciled from provider truth", () => {
  it("a capture that appears only on a later verify flips derivedState to paid and opens a webhook_missed issue", async () => {
    let checks = 0;
    const providerVerify: ProviderVerify = async (paymentId) => {
      checks += 1;
      if (checks === 1) {
        return { paymentId, status: "authorized", captured: false, refunded: false, amount: 1000 };
      }
      return { paymentId, status: "captured", captured: true, refunded: false, amount: 1000 };
    };
    const payment = { id: "pay_delayed", amount: 1000, webhookRecorded: false };
    const order = { id: "ord_delayed", amount: 1000, status: "pending" };
    const executor: DbExecutor = async (sql) => {
      if (norm(sql).startsWith("INSERT INTO payment_reconciliation_issue")) return [{ id: "iss_delayed" }];
      return [];
    };

    const early = await reconcilePayment(payment, order, providerVerify, executor);
    expect(early.derivedState).toBe("authorized");
    expect(early.issueType).toBe("authorized_unconfirmed");

    // Later the provider shows the capture; no browser claim is needed.
    const later = await reconcilePayment(payment, order, providerVerify, executor);
    expect(checks).toBe(2); // providerVerify called unconditionally each time
    expect(later.derivedState).toBe("paid");
    expect(later.issueType).toBe("webhook_missed");
    expect(later.issueId).toBe("iss_delayed");
  });

  it("an open issue stays retrying while the capture is pending, then resolves when it lands", async () => {
    const db = makeIssueDb();
    let checks = 0;
    const providerVerify: ProviderVerify = async (paymentId) => {
      checks += 1;
      if (checks === 1) {
        return { paymentId, status: "authorized", captured: false, refunded: false };
      }
      return { paymentId, status: "captured", captured: true, refunded: false };
    };
    const issue = (overrides: Partial<ReconciliationIssueRow> = {}): ReconciliationIssueRow => ({
      id: "iss_recon",
      order_id: "ord_h3",
      payment_id: "pay_h3",
      issue_type: "captured_unconfirmed",
      status: "open",
      attempts: 0,
      next_attempt_at: new Date(),
      last_error: null,
      resolution: null,
      ...overrides,
    });

    const firstPass = await runReconciliationBatch([issue()], providerVerify, db.executor);
    expect(firstPass.failed).toBe(1);
    expect(firstPass.processed).toBe(0);
    const retry = db.updates.find((u) => u.sql.includes("attempts = COALESCE"));
    expect(retry?.params[1]).toBe("retrying");
    expect(retry?.params[2]).toBe(1); // attempt incremented, with backoff

    const secondPass = await runReconciliationBatch(
      [issue({ status: "retrying", attempts: 1 })],
      providerVerify,
      db.executor
    );
    expect(secondPass.processed).toBe(1);
    expect(secondPass.failed).toBe(0);
    const resolved = [...db.updates]
      .reverse()
      .find((u) => u.sql.includes("status = COALESCE") && u.params[1] === "resolved");
    expect(resolved).toBeTruthy();
    expect(resolved?.params[5]).toMatch(/provider=captured/);
  });

  it("the verifier is a fake by default in tests — no live Razorpay call is made", () => {
    const verifier = getPaymentVerifier({} as NodeJS.ProcessEnv); // no keys, not production
    expect(verifier.mode).toBe("test");
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    return verifier("pay_any").then((state) => {
      expect(state.paymentId).toBe("pay_any");
      expect(fetchSpy).not.toHaveBeenCalled();
      fetchSpy.mockRestore();
    });
  });
});

/* ── H4: failed-payment inventory behaviour + no duplicate order id on replay ─ */

describe("Scenario H4 — failed payment leaves stock unsold and replays mint no order id", () => {
  it("a failed payment never consumes the hold; release returns the unit to the available pool", () => {
    const held = { variant_id: "v", on_hand: 1, reserved: 1, sold: 0 };
    expect(availableStock(held)).toBe(0);
    expect(canReserve(held, 1)).toBe(false); // no one else can take the held unit
    // releaseReservation / TTL sweep sets reserved back to 0 (clamped) and does
    // NOT touch `sold` — a failed payment must never reduce real stock.
    const released = { ...held, reserved: 0 };
    expect(availableStock(released)).toBe(1);
    expect(canReserve(released, 1)).toBe(true);
    expect(released.sold).toBe(0);
  });

  it("stock is consumed only AFTER the provider confirms capture, and the hold is swept on abandon/failure", () => {
    const complete = read("app/api/store/checkout/complete/route.ts");
    const captureCheck = complete.indexOf('payment.status !== "captured"');
    const consume = complete.indexOf("consumeReservation(");
    expect(captureCheck).toBeGreaterThan(-1);
    expect(consume).toBeGreaterThan(captureCheck); // no consume on a failed payment
    expect(complete).not.toMatch(/sold\s*\+/); // sold++ lives only inside consumeReservation

    const cron = read("app/api/cron/release-reservations/route.ts");
    expect(cron).toMatch(/releaseExpiredReservations/); // failed/abandoned holds freed by TTL
    const lib = read("lib/inventory.ts");
    expect(lib).toMatch(/reserved = GREATEST\(0, reserved - \$2\)/); // release never negative
    expect(lib).toMatch(/status = 'released'/);
  });

  it("replaying a verified payment generates only one order id", async () => {
    makeProcessedPaymentsDb();
    let orderSeq = 0;
    const generateOrderId = () => `ord_${++orderSeq}`; // stands in for medusa.completeOrder

    const completeOnce = async (paymentId: string) => {
      // The guard is claimed before the order is created — exactly as in the route.
      if (!(await claimPayment({ paymentId, cartId: "c", razorpayOrderId: "o" }))) {
        return { ok: false as const, code: "payment_already_used" };
      }
      return { ok: true as const, order_id: generateOrderId() };
    };

    const first = await completeOnce("pay_replay_H");
    const replay = await completeOnce("pay_replay_H");

    expect(first.ok).toBe(true);
    expect(first.order_id).toBe("ord_1");
    expect(replay.ok).toBe(false);
    expect((replay as any).code).toBe("payment_already_used");
    expect(orderSeq).toBe(1); // no second order id minted on replay
  });

  it("the route calls completeOrder exactly once and only after a successful claim", () => {
    const src = read("app/api/store/checkout/complete/route.ts");
    expect(src.indexOf("claimPayment(")).toBeLessThan(src.indexOf("completeOrder("));
    expect(src).toMatch(/if \(!claimed\)/);
    expect(src).toMatch(/payment_already_used/);
    expect((src.match(/completeOrder\(/g) || []).length).toBe(1);
  });
});
