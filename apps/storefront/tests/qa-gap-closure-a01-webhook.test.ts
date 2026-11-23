/**
 * A10 INDEPENDENT QA — A01 Razorpay webhook (pure + static only).
 *
 * I did not write the implementation. These assertions independently pin the
 * promised behaviour: raw-body HMAC with a constant-time compare, UNIQUE
 * payment_event dedupe, provider-truth verification, no order/charge creation,
 * and forward-only state. No live provider, secret or database is used.
 */
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  eventAgreesWithProvider,
  handleRazorpayWebhook,
  isStalePaymentEvent,
  parseRazorpayEvent,
  SUPPORTED_EVENT_TYPES,
} from "@/lib/payments/webhook";
import {
  recordProviderEvent,
  verifyWebhookSignature,
} from "@/lib/payments/events";

const app = join(__dirname, "..");
const read = (rel: string) => readFileSync(join(app, rel), "utf8");
const SECRET = "independent-qa-webhook-secret";

function sign(body: string, secret: string = SECRET): string {
  return createHmac("sha256", secret).update(body).digest("hex");
}

function rawEvent(
  eventType = "payment.captured",
  o: { id?: string; amount?: number; orderId?: string; paymentId?: string; status?: string } = {}
): string {
  return JSON.stringify({
    id: o.id ?? `evt_${eventType.replace(/\W/g, "_")}`,
    event: eventType,
    payload: {
      payment: {
        entity: {
          id: o.paymentId ?? "pay_qa_1",
          order_id: o.orderId ?? "order_qa_1",
          amount: o.amount ?? 50000,
          currency: "INR",
          status: o.status ?? "captured",
        },
      },
    },
  });
}

interface FakeOpts {
  providerStatus?: string;
  captured?: boolean;
  amount?: number;
  orderId?: string;
}

/** Fake executor that models the UNIQUE(provider, provider_event_id) claim. */
function fakeDb() {
  const sqls: string[] = [];
  let claimed = false;
  const executor = async (sql: string, _params: any[] = []): Promise<any[]> => {
    const s = sql.replace(/\s+/g, " ").trim();
    sqls.push(s);
    if (/^INSERT INTO payment_event\b/i.test(s)) {
      if (claimed) return []; // conflict → no row
      claimed = true;
      return [{ id: "evt-row-qa" }];
    }
    if (/^SELECT status FROM payment_event\b/i.test(s)) return [{ status: "processed" }];
    if (/^UPDATE payment_event\b/i.test(s)) return [];
    if (/^SELECT id FROM payment_reconciliation_issue\b/i.test(s)) return [];
    if (/^INSERT INTO payment_reconciliation_issue\b/i.test(s)) return [{ id: "issue-qa" }];
    return [];
  };
  return { executor, sqls };
}

function providerVerify(o: FakeOpts = {}) {
  return async (paymentId: string) => ({
    paymentId,
    status: o.providerStatus ?? "captured",
    captured: o.captured ?? true,
    refunded: false,
    amount: o.amount ?? 50000,
    currency: "INR",
    orderId: o.orderId ?? "order_qa_1",
  });
}

async function findTransaction(paymentId: string, _orderId: string | null) {
  return {
    paymentId,
    orderId: "order_qa_1",
    amount: 50000,
    currency: "INR",
    orderStatus: "paid",
    webhookRecorded: true,
  };
}

describe("A01 — raw-body HMAC is verified in constant time and fails closed", () => {
  it("accepts a correct signature (bare and sha256= forms) over the exact raw bytes", () => {
    const body = rawEvent();
    expect(verifyWebhookSignature(SECRET, body, sign(body))).toBe(true);
    expect(verifyWebhookSignature(SECRET, body, `sha256=${sign(body)}`)).toBe(true);
  });

  it("rejects a tampered body, a wrong digest, a missing header and a missing secret", () => {
    const body = rawEvent();
    expect(verifyWebhookSignature(SECRET, rawEvent("payment.failed"), sign(body))).toBe(false);
    expect(verifyWebhookSignature(SECRET, body, "a".repeat(64))).toBe(false);
    expect(verifyWebhookSignature(SECRET, body, null)).toBe(false);
    expect(verifyWebhookSignature("   ", body, sign(body))).toBe(false);
    expect(verifyWebhookSignature(undefined, body, sign(body))).toBe(false);
    expect(verifyWebhookSignature(SECRET, body, "not-a-digest")).toBe(false);
  });

  it("uses HMAC-SHA256 + timingSafeEqual (static source assertion)", () => {
    const src = read("lib/payments/events.ts");
    expect(src).toMatch(/createHmac\(\s*["']sha256["']\s*,/);
    expect(src).toMatch(/timingSafeEqual/);
    expect(src).toMatch(/if\s*\(!secret\s*\|\|\s*!secret\.trim\(\)\)\s*return false/);
  });
});

describe("A01 — UNIQUE payment_event dedupe (A4)", () => {
  it("claims a provider event once and treats a replay as a duplicate", async () => {
    const { executor } = fakeDb();
    const input = {
      provider: "razorpay",
      providerEventId: "evt_dedupe_qa",
      eventType: "payment.captured",
      paymentId: "pay_qa_1",
    };
    const first = await recordProviderEvent(input, executor);
    const second = await recordProviderEvent(input, executor);
    expect(first.isNew).toBe(true);
    expect(second.isNew).toBe(false);
  });

  it("the claim uses ON CONFLICT and the DB has a UNIQUE(provider, provider_event_id)", () => {
    expect(read("lib/payments/events.ts")).toMatch(
      /ON CONFLICT\s*\(provider,\s*provider_event_id\)\s*DO NOTHING/i
    );
    const m004 = read("db/migrations/004_payment_reconciliation.sql");
    expect(m004).toMatch(/CREATE TABLE IF NOT EXISTS payment_event/i);
    expect(m004).toMatch(/UNIQUE\s*\(\s*provider\s*,\s*provider_event_id\s*\)/i);
  });
});

describe("A01 — handler: provider truth, no order/charge creation, forward-only", () => {
  it("processes a genuine captured event and never inserts an order or charge", async () => {
    const body = rawEvent();
    const { executor, sqls } = fakeDb();
    const result = await handleRazorpayWebhook({
      rawBody: body,
      signature: sign(body),
      secret: SECRET,
      executor,
      providerVerify: providerVerify(),
      findTransaction,
    });
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({ received: true, derived_state: "paid" });
    const createsOrderOrCharge = sqls.filter((s) =>
      /\bINSERT\s+INTO\s+(?:"?order"?\b|orders\b|charge\b|charges\b|payment\b)/i.test(s)
    );
    expect(createsOrderOrCharge).toEqual([]);
    expect(sqls.some((s) => /INSERT INTO payment_event\b/i.test(s))).toBe(true);
  });

  it("fails closed on bad signature (401) and on unconfigured secret (503)", async () => {
    const body = rawEvent();
    const { executor } = fakeDb();
    const bad = await handleRazorpayWebhook({
      rawBody: body,
      signature: "b".repeat(64),
      secret: SECRET,
      executor,
      providerVerify: providerVerify(),
    });
    expect(bad.status).toBe(401);
    const unconfigured = await handleRazorpayWebhook({
      rawBody: body,
      signature: sign(body),
      secret: "",
      executor,
      providerVerify: providerVerify(),
    });
    expect(unconfigured.status).toBe(503);
    expect(unconfigured.body).toMatchObject({ code: "webhook_unconfigured" });
  });

  it("does not trust webhook-supplied amount (provider is the source of truth)", async () => {
    const body = rawEvent("payment.captured", { amount: 50000 });
    const { executor } = fakeDb();
    const result = await handleRazorpayWebhook({
      rawBody: body,
      signature: sign(body),
      secret: SECRET,
      executor,
      providerVerify: providerVerify({ amount: 99999 }),
      findTransaction,
    });
    expect(result.status).toBe(400);
    expect(String(result.body.code)).toContain("amount_mismatch");
    expect(eventAgreesWithProvider(parseRazorpayEvent(body) as any, {
      paymentId: "pay_qa_1",
      status: "captured",
      captured: true,
      refunded: false,
      amount: 99999,
    })).toEqual({ ok: false, reason: "amount_mismatch" });
  });

  it("returns 422 for a payment the provider does not know", async () => {
    const body = rawEvent();
    const { executor } = fakeDb();
    const result = await handleRazorpayWebhook({
      rawBody: body,
      signature: sign(body),
      secret: SECRET,
      executor,
      providerVerify: providerVerify({ providerStatus: "not_found", captured: false }),
      findTransaction,
    });
    expect(result.status).toBe(422);
    expect(result.body).toMatchObject({ code: "invalid_payment_reference" });
  });

  it("a stale signal (authorized after captured) cannot downgrade state", async () => {
    const captured = { paymentId: "pay_qa_1", status: "captured", captured: true, refunded: false };
    expect(isStalePaymentEvent("payment.authorized", captured)).toBe(true);
    expect(isStalePaymentEvent("payment.failed", captured)).toBe(true);
    expect(isStalePaymentEvent("payment.captured", captured)).toBe(false);

    const body = rawEvent("payment.authorized");
    const { executor } = fakeDb();
    const result = await handleRazorpayWebhook({
      rawBody: body,
      signature: sign(body),
      secret: SECRET,
      executor,
      providerVerify: providerVerify(),
      findTransaction,
    });
    expect(result.status).toBe(202);
    expect(result.body).toMatchObject({ ignored: true, reason: "stale_event" });
  });

  it("acknowledges unknown event types without a financial effect", async () => {
    const body = rawEvent("payment.authorized");
    const { executor, sqls } = fakeDb();
    // Force a provider state of 'authorized' so the event itself is not stale,
    // then confirm an unknown type is ignored (use a genuinely unknown type).
    const unknownBody = rawEvent("payment.foo_unknown");
    const result = await handleRazorpayWebhook({
      rawBody: unknownBody,
      signature: sign(unknownBody),
      secret: SECRET,
      executor,
      providerVerify: providerVerify(),
      findTransaction,
    });
    expect(SUPPORTED_EVENT_TYPES).toContain("payment.captured");
    expect(SUPPORTED_EVENT_TYPES).toContain("refund.processed");
    expect(result.status).toBe(202);
    expect(result.body).toMatchObject({ ignored: true, reason: "unknown_event_type" });
    expect(sqls.some((s) => /payment_reconciliation_issue/i.test(s))).toBe(false);
    void body;
  });
});
