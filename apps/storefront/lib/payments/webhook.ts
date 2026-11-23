/**
 * Razorpay webhook intake — signature → parse → claim → provider-truth reconcile.
 *
 * This module is the pure, dependency-injected core behind
 * `POST /api/webhooks/razorpay`. It deliberately reuses the existing payment
 * architecture rather than growing a parallel one:
 *
 * - `verifyWebhookSignature` (events.ts) is the ONLY signature check. It is
 *   HMAC-SHA256 over the exact raw bytes, constant-time, and fails closed when
 *   RAZORPAY_WEBHOOK_SECRET is unset.
 * - `recordProviderEvent` (events.ts) is the dedupe boundary: the UNIQUE
 *   (provider, provider_event_id) claim decides who got there first, so two
 *   concurrent deliveries can never both produce a financial effect.
 * - `deriveOrderState` / `classifyMismatch` / `openIssueForMismatch`
 *   (reconciliation.ts) are the money-safety logic. The provider fetch is the
 *   only source of truth; fields asserted by the webhook (amount, order id,
 *   status) are treated as untrusted until they agree with it.
 *
 * The webhook never marks an order paid and never creates an order or a charge.
 * That stays with the verified checkout path and the guarded reconciler. This
 * intake records durable history, opens/closes reconciliation issues, and gives
 * the caller an HTTP status that makes a provider retry only on transient
 * failures.
 */

import {
  recordProviderEvent,
  verifyWebhookSignature,
  type DbExecutor,
  type ProviderEventInput,
} from "./events";
import {
  classifyMismatch,
  deriveOrderState,
  openIssueForMismatch,
  type DerivedOrderState,
  type ProviderPaymentState,
  type ProviderVerify,
  type ReconciliationIssueType,
} from "./reconciliation";

export type { DbExecutor };

const PROVIDER = "razorpay";
const SIGNATURE_HEADER = "x-razorpay-signature";

/** Event types this integration understands. Anything else is acknowledged and ignored. */
export const SUPPORTED_EVENT_TYPES = [
  "payment.authorized",
  "payment.captured",
  "payment.failed",
  "order.paid",
  "refund.created",
  "refund.updated",
  "refund.processed",
  "refund.failed",
] as const;

export type SupportedEventType = (typeof SUPPORTED_EVENT_TYPES)[number];

const SUPPORTED = new Set<string>(SUPPORTED_EVENT_TYPES);

export function isSupportedEventType(value: unknown): value is SupportedEventType {
  return typeof value === "string" && SUPPORTED.has(value);
}

/* ── Parsing / payload validation ─────────────────────────────────────────── */

export interface ParsedProviderEvent {
  providerEventId: string;
  eventType: string;
  paymentId: string | null;
  providerOrderId: string | null;
  /** Amount asserted by the webhook (paise). Untrusted until checked with provider. */
  amount: number | null;
  currency: string | null;
  /** Status asserted by the webhook. Never used as evidence of capture. */
  claimedStatus: string | null;
  refundId: string | null;
  raw: unknown;
}

export type ParseResult =
  | { ok: true; event: ParsedProviderEvent }
  | { ok: false; reason: string };

function asRecord(value: unknown): Record<string, any> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, any>)
    : null;
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function numericAmount(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return null;
}

function paymentIdFromOrderEntity(order: Record<string, any>): string | null {
  // `order.paid` has no top-level payment entity in every Razorpay payload;
  // fall back to the first payment in the order's payments collection.
  const payments = asRecord(order.payments);
  const data = Array.isArray(payments?.data) ? payments!.data : [];
  for (const entry of data) {
    const entity = asRecord(asRecord(entry)?.entity) ?? asRecord(entry);
    const id = nonEmptyString(entity?.id);
    if (id) return id;
  }
  return null;
}

/**
 * Parse and structurally validate a Razorpay event. This is pure and never
 * throws: malformed or incomplete events return `ok:false` with a reason code.
 */
export function parseRazorpayEvent(rawBody: string | Buffer): ParseResult {
  let text: string;
  try {
    text = typeof rawBody === "string" ? rawBody : rawBody.toString("utf8");
  } catch {
    return { ok: false, reason: "unreadable_body" };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, reason: "invalid_json" };
  }

  const root = asRecord(parsed);
  if (!root) return { ok: false, reason: "invalid_event" };

  const providerEventId = nonEmptyString(root.id);
  const eventType = nonEmptyString(root.event);
  const payload = asRecord(root.payload);
  if (!providerEventId || !eventType || !payload) {
    return { ok: false, reason: "missing_required_fields" };
  }

  const paymentEntity = asRecord(asRecord(payload.payment)?.entity);
  const refundEntity = asRecord(asRecord(payload.refund)?.entity);
  const orderEntity = asRecord(asRecord(payload.order)?.entity);

  let paymentId = nonEmptyString(paymentEntity?.id);
  let providerOrderId = nonEmptyString(paymentEntity?.order_id);
  let amount = numericAmount(paymentEntity?.amount);
  let currency = nonEmptyString(paymentEntity?.currency);
  let claimedStatus = nonEmptyString(paymentEntity?.status);
  let refundId = nonEmptyString(refundEntity?.id);

  if (orderEntity) {
    providerOrderId = providerOrderId ?? nonEmptyString(orderEntity.id);
    amount = amount ?? numericAmount(orderEntity.amount);
    currency = currency ?? nonEmptyString(orderEntity.currency);
    claimedStatus = claimedStatus ?? nonEmptyString(orderEntity.status);
    paymentId = paymentId ?? paymentIdFromOrderEntity(orderEntity);
  }

  if (refundEntity) {
    paymentId = paymentId ?? nonEmptyString(refundEntity.payment_id);
    providerOrderId = providerOrderId ?? nonEmptyString(refundEntity.order_id);
    amount = amount ?? numericAmount(refundEntity.amount);
    currency = currency ?? nonEmptyString(refundEntity.currency);
    claimedStatus = claimedStatus ?? nonEmptyString(refundEntity.status);
  }

  // A refund event always carries a refund id; payment/order events must carry
  // a payment id so the provider can be asked directly.
  if (eventType.startsWith("refund.")) {
    if (!refundId) return { ok: false, reason: "missing_refund_reference" };
  } else if (!paymentId) {
    return { ok: false, reason: "missing_payment_reference" };
  }

  return {
    ok: true,
    event: {
      providerEventId,
      eventType,
      paymentId,
      providerOrderId,
      amount,
      currency,
      claimedStatus,
      refundId,
      raw: parsed,
    },
  };
}

/* ── Provider-truth checks ────────────────────────────────────────────────── */

/**
 * Fields asserted by the webhook are cross-checked against the provider's own
 * fetched payment. We never replace provider values with webhook values — the
 * webhook is only a signal to go and look.
 */
export function eventAgreesWithProvider(
  event: ParsedProviderEvent,
  providerState: ProviderPaymentState
): { ok: true } | { ok: false; reason: "amount_mismatch" | "order_mismatch" } {
  if (
    event.amount !== null &&
    typeof providerState.amount === "number" &&
    Number.isFinite(providerState.amount) &&
    event.amount !== providerState.amount
  ) {
    return { ok: false, reason: "amount_mismatch" };
  }
  if (
    event.providerOrderId &&
    providerState.orderId &&
    event.providerOrderId !== providerState.orderId
  ) {
    return { ok: false, reason: "order_mismatch" };
  }
  return { ok: true };
}

/** Rank used only for forward-only guards on payment/order events. */
function paymentEventRank(eventType: string): number | null {
  switch (eventType) {
    case "payment.failed":
      return 0;
    case "payment.authorized":
      return 1;
    case "payment.captured":
    case "order.paid":
      return 2;
    default:
      return null; // refund events live on a different axis
  }
}

function providerRank(state: ProviderPaymentState): number {
  switch (deriveOrderState(state)) {
    case "failed":
      return 0;
    case "authorized":
    case "pending":
      return 1;
    case "paid":
      return 2;
    case "refunded":
      return 3;
  }
}

/** A stale event (e.g. authorized arriving after captured) must not move state back. */
export function isStalePaymentEvent(
  eventType: string,
  providerState: ProviderPaymentState
): boolean {
  const rank = paymentEventRank(eventType);
  return rank !== null && rank < providerRank(providerState);
}

/* ── Internal transaction lookup ──────────────────────────────────────────── */

export interface InternalTransaction {
  paymentId: string;
  orderId: string;
  amount: number | null;
  currency?: string | null;
  /** `confirmed` when an internal order already exists, otherwise `pending`. */
  orderStatus: string;
  webhookRecorded?: boolean;
}

export type TransactionLookup = (
  paymentId: string,
  providerOrderId: string | null
) => Promise<InternalTransaction | null>;

/**
 * Real lookup against the single-use payment claim. Kept here (rather than in
 * the route) so the exact same query can be exercised with a fake executor.
 * A webhook may legitimately arrive before checkout completes, in which case
 * there is no claim row yet and null is returned — the handler still reconciles
 * from provider truth and opens a `captured_unconfirmed` issue.
 */
export async function findInternalTransaction(
  paymentId: string,
  providerOrderId: string | null,
  executor: DbExecutor
): Promise<InternalTransaction | null> {
  const rows = await executor(
    `SELECT payment_id, order_id, razorpay_order_id
       FROM processed_payments
      WHERE payment_id = $1 OR ($2::text IS NOT NULL AND razorpay_order_id = $2)
      LIMIT 1`,
    [paymentId, providerOrderId]
  );
  if (!rows.length) return null;
  const row = rows[0];
  const orderId = nonEmptyString(row.order_id);
  return {
    paymentId: nonEmptyString(row.payment_id) ?? paymentId,
    orderId: orderId ?? providerOrderId ?? `unlinked:${paymentId}`,
    amount: numericAmount(row.amount) ?? null,
    currency: nonEmptyString(row.currency) ?? null,
    orderStatus: orderId ? "confirmed" : "pending",
    webhookRecorded: true,
  };
}

/* ── Handler ──────────────────────────────────────────────────────────────── */

export interface HandleWebhookInput {
  rawBody: string | Buffer;
  signature: string | undefined | null;
  secret: string | undefined | null;
  executor: DbExecutor;
  providerVerify: ProviderVerify;
  findTransaction?: TransactionLookup;
  now?: () => Date;
}

export interface WebhookResult {
  status: number;
  body: Record<string, unknown>;
  eventId?: string;
  eventType?: string;
  issueId?: string | null;
  derivedState?: DerivedOrderState;
}

const ok = (body: Record<string, unknown>, extra: Partial<WebhookResult> = {}): WebhookResult => ({
  status: 200,
  body,
  ...extra,
});

function fail(status: number, error: string, code: string): WebhookResult {
  // `error` is always a fixed, non-secret sentence chosen by this module.
  return { status, body: { error, code } };
}

async function markEvent(
  eventId: string,
  status: "processed" | "ignored" | "failed",
  lastError: string | null,
  executor: DbExecutor
): Promise<void> {
  await executor(
    `UPDATE payment_event
        SET status = $2,
            last_error = $3,
            processed_at = CASE WHEN $2 IN ('processed','ignored') THEN now() ELSE NULL END,
            attempts = attempts + 1
      WHERE id = $1`,
    [eventId, status, lastError]
  );
}

async function eventStatus(
  providerEventId: string,
  executor: DbExecutor
): Promise<string | null> {
  const rows = await executor(
    `SELECT status FROM payment_event
      WHERE provider = $1 AND provider_event_id = $2 LIMIT 1`,
    [PROVIDER, providerEventId]
  );
  return nonEmptyString(rows[0]?.status);
}

/**
 * Verify, dedupe and process one webhook delivery. Every branch returns an
 * explicit HTTP status so the route stays a thin adapter:
 *   503 unconfigured · 401 bad/missing signature · 400 bad payload ·
 *   422 unknown payment reference · 202 acknowledged-no-effect ·
 *   200 processed/idempotent duplicate · 500 transient failure (retry).
 */
export async function handleRazorpayWebhook(
  input: HandleWebhookInput
): Promise<WebhookResult> {
  const {
    rawBody,
    signature,
    secret,
    executor,
    providerVerify,
    findTransaction,
  } = input;

  // 1. Fail closed before touching the body: no secret means no trusted traffic.
  if (!secret || !secret.trim()) {
    return fail(503, "Razorpay webhook is not configured.", "webhook_unconfigured");
  }

  // 2. Verify the HMAC over the EXACT bytes. Never log the signature or secret.
  if (!verifyWebhookSignature(secret, rawBody, signature)) {
    return fail(401, "Invalid webhook signature.", "invalid_signature");
  }

  // 3. Parse and structurally validate.
  const parsed = parseRazorpayEvent(rawBody);
  if (!parsed.ok) {
    return fail(400, "Malformed provider event.", `invalid_payload:${parsed.reason}`);
  }
  const event = parsed.event;

  let claim: { isNew: boolean; eventId: string } | null = null;
  try {
    const providerEventInput: ProviderEventInput = {
      provider: PROVIDER,
      providerEventId: event.providerEventId,
      eventType: event.eventType,
      orderId: event.providerOrderId,
      paymentId: event.paymentId,
      payload: event.raw,
      status: "received",
    };
    claim = await recordProviderEvent(providerEventInput, executor);

    // A delivery we already claimed is a duplicate no-op, EXCEPT a prior
    // `failed` claim, which is replayed so a transient outage can recover.
    // Side effects here are idempotent (issues are deduped, no order is made),
    // so a replay cannot create a second financial effect.
    if (!claim.isNew) {
      const prior = await eventStatus(event.providerEventId, executor);
      if (prior !== "failed") {
        return ok(
          {
            received: true,
            duplicate: true,
            event_id: event.providerEventId,
            event_type: event.eventType,
            order_id: event.providerOrderId,
          },
          { eventId: claim.eventId, eventType: event.eventType }
        );
      }
    }

    // 4. Unknown event type: acknowledge durably, no effect.
    if (!isSupportedEventType(event.eventType)) {
      await markEvent(claim.eventId, "ignored", "unknown_event_type", executor);
      return {
        status: 202,
        body: { received: true, ignored: true, reason: "unknown_event_type" },
        eventId: claim.eventId,
        eventType: event.eventType,
      };
    }

    // 5. Provider is the only source of truth: fetch before deciding anything.
    const paymentId = event.paymentId as string;
    const providerState = await providerVerify(paymentId);

    // 6. A payment the provider does not know is an invalid reference.
    const status = (providerState.status || "").trim().toLowerCase();
    if (status === "not_found" || status === "unknown") {
      await markEvent(claim.eventId, "ignored", "invalid_payment_reference", executor);
      return {
        status: 422,
        body: {
          error: "Payment reference is not known to the provider.",
          code: "invalid_payment_reference",
        },
        eventId: claim.eventId,
        eventType: event.eventType,
      };
    }

    // 7. Never trust webhook-supplied amount / order association.
    const agreement = eventAgreesWithProvider(event, providerState);
    if (!agreement.ok) {
      await markEvent(claim.eventId, "ignored", agreement.reason, executor);
      return fail(
        400,
        "Provider event fields disagree with the provider's payment record.",
        `invalid_payload:${agreement.reason}`
      );
    }

    // 8. Refund events are recorded as durable history and correlated by ids.
    //    State transitions on refund_execution belong to the refund module;
    //    this intake never mutates it (no duplicate refund effects).
    if (event.eventType.startsWith("refund.")) {
      await markEvent(claim.eventId, "processed", null, executor);
      return ok(
        {
          received: true,
          event_id: event.providerEventId,
          event_type: event.eventType,
          order_id: providerState.orderId ?? event.providerOrderId,
          payment_id: paymentId,
          refund_id: event.refundId,
        },
        {
          eventId: claim.eventId,
          eventType: event.eventType,
          derivedState: deriveOrderState(providerState),
        }
      );
    }

    // 9. Forward-only: a stale signal (authorized after captured, failed after
    //    captured) cannot downgrade state or open a contradictory issue.
    if (isStalePaymentEvent(event.eventType, providerState)) {
      await markEvent(claim.eventId, "ignored", "stale_event", executor);
      return {
        status: 202,
        body: { received: true, ignored: true, reason: "stale_event" },
        eventId: claim.eventId,
        eventType: event.eventType,
      };
    }

    // 10. Authorized is NEVER captured. classifyMismatch/deriveOrderState decide
    //     from provider truth; an authorized payment stays `authorized`.
    const lookup = findTransaction ?? (async () => null);
    const transaction = await lookup(paymentId, providerState.orderId ?? event.providerOrderId);
    const amount =
      transaction?.amount ?? providerState.amount ?? event.amount ?? 0;
    const currency =
      transaction?.currency ?? providerState.currency ?? event.currency ?? undefined;
    const localPayment = {
      id: paymentId,
      amount,
      currency,
      status: transaction?.orderStatus ?? undefined,
      webhookRecorded: transaction?.webhookRecorded ?? true,
    };
    const localOrder = {
      id: transaction?.orderId ?? event.providerOrderId ?? `unlinked:${paymentId}`,
      amount,
      currency,
      status: transaction?.orderStatus ?? "pending",
    };

    const issueType: ReconciliationIssueType | null = classifyMismatch(
      providerState,
      localPayment,
      localOrder
    );
    let issueId: string | null = null;
    if (issueType) {
      const opened = await openIssueForMismatch(
        {
          orderId: localOrder.id,
          paymentId,
          issueType,
          detail: `webhook=${event.eventType}; provider=${providerState.status}`,
        },
        executor
      );
      issueId = opened.issueId;
    }

    const derivedState = deriveOrderState(providerState);
    await markEvent(claim.eventId, "processed", null, executor);
    return ok(
      {
        received: true,
        event_id: event.providerEventId,
        event_type: event.eventType,
        order_id: localOrder.id,
        payment_id: paymentId,
        derived_state: derivedState,
        issue_type: issueType,
        issue_id: issueId,
      },
      { eventId: claim.eventId, eventType: event.eventType, issueId, derivedState }
    );
  } catch (error) {
    // Transient DB or provider failure → 5xx so the provider retries. The
    // message is sanitised: no secret, no signature, no provider payload.
    if (claim) {
      try {
        await markEvent(claim.eventId, "failed", "processing_error", executor);
      } catch {
        // A secondary failure must not mask the 500 already being returned.
      }
    }
    return fail(500, "Webhook processing failed; the event will be retried.", "processing_error");
  }
}
