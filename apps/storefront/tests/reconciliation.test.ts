import { describe, expect, it, vi, beforeEach } from "vitest";
import crypto from "node:crypto";

/**
 * Reconciliation tests pin the money-safety rules: a redelivered event must not
 * produce a second effect, a webhook signature must fail closed, and the
 * provider (never the browser) decides what state an order is in.
 */

vi.mock("@/lib/db", () => ({
  query: vi.fn(async () => []),
}));

import {
  recordProviderEvent,
  verifyWebhookSignature,
  hashEventPayload,
  type ProviderEventInput,
} from "../lib/payments/events";
import {
  deriveOrderState,
  classifyMismatch,
  reconcilePayment,
  openIssueForMismatch,
  runReconciliationBatch,
  backoffDelayMs,
  RECONCILIATION_MAX_ATTEMPTS,
  type ProviderPaymentState,
  type ReconciliationIssueRow,
  type DbExecutor,
} from "../lib/payments/reconciliation";

const fake = (handler: (sql: string, params: any[]) => any[]): DbExecutor =>
  async (sql, params = []) => (await handler(sql, params)) ?? [];

const secret = "webhook_test_secret";
const sign = (body: string, key = secret) =>
  crypto.createHmac("sha256", key).update(body).digest("hex");

beforeEach(() => {
  delete process.env.RAZORPAY_SECRET;
  delete process.env.RAZORPAY_KEY_SECRET;
});

describe("provider event dedupe", () => {
  const event: ProviderEventInput = {
    provider: "razorpay",
    providerEventId: "evt_42",
    eventType: "payment.captured",
    orderId: "order_1",
    paymentId: "pay_1",
    payload: { amount: 1000, status: "captured" },
  };

  it("claims a new event and refuses to repeat the caller's effect on redelivery", async () => {
    let insertCount = 0;
    const executor = fake((sql) => {
      if (sql.startsWith("INSERT INTO payment_event")) {
        insertCount += 1;
        // First delivery claims the row; the redelivery conflicts (no row).
        return insertCount === 1 ? [{ id: "evt_row_1" }] : [];
      }
      if (sql.startsWith("SELECT id FROM payment_event")) {
        return [{ id: "evt_row_1" }];
      }
      return [];
    });

    let effects = 0;
    const handle = async (e: ProviderEventInput) => {
      const result = await recordProviderEvent(e, executor);
      if (result.isNew) effects += 1;
      return result;
    };

    const first = await handle(event);
    const duplicate = await handle(event);

    expect(first.isNew).toBe(true);
    expect(first.eventId).toBe("evt_row_1");
    expect(duplicate.isNew).toBe(false);
    expect(duplicate.eventId).toBe("evt_row_1");
    expect(effects).toBe(1); // no second order / ledger effect
  });

  it("uses ON CONFLICT DO NOTHING and hashes the payload deterministically", async () => {
    let insertSql = "";
    const executor = fake((sql) => {
      if (sql.startsWith("INSERT INTO payment_event")) {
        insertSql = sql;
        return [{ id: "x" }];
      }
      return [];
    });
    await recordProviderEvent(event, executor);
    expect(insertSql).toMatch(/ON CONFLICT \(provider, provider_event_id\) DO NOTHING/);
    expect(hashEventPayload({ a: 1, b: 2 })).toBe(hashEventPayload({ b: 2, a: 1 }));
  });
});

describe("webhook signature verification", () => {
  it("accepts a signature made with the real secret", () => {
    const body = '{"event":"payment.captured"}';
    expect(verifyWebhookSignature(secret, body, sign(body))).toBe(true);
  });

  it("accepts the sha256= prefix Razorpay may send", () => {
    const body = "{}";
    expect(verifyWebhookSignature(secret, body, `sha256=${sign(body)}`)).toBe(true);
  });

  it("rejects a tampered body", () => {
    const body = '{"amount":1000}';
    expect(
      verifyWebhookSignature(secret, '{"amount":2000}', sign(body))
    ).toBe(false);
  });

  it("fails closed when the secret is missing or blank", () => {
    const body = "{}";
    expect(verifyWebhookSignature(undefined, body, sign(body))).toBe(false);
    expect(verifyWebhookSignature("", body, sign(body))).toBe(false);
    expect(verifyWebhookSignature("   ", body, sign(body))).toBe(false);
  });

  it("rejects a missing, malformed, or foreign-secret header", () => {
    const body = "{}";
    expect(verifyWebhookSignature(secret, body, undefined)).toBe(false);
    expect(verifyWebhookSignature(secret, body, "not-a-digest")).toBe(false);
    expect(verifyWebhookSignature(secret, body, sign(body, "other_secret"))).toBe(
      false
    );
  });
});

describe("deriveOrderState", () => {
  const base = { paymentId: "pay_1", captured: false, refunded: false };
  it("maps provider truth to a single order state", () => {
    expect(deriveOrderState({ ...base, status: "captured", captured: true })).toBe("paid");
    expect(deriveOrderState({ ...base, status: "authorized" })).toBe("authorized");
    expect(
      deriveOrderState({ ...base, status: "refunded", captured: true, refunded: true })
    ).toBe("refunded");
    expect(deriveOrderState({ ...base, status: "failed" })).toBe("failed");
    expect(deriveOrderState({ ...base, status: "not_found" })).toBe("failed");
    expect(deriveOrderState({ ...base, status: "pending" })).toBe("pending");
  });

  it("lets refund win over capture and boolean flags win over a stale status", () => {
    expect(
      deriveOrderState({ ...base, status: "captured", captured: true, refunded: true })
    ).toBe("refunded");
    expect(deriveOrderState({ ...base, status: "authorized", captured: true })).toBe("paid");
  });
});

describe("mismatch classification and issue creation", () => {
  const captured: ProviderPaymentState = {
    paymentId: "pay_1",
    status: "captured",
    captured: true,
    refunded: false,
    amount: 1000,
    currency: "INR",
  };

  it("classifies amount mismatch before capture mismatch", () => {
    expect(
      classifyMismatch(
        { ...captured, amount: 900 },
        { id: "pay_1", amount: 1000 },
        { id: "ord_1", amount: 1000, status: "pending" }
      )
    ).toBe("amount_mismatch");
  });

  it("distinguishes a missed webhook from an unconfirmed capture", () => {
    const payment = { id: "pay_1", amount: 1000 };
    const order = { id: "ord_1", amount: 1000, status: "pending" };
    expect(
      classifyMismatch(captured, { ...payment, webhookRecorded: false }, order)
    ).toBe("webhook_missed");
    expect(
      classifyMismatch(captured, { ...payment, webhookRecorded: true }, order)
    ).toBe("captured_unconfirmed");
  });

  it("opens a captured_unconfirmed issue when the provider has money but our order does not", async () => {
    const inserts: any[][] = [];
    const executor = fake((sql, params) => {
      if (sql.startsWith("SELECT id FROM payment_reconciliation_issue")) return [];
      if (sql.startsWith("INSERT INTO payment_reconciliation_issue")) {
        inserts.push(params);
        return [{ id: "issue_1" }];
      }
      return [];
    });
    const verify = async () => captured;
    const result = await reconcilePayment(
      // A browser "success" flag is present but must be ignored — provider wins.
      { id: "pay_1", amount: 1000, status: "success" },
      { id: "ord_1", amount: 1000, status: "pending" },
      verify,
      executor
    );
    expect(result.issueType).toBe("captured_unconfirmed");
    expect(result.issueId).toBe("issue_1");
    expect(result.action).toBe("issue_opened");
    expect(inserts[0][2]).toBe("captured_unconfirmed");
  });

  it("does not trust frontend success when the provider says failed", async () => {
    const failed: ProviderPaymentState = {
      paymentId: "pay_1",
      status: "failed",
      captured: false,
      refunded: false,
      amount: 1000,
    };
    const verify = vi.fn(async () => failed);
    const executor = fake(() => []);
    const result = await reconcilePayment(
      { id: "pay_1", amount: 1000, status: "success" },
      { id: "ord_1", amount: 1000, status: "pending" },
      verify,
      executor
    );
    expect(verify).toHaveBeenCalledWith("pay_1");
    expect(result.derivedState).toBe("failed");
    expect(result.issueType).toBeNull();
    expect(result.issueId).toBeNull();
  });

  it("dedupes an existing open issue instead of opening a second one", async () => {
    let inserts = 0;
    const executor = fake((sql) => {
      if (sql.startsWith("SELECT id FROM payment_reconciliation_issue")) {
        return [{ id: "existing_issue" }];
      }
      if (sql.startsWith("INSERT INTO payment_reconciliation_issue")) inserts += 1;
      return [];
    });
    const result = await openIssueForMismatch(
      { orderId: "ord_1", paymentId: "pay_1", issueType: "captured_unconfirmed" },
      executor
    );
    expect(result).toEqual({ issueId: "existing_issue", isNew: false });
    expect(inserts).toBe(0);
  });
});

describe("retry batch with backoff and max attempts", () => {
  const issue = (
    id: string,
    attempts: number,
    status: ReconciliationIssueRow["status"] = "open"
  ): ReconciliationIssueRow => ({
    id,
    order_id: `ord_${id}`,
    payment_id: `pay_${id}`,
    issue_type: "captured_unconfirmed",
    status,
    attempts,
    next_attempt_at: new Date(),
    last_error: null,
    resolution: null,
  });

  it("backs off exponentially with a ceiling", () => {
    expect(backoffDelayMs(0)).toBe(60_000);
    expect(backoffDelayMs(1)).toBe(120_000);
    expect(backoffDelayMs(2)).toBe(240_000);
    expect(backoffDelayMs(99)).toBe(3_600_000);
  });

  it("resolves, retries, escalates and skips appropriately", async () => {
    const updates = new Map<string, any[]>();
    const executor = fake((sql, params) => {
      if (sql.startsWith("UPDATE payment_reconciliation_issue")) {
        updates.set(params[0], params);
        return [{}];
      }
      return [];
    });

    const verify = async (paymentId: string): Promise<ProviderPaymentState> => {
      if (paymentId === "pay_i1") {
        return {
          paymentId,
          status: "captured",
          captured: true,
          refunded: false,
          amount: 1000,
        };
      }
      throw new Error("provider down");
    };

    const result = await runReconciliationBatch(
      [
        issue("i1", 0), // provider now captured -> processed
        issue("i2", RECONCILIATION_MAX_ATTEMPTS - 1), // next failure -> escalated
        issue("i3", 2, "resolved"), // skipped
        issue("i4", RECONCILIATION_MAX_ATTEMPTS), // already out of attempts -> escalated
      ],
      verify,
      executor
    );

    expect(result).toEqual({
      total: 4,
      processed: 1,
      failed: 0,
      escalated: 2,
      skipped: 1,
    });
    expect(updates.get("i1")?.[1]).toBe("resolved");
    expect(updates.get("i2")?.[1]).toBe("escalated");
    expect(updates.has("i3")).toBe(false);
    expect(updates.get("i4")?.[1]).toBe("escalated");
  });

  it("schedules a failing issue for retry with a future attempt time", async () => {
    const updates = new Map<string, any[]>();
    const executor = fake((sql, params) => {
      if (sql.startsWith("UPDATE payment_reconciliation_issue")) {
        updates.set(params[0], params);
        return [{}];
      }
      return [];
    });
    const verify = async () => {
      throw new Error("provider down");
    };
    const result = await runReconciliationBatch([issue("r1", 0)], verify, executor);
    expect(result.failed).toBe(1);
    const row = updates.get("r1")!;
    expect(row[1]).toBe("retrying");
    expect(row[2]).toBe(1); // attempt count incremented
    expect(new Date(row[3]).getTime()).toBeGreaterThan(Date.now());
    expect(row[4]).toMatch(/provider down/);
  });
});
