import { createHmac } from "crypto";
import {
  test,
  expect,
  type APIRequestContext,
  type APIResponse,
} from "@playwright/test";

/**
 * FINAL GO — Wave 6, Scenarios E, F and H (payments, refunds, finance).
 *
 * Scenario E: purchase -> refund request -> DUAL approval -> sandbox provider
 *   refund -> immutable ledger reversal -> notification (no real money/email).
 * Scenario F: commission policy -> earnings ledger -> settlement batch, all
 *   values supplied by sandbox config (no invented rate/payout terms).
 * Scenario H: failed / delayed / duplicate provider webhooks; assert exactly
 *   one order and one charge, with payment-event dedupe + reconciliation.
 *
 * ---------------------------------------------------------------------------
 * GATE HONESTY — READ BEFORE TRUSTING A RUN
 * ---------------------------------------------------------------------------
 * ALL tests here are SKIPPED unless `E2E_SANDBOX=1` AND the sandbox credentials
 * below are configured AND a running stack (Next + Medusa + Postgres + the
 * sandbox payment/fixture adapters) is reachable. No live charge, refund,
 * payout or email is ever performed: the fixture service owns all money-movement
 * simulation and uses the test verifier/refund adapter. Commission rates,
 * amounts, refund ids and lead-time are read from fixture output or env — never
 * fabricated. A SKIP is an honest "NOT VERIFIED", NEVER a pass. Do not delete
 * the gate to force green; supply the sandbox inputs instead.
 *
 * Required env (names only):
 *   E2E_SANDBOX=1, E2E_FIXTURES_URL, E2E_FIXTURES_TOKEN,
 *   E2E_ADMIN_REQUESTER_EMAIL / _PASSWORD,
 *   E2E_ADMIN_APPROVER_EMAIL / _PASSWORD,
 *   E2E_PARTNER_A_EMAIL / _PASSWORD, E2E_PARTNER_FINANCE_EMAIL / _PASSWORD,
 *   RAZORPAY_WEBHOOK_SECRET, CRON_SECRET  (values read locally, never logged).
 *
 * Endpoint contract:
 *   POST /api/admin/login                 -> svk_admin_session + medusa_auth_token
 *   POST /api/admin/refunds               -> dual-control decision
 *   POST /api/webhooks/razorpay           -> signed event (dedupe by provider_event_id)
 *   POST /api/cron/reconcile-payments     -> CRON_SECRET-guarded queue worker
 *   POST /api/store/checkout/complete     -> single-use payment claim
 *   GET  /api/partner/earnings            -> partner ledger statement
 * Settlement batches are read from the sandbox fixture service, not a partner
 * route, until the finance portal exposes a scoped settlements endpoint.
 * ---------------------------------------------------------------------------
 */

const SANDBOX = process.env.E2E_SANDBOX === "1";

const COMMON_ENV = ["E2E_FIXTURES_URL", "E2E_FIXTURES_TOKEN"] as const;
const ADMIN_ENV = [
  "E2E_ADMIN_REQUESTER_EMAIL", "E2E_ADMIN_REQUESTER_PASSWORD",
  "E2E_ADMIN_APPROVER_EMAIL", "E2E_ADMIN_APPROVER_PASSWORD",
] as const;
const PARTNER_ENV = ["E2E_PARTNER_A_EMAIL", "E2E_PARTNER_A_PASSWORD"] as const;
const FINANCE_ENV = ["E2E_PARTNER_FINANCE_EMAIL", "E2E_PARTNER_FINANCE_PASSWORD"] as const;
const WEBHOOK_ENV = ["RAZORPAY_WEBHOOK_SECRET", "CRON_SECRET"] as const;

function absent(names: readonly string[]): string[] {
  return names.filter((name) => {
    const value = process.env[name];
    return !value || value.trim() === "";
  });
}

function gateReason(missing: string[]): string {
  return [
    "Requires E2E_SANDBOX=1, sandbox credentials and a running stack",
    "(Next + Medusa + Postgres + sandbox payment/fixture adapters). No live money moves.",
    missing.length ? `Unconfigured env vars (names only): ${missing.join(", ")}.` : "",
    "SKIPPED = NOT VERIFIED, never a pass.",
  ]
    .filter(Boolean)
    .join(" ");
}

function ready(...groups: Array<readonly string[]>): boolean {
  return SANDBOX && groups.every((group) => absent(group).length === 0);
}

const REASON_E = gateReason(absent([...COMMON_ENV, ...ADMIN_ENV, ...PARTNER_ENV]));
const REASON_F = gateReason(absent([...COMMON_ENV, ...FINANCE_ENV]));
const REASON_H = gateReason(absent([...COMMON_ENV, ...WEBHOOK_ENV]));
const READY_E = ready(COMMON_ENV, ADMIN_ENV, PARTNER_ENV);
const READY_F = ready(COMMON_ENV, FINANCE_ENV);
const READY_H = ready(COMMON_ENV, WEBHOOK_ENV);

function env(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(`Missing required sandbox env var: ${name}`);
  }
  return value;
}

// ----- helpers ------------------------------------------------------------

async function fixture(
  request: APIRequestContext,
  method: "GET" | "POST",
  path: string,
  body?: unknown
): Promise<APIResponse> {
  const base = env("E2E_FIXTURES_URL").replace(/\/$/, "");
  return request.fetch(`${base}${path}`, {
    method,
    headers: {
      "x-fixture-token": env("E2E_FIXTURES_TOKEN"),
      ...(body !== undefined ? { "content-type": "application/json" } : {}),
    },
    data: body,
    failOnStatusCode: false,
  });
}

async function expectStatus(
  res: APIResponse,
  status: number,
  label: string
): Promise<void> {
  if (res.status() !== status) {
    const body = await res.text().catch(() => "");
    expect(res.status(), `${label} (body: ${body.slice(0, 500)})`).toBe(status);
  }
}

async function signInAdmin(
  request: APIRequestContext,
  emailVar: string,
  passwordVar: string
): Promise<string> {
  const res = await request.post("/api/admin/login", {
    data: { email: env(emailVar), password: env(passwordVar) },
    failOnStatusCode: false,
  });
  await expectStatus(res, 200, "admin login");
  // APIResponse has no cookies() method; read the jar of this test's request context.
  const cookies: Array<{ name: string; value: string }> = await request.cookies();
  const admin = cookies.find((c: { name: string; value: string }) => c.name === "svk_admin_session");
  const medusa = cookies.find((c: { name: string; value: string }) => c.name === "medusa_auth_token");
  expect(admin, "admin session cookie is set").toBeTruthy();
  const parts = [`svk_admin_session=${admin!.value}`];
  if (medusa) parts.push(`medusa_auth_token=${medusa.value}`);
  return parts.join("; ");
}

async function signInPartner(
  request: APIRequestContext,
  emailVar: string,
  passwordVar: string
): Promise<string> {
  const res = await request.post("/api/partner/auth/login", {
    data: { email: env(emailVar), password: env(passwordVar) },
    failOnStatusCode: false,
  });
  await expectStatus(res, 200, "partner login");
  // APIResponse has no cookies() method; read the jar of this test's request context.
  const cookies: Array<{ name: string; value: string }> = await request.cookies();
  const session = cookies.find((c: { name: string; value: string }) => c.name === "svk_partner_session");
  expect(session, "partner session cookie is set").toBeTruthy();
  return `svk_partner_session=${session!.value}`;
}

/** Razorpay-style HMAC over the exact raw body that is sent. */
function signWebhook(rawBody: string): string {
  return createHmac("sha256", env("RAZORPAY_WEBHOOK_SECRET"))
    .update(rawBody)
    .digest("hex");
}

async function postWebhook(
  request: APIRequestContext,
  event: Record<string, unknown>
): Promise<APIResponse> {
  // Send the EXACT bytes that were signed so the HMAC cannot drift with
  // serializer key ordering.
  const raw = JSON.stringify(event);
  return request.post("/api/webhooks/razorpay", {
    data: raw,
    headers: {
      "content-type": "application/json",
      "x-razorpay-signature": signWebhook(raw),
    },
    failOnStatusCode: false,
  });
}

// ----- Scenario E ---------------------------------------------------------

test.describe("Scenario E — refund request, dual approval, reversal, notification", () => {
  test.skip(!READY_E, REASON_E);

  test("dual approval drives a sandbox refund and an immutable ledger reversal", async ({
    request,
  }) => {
    // 1. Sandbox fixture: paid order + refund request + original earning entry.
    const seeded = await fixture(request, "POST", "/refunds/requests", {
      payment_mode: "sandbox",
      amount_source: "fixture", // amount comes from config, not a hardcoded number
    });
    await expectStatus(seeded, 201, "seed refund request");
    const refund = await seeded.json();
    expect(refund.refund_id).toBeTruthy();
    expect(refund.order_id).toBeTruthy();
    expect(refund.earning_entry_id).toBeTruthy();

    const requester = await signInAdmin(
      request,
      "E2E_ADMIN_REQUESTER_EMAIL",
      "E2E_ADMIN_REQUESTER_PASSWORD"
    );
    const approver = await signInAdmin(
      request,
      "E2E_ADMIN_APPROVER_EMAIL",
      "E2E_ADMIN_APPROVER_PASSWORD"
    );

    // 2. Dual control: the requester may NOT approve their own request.
    const selfApprove = await request.post("/api/admin/refunds", {
      headers: { Cookie: requester, "content-type": "application/json" },
      data: { refund_id: refund.refund_id, decision: "approve", note: "self" },
      failOnStatusCode: false,
    });
    expect([401, 403], "requester cannot self-approve").toContain(selfApprove.status());

    // 3. A distinct approver approves.
    const approved = await request.post("/api/admin/refunds", {
      headers: { Cookie: approver, "content-type": "application/json" },
      data: { refund_id: refund.refund_id, decision: "approve", note: "sandbox E2E" },
      failOnStatusCode: false,
    });
    await expectStatus(approved, 200, "distinct admin approves refund");

    // 4. Sandbox provider execution — no live money; adapter reports provider id.
    const executed = await fixture(
      request,
      "POST",
      `/refunds/${encodeURIComponent(refund.refund_id)}/execute`
    );
    await expectStatus(executed, 200, "sandbox provider refund execution");
    const execution = await executed.json();
    expect(execution.status).toBe("provider_confirmed");
    expect(execution.provider_refund_id, "sandbox provider refund id").toBeTruthy();
    expect(execution.requested_by).not.toBe(execution.approved_by);
    expect(execution.idempotency_key).toBeTruthy();

    // 5. Immutable reversal: a NEW ledger row, linked to the original earning.
    const ledger = await fixture(
      request,
      "GET",
      `/ledger/${encodeURIComponent(refund.order_id)}`
    );
    await expectStatus(ledger, 200, "read earnings ledger");
    const entries = (await ledger.json()).entries ?? [];
    const reversal = entries.find(
      (entry: any) =>
        entry.entry_type === "refund_reversal" &&
        entry.reverses_entry_id === refund.earning_entry_id
    );
    expect(reversal, "refund_reversal links to the original earning").toBeTruthy();
    expect(reversal.idempotency_key).toBeTruthy();

    // 6. Notification exists and is deduped by event_key — still no email sent.
    const note = await fixture(
      request,
      "GET",
      `/notifications?event_key=${encodeURIComponent(refund.refund_id + ":refund")}`
    );
    await expectStatus(note, 200, "refund notification is recorded");
    expect((await note.json()).count).toBeGreaterThanOrEqual(1);

    // Replaying the same execution idempotency key must not move money twice.
    const replay = await fixture(
      request,
      "POST",
      `/refunds/${encodeURIComponent(refund.refund_id)}/execute`
    );
    expect(replay.status(), "duplicate execution is a no-op").toBe(200);
    expect((await replay.json()).id).toBe(execution.id);
  });
});

// ----- Scenario F ---------------------------------------------------------

test.describe("Scenario F — earnings ledger and settlement batch", () => {
  test.skip(!READY_F, REASON_F);

  test("approved policy yields one ledger entry and one settlement line", async ({
    request,
  }) => {
    // Fixture uses the owner-approved policy in config; no rate is invented.
    const seeded = await fixture(request, "POST", "/finance/delivered-order", {
      payment_mode: "sandbox",
      policy_source: "approved_config",
    });
    await expectStatus(seeded, 201, "seed delivered order with approved policy");
    const data = await seeded.json();
    expect(data.order_id).toBeTruthy();
    expect(data.commission_policy_id, "an approved policy id is required").toBeTruthy();
    expect(data.expected_earning?.payable_amount).toBeDefined();

    const cookie = await signInPartner(
      request,
      "E2E_PARTNER_FINANCE_EMAIL",
      "E2E_PARTNER_FINANCE_PASSWORD"
    );
    const earnings = await request.get("/api/partner/earnings", {
      headers: { Cookie: cookie },
      failOnStatusCode: false,
    });
    await expectStatus(earnings, 200, "finance reads earnings");
    const entries = (await earnings.json()).entries ?? [];
    const credit = entries.find(
      (entry: any) => entry.order_id === data.order_id && entry.entry_type === "earning"
    );
    expect(credit, "one earning entry for the order").toBeTruthy();
    // Compare against fixture-computed values, never a hardcoded commission.
    expect(credit.payable_amount).toBe(data.expected_earning.payable_amount);
    expect(credit.commission_amount).toBe(data.expected_earning.commission_amount);
    expect(credit.commission_policy_id).toBe(data.commission_policy_id);

    const batchSeed = await fixture(request, "POST", "/finance/settlement-batches", {
      order_id: data.order_id,
    });
    await expectStatus(batchSeed, 201, "calculate settlement batch");
    const batch = await batchSeed.json();
    expect(batch.id, "settlement batch id").toBeTruthy();

    // Read the batch back from the sandbox finance fixture (there is no
    // partner settlements route yet). It must reconcile to the ledger rows.
    const batchRead = await fixture(
      request,
      "GET",
      `/finance/settlement-batches/${encodeURIComponent(batch.id)}`
    );
    await expectStatus(batchRead, 200, "read settlement batch from fixture");
    const found = await batchRead.json();
    expect(found.id).toBe(batch.id);
    expect(found.line_count).toBeGreaterThanOrEqual(1);
    expect(Number(found.total_amount)).toBe(Number(batch.total_amount));
    expect(found.lines ?? []).toEqual(
      expect.arrayContaining([expect.objectContaining({ ledger_entry_id: credit.id })])
    );
  });
});

// ----- Scenario H ---------------------------------------------------------

test.describe("Scenario H — webhook failure, delay and duplicate handling", () => {
  test.skip(!READY_H, REASON_H);

  test("a duplicated webhook creates exactly one order and one charge", async ({ request }) => {
    const intentSeed = await fixture(request, "POST", "/payments/sandbox-intent", {
      payment_mode: "sandbox",
    });
    await expectStatus(intentSeed, 201, "seed sandbox payment intent");
    const intent = await intentSeed.json();
    const eventId = "evt_duplicate_E2E";

    const event = {
      id: eventId,
      event: "payment.captured",
      payload: {
        payment: {
          entity: {
            id: intent.payment_id,
            order_id: intent.razorpay_order_id,
            status: "captured",
            amount: intent.amount,
          },
        },
      },
    };

    const first = await postWebhook(request, event);
    expect([200, 201], "first webhook is accepted").toContain(first.status());
    const firstBody = await first.json();
    expect(firstBody.order_id ?? intent.expected_order_id).toBeTruthy();

    // Identical provider_event_id redelivered: must be a dedupe no-op.
    const second = await postWebhook(request, event);
    expect([200, 201, 202], "duplicate webhook is acknowledged").toContain(second.status());
    const secondBody = await second.json();
    expect(secondBody, "duplicate is reported, never a second order").toBeTruthy();

    const eventRows = await fixture(
      request,
      "GET",
      `/payments/events/${encodeURIComponent(eventId)}`
    );
    await expectStatus(eventRows, 200, "read payment_event dedupe record");
    expect((await eventRows.json()).count, "event recorded exactly once").toBe(1);

    const orders = await fixture(
      request,
      "GET",
      `/orders/by-payment/${encodeURIComponent(intent.payment_id)}`
    );
    await expectStatus(orders, 200, "read orders for payment");
    expect((await orders.json()).count, "one order for the payment").toBe(1);

    const charges = await fixture(
      request,
      "GET",
      `/payments/${encodeURIComponent(intent.payment_id)}/charges`
    );
    await expectStatus(charges, 200, "read provider charges");
    expect((await charges.json()).count, "one charge for the payment").toBe(1);
  });

  test("a failed webhook creates no order but opens a reconciliation issue", async ({ request }) => {
    const intentSeed = await fixture(request, "POST", "/payments/sandbox-intent", {
      payment_mode: "sandbox",
      outcome: "failed",
    });
    await expectStatus(intentSeed, 201, "seed failing sandbox intent");
    const intent = await intentSeed.json();

    const failed = await postWebhook(request, {
      id: "evt_failed_E2E",
      event: "payment.failed",
      payload: {
        payment: {
          entity: {
            id: intent.payment_id,
            order_id: intent.razorpay_order_id,
            status: "failed",
            amount: intent.amount,
          },
        },
      },
    });
    expect([200, 201, 202], "failed webhook is acknowledged").toContain(failed.status());

    const orders = await fixture(
      request,
      "GET",
      `/orders/by-payment/${encodeURIComponent(intent.payment_id)}`
    );
    await expectStatus(orders, 200, "read orders for failed payment");
    expect((await orders.json()).count, "no order from a failed payment").toBe(0);

    const issues = await fixture(
      request,
      "GET",
      `/reconciliation?order_id=${encodeURIComponent(intent.expected_order_id)}`
    );
    await expectStatus(issues, 200, "read reconciliation queue");
    expect((await issues.json()).count).toBeGreaterThanOrEqual(1);
  });

  test("a delayed/missed webhook is recovered by the guarded reconciler without duplication", async ({
    request,
  }) => {
    const intentSeed = await fixture(request, "POST", "/payments/sandbox-intent", {
      payment_mode: "sandbox",
      outcome: "captured_no_webhook",
    });
    await expectStatus(intentSeed, 201, "seed captured payment with no webhook");
    const intent = await intentSeed.json();

    const run = await request.post("/api/cron/reconcile-payments", {
      headers: { Authorization: `Bearer ${env("CRON_SECRET")}` },
      failOnStatusCode: false,
    });
    await expectStatus(run, 200, "CRON_SECRET-guarded reconciliation run");
    const result = await run.json();
    // The adapter must self-identify so a simulated run can never be mistaken
    // for a live provider run (route returns `providerMode`).
    expect(result.providerMode, "adapter must self-identify").toBeTruthy();
    expect(result.providerMode, "no live provider in sandbox E2E").not.toBe("live");

    const orders = await fixture(
      request,
      "GET",
      `/orders/by-payment/${encodeURIComponent(intent.payment_id)}`
    );
    await expectStatus(orders, 200, "read orders after reconciliation");
    expect((await orders.json()).count, "reconciliation creates one order").toBe(1);

    const charges = await fixture(
      request,
      "GET",
      `/payments/${encodeURIComponent(intent.payment_id)}/charges`
    );
    await expectStatus(charges, 200, "read charges after reconciliation");
    expect((await charges.json()).count, "no duplicate charge").toBe(1);
  });

  test("replaying checkout completion uses the single-use payment claim", async ({ request }) => {
    const intentSeed = await fixture(request, "POST", "/payments/sandbox-intent", {
      payment_mode: "sandbox",
    });
    await expectStatus(intentSeed, 201, "seed completable sandbox intent");
    const intent = await intentSeed.json();

    const payload = {
      cart_id: intent.cart_id,
      razorpay_order_id: intent.razorpay_order_id,
      razorpay_payment_id: intent.payment_id,
      razorpay_signature: intent.signature, // produced by the fixture, not fabricated
    };

    const first = await request.post("/api/store/checkout/complete", {
      data: payload,
      failOnStatusCode: false,
    });
    await expectStatus(first, 200, "first checkout completion");

    const replay = await request.post("/api/store/checkout/complete", {
      data: payload,
      failOnStatusCode: false,
    });
    expect(replay.status(), "replay is refused by the payment claim").toBe(409);
    expect((await replay.json()).code).toBe("payment_already_used");

    const orders = await fixture(
      request,
      "GET",
      `/orders/by-payment/${encodeURIComponent(intent.payment_id)}`
    );
    expect((await orders.json()).count, "one order from two completions").toBe(1);
  });
});
