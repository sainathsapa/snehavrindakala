/**
 * AGENT 01 — Razorpay webhook endpoint (CRITICAL gap closure).
 *
 * Tests the pure signature verifier and the dependency-injected webhook handler
 * directly (the Next route is a thin adapter over it). Every fixture is signed
 * over the EXACT bytes that are parsed, so a serializer key-order drift would
 * fail the HMAC. All state is an in-memory fake DB with the real UNIQUE/PK
 * conflict semantics; there is no live Razorpay, no network and no credentials.
 */

import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { verifyWebhookSignature, type DbExecutor } from "@/lib/payments/events";
import type { ProviderPaymentState, ProviderVerify } from "@/lib/payments/reconciliation";
import {
  findInternalTransaction,
  handleRazorpayWebhook,
  isSupportedEventType,
  parseRazorpayEvent,
  type HandleWebhookInput,
  type InternalTransaction,
  type WebhookResult,
} from "@/lib/payments/webhook";

const SECRET = "whsec_sandbox_test_only_not_a_real_secret";
const norm = (sql: string) => sql.replace(/\s+/g, " ").trim();

/* ── Signed fixtures ──────────────────────────────────────────────────────── */

type AnyEvent = Record<string, any>;

function paymentEntity(overrides: Record<string, any> = {}) {
  return {
    id: "pay_capture_1",
    entity: "payment",
    order_id: "order_store_1",
    status: "captured",
    amount: 50000,
    currency: "INR",
    ...overrides,
  };
}

function eventFixture(overrides: AnyEvent = {}): AnyEvent {
  const type = overrides.event ?? "payment.captured";
  const base: AnyEvent = {
    id: "evt_captured_1",
    entity: "event",
    event: type,
    created_at: 1_700_000_000,
    payload: { payment: { entity: paymentEntity() } },
  };
  if (type.startsWith("refund.")) {
    base.payload = {
      refund: {
        entity: {
          id: "rfnd_1",
          entity: "refund",
          status: type === "refund.failed" ? "failed" : "processed",
          amount: 50000,
          currency: "INR",
          payment_id: "pay_capture_1",
          order_id: "order_store_1",
        },
      },
    };
  }
  return {
    ...base,
    ...overrides,
    payload: overrides.payload ?? base.payload,
  };
}

function signed(event: AnyEvent, secret = SECRET): { raw: string; signature: string } {
  const raw = JSON.stringify(event);
  return {
    raw,
    signature: createHmac("sha256", secret).update(raw).digest("hex"),
  };
}

/** Authoritative provider answer; defaults to a captured payment. */
const capturedState = (paymentId: string): ProviderPaymentState => ({
  paymentId,
  status: "captured",
  captured: true,
  refunded: false,
  amount: 50000,
  currency: "INR",
  orderId: "order_store_1",
});

/* ── Fake DB: UNIQUE payment_event + deduped reconciliation issues ───────── */

interface EventRow {
  id: string;
  provider: string;
  providerEventId: string;
  eventType: string;
  status: string;
  attempts: number;
}

function makeDb(options: { failOnEventInsert?: boolean } = {}) {
  const events = new Map<string, EventRow>();
  const issues = new Map<string, { id: string; orderId: string; type: string }>();
  let seq = 0;
  let issueSeq = 0;
  const executed: Array<{ sql: string; params: any[] }> = [];

  const executor: DbExecutor = async (sql, params = []) => {
    executed.push({ sql: norm(sql), params });
    const s = norm(sql);

    if (s.startsWith("INSERT INTO payment_event")) {
      if (options.failOnEventInsert) throw new Error("simulated DB outage");
      const [provider, providerEventId, eventType, , , , status] = params;
      const key = `${provider}|${providerEventId}`;
      // Synchronous check+set (no await between) => atomic under Promise.all.
      if (events.has(key)) return []; // ON CONFLICT DO NOTHING
      const id = `evt_row_${++seq}`;
      events.set(key, {
        id,
        provider,
        providerEventId,
        eventType,
        status: status ?? "received",
        attempts: 0,
      });
      return [{ id }];
    }
    if (s.startsWith("SELECT id FROM payment_event")) {
      const [provider, providerEventId] = params;
      const row = events.get(`${provider}|${providerEventId}`);
      return row ? [{ id: row.id }] : [];
    }
    if (s.startsWith("SELECT status FROM payment_event")) {
      const [provider, providerEventId] = params;
      const row = events.get(`${provider}|${providerEventId}`);
      return row ? [{ status: row.status }] : [];
    }
    if (s.startsWith("UPDATE payment_event")) {
      const [id, status] = params;
      const row = [...events.values()].find((r) => r.id === id);
      if (row) {
        row.status = status;
        row.attempts += 1;
      }
      return [];
    }
    if (s.startsWith("SELECT id FROM payment_reconciliation_issue")) {
      const [orderId, type] = params;
      const found = [...issues.values()].find(
        (i) => i.orderId === orderId && i.type === type
      );
      return found ? [{ id: found.id }] : [];
    }
    if (s.startsWith("INSERT INTO payment_reconciliation_issue")) {
      const [orderId, , type] = params;
      const key = `${orderId}|${type}`;
      if (issues.has(key)) return [{ id: issues.get(key)!.id }];
      const id = `iss_${++issueSeq}`;
      issues.set(key, { id, orderId, type });
      return [{ id }];
    }
    if (s.startsWith("SELECT payment_id, order_id, razorpay_order_id")) {
      return [];
    }
    return [];
  };

  return {
    executor,
    events,
    issues,
    executed,
    issueCount: () => issues.size,
    eventCount: () => events.size,
    eventRow: (providerEventId: string) => events.get(`razorpay|${providerEventId}`),
  };
}

/* ── Handler harness ──────────────────────────────────────────────────────── */

interface Harness {
  db: ReturnType<typeof makeDb>;
  verify: ReturnType<typeof vi.fn<ProviderVerify>>;
  input: HandleWebhookInput;
  run: (overrides?: Partial<HandleWebhookInput>) => Promise<WebhookResult>;
  post: (event: AnyEvent, overrides?: Partial<HandleWebhookInput>) => Promise<WebhookResult>;
}

function harness(
  providerVerify: ProviderVerify = async (id) => capturedState(id),
  options: { failOnEventInsert?: boolean; transaction?: InternalTransaction | null } = {}
): Harness {
  const db = makeDb({ failOnEventInsert: options.failOnEventInsert });
  const verify = vi.fn<ProviderVerify>(providerVerify);
  const findTransaction = vi.fn(async () => options.transaction ?? null);
  const input: HandleWebhookInput = {
    rawBody: "",
    signature: "",
    secret: SECRET,
    executor: db.executor,
    providerVerify: verify,
    findTransaction,
  };
  const run = (overrides: Partial<HandleWebhookInput> = {}) =>
    handleRazorpayWebhook({ ...input, ...overrides });
  const post = (event: AnyEvent, overrides: Partial<HandleWebhookInput> = {}) => {
    const { raw, signature } = signed(event);
    return run({ rawBody: raw, signature, ...overrides });
  };
  return { db, verify, input, run, post };
}

/* ── 1. Pure signature verification (reused from events.ts) ───────────────── */

describe("signature verification (HMAC-SHA256, constant-time, fail-closed)", () => {
  const { raw } = signed(eventFixture());

  it("accepts an exact signed body (hex and sha256= prefix)", () => {
    const sig = createHmac("sha256", SECRET).update(raw).digest("hex");
    expect(verifyWebhookSignature(SECRET, raw, sig)).toBe(true);
    expect(verifyWebhookSignature(SECRET, raw, `sha256=${sig.toUpperCase()}`)).toBe(true);
  });

  it("rejects wrong secret, missing secret, missing header, malformed digest and tampered bytes", () => {
    const sig = createHmac("sha256", SECRET).update(raw).digest("hex");
    expect(verifyWebhookSignature("wrong-secret", raw, sig)).toBe(false);
    expect(verifyWebhookSignature(undefined, raw, sig)).toBe(false);
    expect(verifyWebhookSignature("   ", raw, sig)).toBe(false);
    expect(verifyWebhookSignature(SECRET, raw, undefined)).toBe(false);
    expect(verifyWebhookSignature(SECRET, raw, "not-a-digest")).toBe(false);
    expect(verifyWebhookSignature(SECRET, `${raw} `, sig)).toBe(false);
  });
});

/* ── 2. Valid / invalid / missing signature, missing secret ───────────────── */

describe("signature & configuration gates", () => {
  it("processes a validly signed event", async () => {
    const h = harness();
    const result = await h.post(eventFixture());
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({
      received: true,
      event_type: "payment.captured",
      order_id: "order_store_1",
      derived_state: "paid",
    });
    expect(h.verify).toHaveBeenCalledWith("pay_capture_1");
  });

  it("rejects an invalid signature with 401 and records nothing", async () => {
    const h = harness();
    const { raw } = signed(eventFixture());
    const result = await h.run({ rawBody: raw, signature: "a".repeat(64) });
    expect(result.status).toBe(401);
    expect(result.body.code).toBe("invalid_signature");
    expect(h.db.eventCount()).toBe(0);
    expect(h.db.issueCount()).toBe(0);
    expect(h.verify).not.toHaveBeenCalled();
  });

  it("rejects a missing signature with 401", async () => {
    const h = harness();
    const { raw } = signed(eventFixture());
    const result = await h.run({ rawBody: raw, signature: null });
    expect(result.status).toBe(401);
    expect(result.body.code).toBe("invalid_signature");
  });

  it("fails closed (503) when the webhook secret is not configured", async () => {
    const h = harness();
    const { raw, signature } = signed(eventFixture());
    const result = await h.run({ rawBody: raw, signature, secret: undefined });
    expect(result.status).toBe(503);
    expect(result.body.code).toBe("webhook_unconfigured");
    expect(h.db.eventCount()).toBe(0);
  });

  it("rejects malformed JSON / structurally invalid events with 400", async () => {
    const h = harness();
    const raw = "{not json";
    const signature = createHmac("sha256", SECRET).update(raw).digest("hex");
    expect((await h.run({ rawBody: raw, signature })).status).toBe(400);

    const missingId = signed({ event: "payment.captured", payload: {} });
    expect(
      (await h.run({ rawBody: missingId.raw, signature: missingId.signature })).status
    ).toBe(400);
  });
});

/* ── 3. Captured / failed / authorized never conflated ───────────────────── */

describe("event type handling", () => {
  it("captured: derived paid, one reconciliation issue, no order/charge effect here", async () => {
    const h = harness();
    const result = await h.post(eventFixture());
    expect(result.status).toBe(200);
    expect(result.derivedState).toBe("paid");
    expect(h.db.issueCount()).toBe(1);
    expect([...h.db.issues.values()][0]?.type).toBe("captured_unconfirmed");
  });

  it("failed: derived failed, never paid, no captured effect", async () => {
    const h = harness(async (id) => ({
      ...capturedState(id),
      status: "failed",
      captured: false,
    }));
    const result = await h.post(eventFixture({ event: "payment.failed" }));
    expect(result.status).toBe(200);
    expect(result.derivedState).toBe("failed");
    expect(result.body.derived_state).toBe("failed");
    expect(result.body.issue_type ?? null).toBeNull();
  });

  it("failed against a confirmed internal order opens failed_order_created", async () => {
    const transaction: InternalTransaction = {
      paymentId: "pay_capture_1",
      orderId: "order_store_1",
      amount: 50000,
      orderStatus: "confirmed",
      webhookRecorded: true,
    };
    const h = harness(
      async (id) => ({ ...capturedState(id), status: "failed", captured: false }),
      { transaction }
    );
    const result = await h.post(eventFixture({ event: "payment.failed" }));
    expect(result.status).toBe(200);
    expect(result.body.issue_type).toBe("failed_order_created");
  });

  it("authorized is never treated as captured", async () => {
    const h = harness(async (id) => ({
      ...capturedState(id),
      status: "authorized",
      captured: false,
    }));
    const result = await h.post(eventFixture({ event: "payment.authorized" }));
    expect(result.status).toBe(200);
    expect(result.derivedState).toBe("authorized");
    expect(result.body.derived_state).toBe("authorized");
  });

  it("order.paid extracts the payment from the order collection and reconciles as paid", async () => {
    const h = harness();
    const result = await h.post({
      id: "evt_order_paid",
      event: "order.paid",
      payload: {
        order: {
          entity: {
            id: "order_store_1",
            amount: 50000,
            currency: "INR",
            status: "paid",
            payments: {
              data: [{ entity: { id: "pay_capture_1", status: "captured" } }],
            },
          },
        },
      },
    });
    expect(result.status).toBe(200);
    expect(h.verify).toHaveBeenCalledWith("pay_capture_1");
    expect(result.derivedState).toBe("paid");
    expect(result.body.order_id).toBe("order_store_1");
  });

  it("refund events are recorded and correlated without mutating refund state", async () => {
    const h = harness();
    const result = await h.post(eventFixture({ event: "refund.processed" }));
    expect(result.status).toBe(200);
    expect(result.body.event_type).toBe("refund.processed");
    expect(result.body.refund_id).toBe("rfnd_1");
    expect(h.db.issueCount()).toBe(0);
  });

  it("unknown event types are acknowledged with 202 and ignored", async () => {
    const h = harness();
    const result = await h.post(eventFixture({ event: "payment.thing.happened" }));
    expect(result.status).toBe(202);
    expect(result.body).toMatchObject({ ignored: true, reason: "unknown_event_type" });
    expect(h.verify).not.toHaveBeenCalled();
    expect(h.db.issueCount()).toBe(0);
    expect(isSupportedEventType("payment.thing.happened")).toBe(false);
  });
});

/* ── 4. Dedupe, repeated delivery, concurrency ───────────────────────────── */

describe("durable dedupe & idempotency", () => {
  it("a duplicate event id is acknowledged as a no-op", async () => {
    const h = harness();
    const event = eventFixture();
    const first = await h.post(event);
    const duplicate = await h.post(event);
    expect(first.status).toBe(200);
    expect(duplicate.status).toBe(200);
    expect(duplicate.body.duplicate).toBe(true);
    expect(h.db.eventCount()).toBe(1);
    expect(h.db.issueCount()).toBe(1);
  });

  it("repeated delivery (5x) has exactly one effect", async () => {
    const h = harness();
    const event = eventFixture();
    const results: WebhookResult[] = [];
    for (let i = 0; i < 5; i++) results.push(await h.post(event));
    expect(results.filter((r) => r.body.duplicate).length).toBe(4);
    expect(h.db.eventCount()).toBe(1);
    expect(h.db.issueCount()).toBe(1);
    expect(h.verify).toHaveBeenCalledTimes(1);
  });

  it("a redelivery with a tampered payload still cannot create a second effect", async () => {
    const h = harness();
    await h.post(eventFixture());
    const tampered = eventFixture({
      payload: { payment: { entity: paymentEntity({ amount: 999999 }) } },
    });
    const result = await h.post(tampered);
    expect(result.status).toBe(200);
    expect(result.body.duplicate).toBe(true);
    expect(h.db.issueCount()).toBe(1);
  });

  it("concurrent duplicate deliveries produce one claim and one effect", async () => {
    const h = harness();
    const event = eventFixture({ id: "evt_concurrent" });
    const deliveries = Array.from({ length: 8 }, () => h.post(event));
    const results = await Promise.all(deliveries);
    expect(results.filter((r) => r.status === 200 && !r.body.duplicate).length).toBe(1);
    expect(h.db.eventCount()).toBe(1);
    expect(h.db.issueCount()).toBe(1);
    expect(h.verify).toHaveBeenCalledTimes(1);
  });
});

/* ── 5. Delayed / out-of-order / forward-only ────────────────────────────── */

describe("delayed & out-of-order events", () => {
  it("a delayed captured claim while the provider still says authorized never becomes paid", async () => {
    const h = harness(async (id) => ({
      ...capturedState(id),
      status: "authorized",
      captured: false,
    }));
    const result = await h.post(eventFixture());
    expect(result.status).toBe(200);
    expect(result.derivedState).toBe("authorized");
    expect(result.body.derived_state).not.toBe("paid");
    expect(result.body.issue_type).toBe("authorized_unconfirmed");
  });

  it("a captured event later reconciles forward to paid", async () => {
    let calls = 0;
    const h = harness(async (id) => {
      calls += 1;
      return calls === 1
        ? { ...capturedState(id), status: "authorized", captured: false }
        : capturedState(id);
    });
    const early = await h.post(eventFixture({ id: "evt_delayed_1" }));
    expect(early.derivedState).toBe("authorized");
    const later = await h.post(eventFixture({ id: "evt_delayed_2" }));
    expect(later.derivedState).toBe("paid");
    expect(h.db.issueCount()).toBe(2); // two issues for two distinct anomalies
  });

  it("a stale authorized event after a capture is ignored without downgrading", async () => {
    const h = harness();
    const captured = await h.post(eventFixture({ id: "evt_cap" }));
    expect(captured.derivedState).toBe("paid");
    const issuesBefore = h.db.issueCount();

    const stale = await h.post(
      eventFixture({
        id: "evt_stale_auth",
        event: "payment.authorized",
        payload: {
          payment: {
            entity: paymentEntity({ status: "authorized", captured: false }),
          },
        },
      })
    );
    expect(stale.status).toBe(202);
    expect(stale.body.reason).toBe("stale_event");
    expect(h.db.issueCount()).toBe(issuesBefore);
    expect(h.db.eventRow("evt_stale_auth")?.status).toBe("ignored");
  });
});

/* ── 6. Invalid payment reference & untrusted fields ─────────────────────── */

describe("untrusted payload fields", () => {
  it("a payment id unknown to the provider is rejected with 422", async () => {
    const h = harness(async (id) => ({
      paymentId: id,
      status: "not_found",
      captured: false,
      refunded: false,
    }));
    const result = await h.post(eventFixture());
    expect(result.status).toBe(422);
    expect(result.body.code).toBe("invalid_payment_reference");
    expect(h.db.issueCount()).toBe(0);
  });

  it("a webhook amount that disagrees with the provider is rejected (400)", async () => {
    const h = harness();
    const result = await h.post(
      eventFixture({
        id: "evt_bad_amount",
        payload: { payment: { entity: paymentEntity({ amount: 1 }) } },
      })
    );
    expect(result.status).toBe(400);
    expect(result.body.code).toBe("invalid_payload:amount_mismatch");
    expect(h.db.issueCount()).toBe(0);
  });

  it("a webhook order id that disagrees with the provider is rejected (400)", async () => {
    const h = harness();
    const result = await h.post(
      eventFixture({
        id: "evt_bad_order",
        payload: { payment: { entity: paymentEntity({ order_id: "order_attacker" }) } },
      })
    );
    expect(result.status).toBe(400);
    expect(result.body.code).toBe("invalid_payload:order_mismatch");
  });

  it("provider values, not webhook values, decide the internal order association", async () => {
    const transaction: InternalTransaction = {
      paymentId: "pay_capture_1",
      orderId: "order_from_internal_ledger",
      amount: 50000,
      orderStatus: "confirmed",
      webhookRecorded: true,
    };
    const h = harness(undefined, { transaction });
    const result = await h.post(eventFixture());
    expect(result.status).toBe(200);
    expect(result.body.order_id).toBe("order_from_internal_ledger");
    expect(h.db.issueCount()).toBe(0); // confirmed internal order, nothing to reconcile
  });
});

/* ── 7. DB / provider failures → 5xx so the provider retries ─────────────── */

describe("transient failures", () => {
  it("a DB failure while claiming the event returns 500", async () => {
    const h = harness(undefined, { failOnEventInsert: true });
    const result = await h.post(eventFixture());
    expect(result.status).toBe(500);
    expect(result.body.code).toBe("processing_error");
    expect(h.db.issueCount()).toBe(0);
  });

  it("a provider API failure returns 500 and is retriable", async () => {
    const h = harness(async () => {
      throw new Error("razorpay 503 upstream");
    });
    const result = await h.post(eventFixture());
    expect(result.status).toBe(500);
    expect(result.body.code).toBe("processing_error");
    expect(result.body.error).not.toMatch(/razorpay 503/); // sanitised
    expect(h.db.eventRow("evt_captured_1")?.status).toBe("failed");
  });

  it("a failed claim is replayed on redelivery (and effects stay idempotent)", async () => {
    const h = harness(async () => {
      throw new Error("temporary");
    });
    const event = eventFixture();
    expect((await h.post(event)).status).toBe(500);
    // Same event id, provider healthy now: the stored `failed` row is replayed.
    const healthy = harness();
    // Reuse the first harness' DB so the failed row is present.
    const replay = await handleRazorpayWebhook({
      rawBody: signed(event).raw,
      signature: signed(event).signature,
      secret: SECRET,
      executor: h.db.executor,
      providerVerify: async (id) => capturedState(id),
      findTransaction: async () => null,
    });
    expect(replay.status).toBe(200);
    expect(healthy.db.eventCount()).toBe(0); // separate db, only here for clarity
    expect(h.db.issueCount()).toBe(1);
  });
});

/* ── 8. Internal transaction lookup uses the existing claim table ────────── */

describe("internal transaction lookup", () => {
  it("finds a claimed payment by payment id", async () => {
    const executor: DbExecutor = async (sql, params = []) => {
      if (norm(sql).startsWith("SELECT payment_id, order_id, razorpay_order_id")) {
        return [
          {
            payment_id: params[0],
            order_id: "order_claimed",
            razorpay_order_id: params[1],
          },
        ];
      }
      return [];
    };
    const tx = await findInternalTransaction("pay_1", "order_1", executor);
    expect(tx).toMatchObject({
      paymentId: "pay_1",
      orderId: "order_claimed",
      orderStatus: "confirmed",
      webhookRecorded: true,
    });
  });

  it("returns null when the payment has not been claimed yet", async () => {
    const tx = await findInternalTransaction("pay_1", null, async () => []);
    expect(tx).toBeNull();
  });
});

/* ── 9. Route is a thin, secret-safe adapter ──────────────────────────────── */

describe("route wiring", () => {
  const src = readFileSync(
    join(__dirname, "..", "app/api/webhooks/razorpay/route.ts"),
    "utf8"
  );

  it("reads the raw body and verifies before parsing, via the shared helper", () => {
    expect(src).toMatch(/await req\.text\(\)/);
    expect(src).toMatch(/x-razorpay-signature/);
    expect(src).toMatch(/RAZORPAY_WEBHOOK_SECRET/);
    expect(src).toMatch(/handleRazorpayWebhook\(/);
    expect(src).not.toMatch(/req\.json\(\)/);
  });

  it("never logs the secret or the raw signature", () => {
    expect(src).not.toMatch(/console\.(log|error|warn)\([^\n]*(secret|signature|rawBody)/i);
  });

  it("does not contain a hand-rolled HMAC comparison", () => {
    expect(src).not.toMatch(/createHmac/);
    expect(src).not.toMatch(/timingSafeEqual/);
  });
});
