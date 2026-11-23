/**
 * Payment reconciliation — the provider is the only source of truth.
 *
 * A browser can report `success` and a webhook can go missing; neither is
 * evidence that money moved. Every decision here starts from a fresh
 * `providerVerify(paymentId)` call and derives the order state from that. The
 * local `payment.status` is accepted as *input* only so we can describe the
 * mismatch — it is never used to decide whether the payment is good.
 *
 * Nothing in this module marks an order paid. It opens/closes reconciliation
 * issues; a human-visible order transition stays with the checkout path that
 * verified the signature and the amount.
 */

import { query as defaultQuery } from "@/lib/db";
import type { DbExecutor } from "./events";

export type { DbExecutor };

/** Authoritative answer from the provider's fetch-payment API. */
export interface ProviderPaymentState {
  paymentId: string;
  status: string;
  captured: boolean;
  refunded: boolean;
  amount?: number;
  currency?: string;
  /** The provider's own order id, used to detect cross-checkout payments. */
  orderId?: string;
}

export type ProviderVerify = (
  paymentId: string
) => Promise<ProviderPaymentState>;

export type DerivedOrderState =
  | "paid"
  | "authorized"
  | "refunded"
  | "failed"
  | "pending";

export type ReconciliationIssueType =
  | "captured_unconfirmed"
  | "authorized_unconfirmed"
  | "failed_order_created"
  | "duplicate_payment"
  | "amount_mismatch"
  | "webhook_missed";

export interface LocalPayment {
  id: string;
  amount: number;
  currency?: string;
  orderId?: string;
  status?: string;
  /**
   * False when we only learned about the payment from the reconciler. Lets us
   * tell a missed webhook apart from a payment we confirmed but never settled.
   */
  webhookRecorded?: boolean;
}

export interface LocalOrder {
  id: string;
  amount: number;
  currency?: string;
  status: string;
}

export interface ReconcilePaymentResult {
  paymentId: string;
  orderId: string;
  providerState: ProviderPaymentState;
  derivedState: DerivedOrderState;
  issueType: ReconciliationIssueType | null;
  issueId: string | null;
  action: "issue_opened" | "already_tracked" | "no_issue";
}

export interface ReconciliationIssueRow {
  id: string;
  order_id: string;
  payment_id: string | null;
  issue_type: ReconciliationIssueType;
  status: "open" | "retrying" | "resolved" | "escalated";
  attempts: number;
  next_attempt_at: string | Date;
  last_error: string | null;
  resolution: string | null;
  created_at?: string;
}

/** Pure, deterministic mapping from what the provider says to an order state. */
export function deriveOrderState(state: ProviderPaymentState): DerivedOrderState {
  const status = (state.status || "").trim().toLowerCase();
  if (state.refunded || status === "refunded") return "refunded";
  if (state.captured || status === "captured") return "paid";
  if (status === "authorized") return "authorized";
  if (status === "pending" || status === "processing" || status === "created") {
    return "pending";
  }
  return "failed";
}

const CONFIRMED_ORDER_STATUSES = new Set([
  "paid",
  "completed",
  "confirmed",
  "captured",
  "fulfilled",
  "shipped",
  "delivered",
]);

function orderIsConfirmed(status: string): boolean {
  return CONFIRMED_ORDER_STATUSES.has((status || "").trim().toLowerCase());
}

/** Pure classification used by both the per-payment check and the tests. */
export function classifyMismatch(
  providerState: ProviderPaymentState,
  payment: LocalPayment,
  order: LocalOrder
): ReconciliationIssueType | null {
  if (
    typeof providerState.amount === "number" &&
    Number.isFinite(providerState.amount) &&
    providerState.amount !== order.amount
  ) {
    return "amount_mismatch";
  }

  const derived = deriveOrderState(providerState);
  const confirmed = orderIsConfirmed(order.status);

  if ((derived === "paid" || derived === "refunded") && !confirmed) {
    return payment.webhookRecorded === false
      ? "webhook_missed"
      : "captured_unconfirmed";
  }
  if (derived === "authorized" && !confirmed) return "authorized_unconfirmed";
  if (derived === "failed" && confirmed) return "failed_order_created";
  return null;
}

export interface OpenIssueParams {
  orderId: string;
  paymentId?: string | null;
  issueType: ReconciliationIssueType;
  detail?: string;
  attempts?: number;
  nextAttemptAt?: Date;
}

export interface OpenIssueResult {
  issueId: string;
  isNew: boolean;
}

/**
 * Open a reconciliation issue, or return the existing open/retrying one so a
 * nightly run cannot pile up duplicate tickets for the same order.
 */
export async function openIssueForMismatch(
  params: OpenIssueParams,
  executor: DbExecutor = defaultQuery
): Promise<OpenIssueResult> {
  const existing = await executor(
    `SELECT id FROM payment_reconciliation_issue
      WHERE order_id = $1
        AND issue_type = $2
        AND status IN ('open','retrying')
        AND ($3::text IS NULL OR payment_id = $3)
      ORDER BY created_at DESC
      LIMIT 1`,
    [params.orderId, params.issueType, params.paymentId ?? null]
  );
  if (existing.length > 0) {
    return { issueId: existing[0].id, isNew: false };
  }

  const rows = await executor(
    `INSERT INTO payment_reconciliation_issue
       (order_id, payment_id, issue_type, status, attempts, next_attempt_at, last_error)
     VALUES ($1, $2, $3, 'open', $4, $5, $6)
     RETURNING id`,
    [
      params.orderId,
      params.paymentId ?? null,
      params.issueType,
      params.attempts ?? 0,
      (params.nextAttemptAt ?? new Date()).toISOString(),
      params.detail ?? null,
    ]
  );
  return { issueId: rows[0].id, isNew: true };
}

/**
 * Reconcile one payment. `providerVerify` is called unconditionally — the
 * browser's success flag is never consulted.
 */
export async function reconcilePayment(
  payment: LocalPayment,
  order: LocalOrder,
  providerVerify: ProviderVerify,
  executor: DbExecutor = defaultQuery
): Promise<ReconcilePaymentResult> {
  const providerState = await providerVerify(payment.id);
  const derivedState = deriveOrderState(providerState);
  const issueType = classifyMismatch(providerState, payment, order);

  let issueId: string | null = null;
  let action: ReconcilePaymentResult["action"] = "no_issue";
  if (issueType) {
    const opened = await openIssueForMismatch(
      {
        orderId: order.id,
        paymentId: payment.id,
        issueType,
        detail: `provider=${providerState.status}; local=${order.status}`,
      },
      executor
    );
    issueId = opened.issueId;
    action = opened.isNew ? "issue_opened" : "already_tracked";
  }

  return {
    paymentId: payment.id,
    orderId: order.id,
    providerState,
    derivedState,
    issueType,
    issueId,
    action,
  };
}

export async function listReconciliationIssues(
  options: { status?: string; limit?: number } = {},
  executor: DbExecutor = defaultQuery
): Promise<ReconciliationIssueRow[]> {
  const rows = await executor(
    `SELECT * FROM payment_reconciliation_issue
      WHERE ($1::text IS NULL OR status = $1)
      ORDER BY next_attempt_at ASC, created_at ASC
      LIMIT $2`,
    [options.status ?? null, options.limit ?? 100]
  );
  return rows as ReconciliationIssueRow[];
}

/* ── Batch retry policy ───────────────────────────────────────────────────── */

export const RECONCILIATION_MAX_ATTEMPTS = 5;
export const RECONCILIATION_BASE_DELAY_MS = 60_000;
export const RECONCILIATION_MAX_DELAY_MS = 3_600_000;

/** Binary exponential backoff with a ceiling, so a bad provider is not hammered. */
export function backoffDelayMs(attempt: number): number {
  const a = Math.max(0, Math.floor(attempt));
  return Math.min(
    RECONCILIATION_MAX_DELAY_MS,
    RECONCILIATION_BASE_DELAY_MS * 2 ** a
  );
}

interface IssuePatch {
  status?: ReconciliationIssueRow["status"];
  attempts?: number;
  nextAttemptAt?: Date;
  lastError?: string | null;
  resolution?: string | null;
  resolvedAt?: Date;
}

async function updateIssue(
  id: string,
  patch: IssuePatch,
  executor: DbExecutor
): Promise<void> {
  await executor(
    `UPDATE payment_reconciliation_issue
        SET status = COALESCE($2, status),
            attempts = COALESCE($3, attempts),
            next_attempt_at = COALESCE($4, next_attempt_at),
            last_error = COALESCE($5, last_error),
            resolution = COALESCE($6, resolution),
            resolved_at = COALESCE($7, resolved_at),
            updated_at = now()
      WHERE id = $1`,
    [
      id,
      patch.status ?? null,
      patch.attempts ?? null,
      patch.nextAttemptAt?.toISOString() ?? null,
      patch.lastError ?? null,
      patch.resolution ?? null,
      patch.resolvedAt?.toISOString() ?? null,
    ]
  );
}

function issueIsResolved(
  issueType: ReconciliationIssueType,
  state: ProviderPaymentState
): boolean {
  // An amount mismatch cannot be closed by "captured": it needs the order and
  // provider amounts compared by a person (or a dedicated amount check).
  if (issueType === "amount_mismatch") return false;
  const derived = deriveOrderState(state);
  if (issueType === "authorized_unconfirmed") {
    return derived !== "failed" && derived !== "pending";
  }
  return derived === "paid" || derived === "refunded";
}

export interface BatchResult {
  total: number;
  processed: number;
  failed: number;
  escalated: number;
  skipped: number;
}

/**
 * Work a queue of issues. `processed` = verified and closed; `failed` = tried
 * but still unresolved, scheduled with backoff; `escalated` = out of attempts;
 * `skipped` = already closed or escalated before this run.
 */
export async function runReconciliationBatch(
  issues: ReconciliationIssueRow[],
  providerVerify: ProviderVerify,
  executor: DbExecutor = defaultQuery
): Promise<BatchResult> {
  const result: BatchResult = {
    total: issues.length,
    processed: 0,
    failed: 0,
    escalated: 0,
    skipped: 0,
  };

  for (const issue of issues) {
    if (issue.status === "resolved" || issue.status === "escalated") {
      result.skipped += 1;
      continue;
    }

    const attempts = Number(issue.attempts ?? 0);
    if (attempts >= RECONCILIATION_MAX_ATTEMPTS) {
      await updateIssue(
        issue.id,
        {
          status: "escalated",
          lastError: issue.last_error ?? "Maximum attempts reached",
        },
        executor
      );
      result.escalated += 1;
      continue;
    }

    try {
      const state = await providerVerify(issue.payment_id ?? "");
      if (issueIsResolved(issue.issue_type, state)) {
        await updateIssue(
          issue.id,
          {
            status: "resolved",
            resolution: `provider=${state.status}`,
            resolvedAt: new Date(),
          },
          executor
        );
        result.processed += 1;
      } else {
        await scheduleRetry(issue, attempts, `provider=${state.status}`, executor, result);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await scheduleRetry(issue, attempts, message, executor, result);
    }
  }

  return result;
}

async function scheduleRetry(
  issue: ReconciliationIssueRow,
  attempts: number,
  reason: string,
  executor: DbExecutor,
  result: BatchResult
): Promise<void> {
  const next = attempts + 1;
  if (next >= RECONCILIATION_MAX_ATTEMPTS) {
    await updateIssue(
      issue.id,
      { status: "escalated", attempts: next, lastError: reason },
      executor
    );
    result.escalated += 1;
    return;
  }
  await updateIssue(
    issue.id,
    {
      status: "retrying",
      attempts: next,
      nextAttemptAt: new Date(Date.now() + backoffDelayMs(next)),
      lastError: reason,
    },
    executor
  );
  result.failed += 1;
}

/* ── Provider verify adapter (test by default, Razorpay when configured) ── */

export interface PaymentVerifier extends ProviderVerify {
  /** Exposed for logging so an operator can see which mode actually ran. */
  mode: "test" | "razorpay" | "unconfigured";
}

export function testPaymentState(
  paymentId: string,
  overrides: Partial<ProviderPaymentState> = {}
): ProviderPaymentState {
  return {
    paymentId,
    status: "captured",
    captured: true,
    refunded: false,
    ...overrides,
  };
}

export function getPaymentVerifier(
  env: NodeJS.ProcessEnv = process.env
): PaymentVerifier {
  const keyId = (env.RAZORPAY_KEY_ID || "").trim();
  const secret = (env.RAZORPAY_SECRET || env.RAZORPAY_KEY_SECRET || "").trim();

  if (keyId && secret) {
    const verifier = (async (paymentId: string) => {
      const response = await fetch(
        `https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}`,
        {
          headers: {
            Authorization:
              "Basic " + Buffer.from(`${keyId}:${secret}`).toString("base64"),
          },
          cache: "no-store",
        }
      );
      if (response.status === 404) {
        return testPaymentState(paymentId, {
          status: "not_found",
          captured: false,
        });
      }
      if (!response.ok) {
        throw new Error(`Payment verifier returned HTTP ${response.status}`);
      }
      const raw = (await response.json()) as Record<string, any>;
      const status = String(raw.status ?? "unknown");
      const amountRefunded = Number(raw.amount_refunded ?? 0);
      return testPaymentState(paymentId, {
        status,
        captured: status === "captured" || Boolean(raw.captured_at),
        refunded:
          status === "refunded" ||
          amountRefunded > 0 ||
          (Array.isArray(raw.refunds) && raw.refunds.length > 0),
        amount:
          typeof raw.amount === "number" ? raw.amount : Number(raw.amount),
        currency: raw.currency,
        orderId: raw.order_id,
      });
    }) as PaymentVerifier;
    verifier.mode = "razorpay";
    return verifier;
  }

  if ((env.NODE_ENV || "").toLowerCase() === "production") {
    // Fail closed: never silently trust a test verifier in production.
    const verifier = (async () => {
      throw new Error(
        "Payment verifier is not configured: set RAZORPAY_KEY_ID and RAZORPAY_SECRET (or RAZORPAY_KEY_SECRET)."
      );
    }) as PaymentVerifier;
    verifier.mode = "unconfigured";
    return verifier;
  }

  const verifier = (async (paymentId: string) =>
    testPaymentState(paymentId)) as PaymentVerifier;
  verifier.mode = "test";
  return verifier;
}
