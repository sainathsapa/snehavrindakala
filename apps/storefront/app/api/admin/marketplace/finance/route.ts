/**
 * GET /api/admin/marketplace/finance — read-only operational view of payment
 * reconciliation and provider refund execution.
 *
 * Gated on `refunds:read` and on a platform admin identity. A partner-tenant
 * role is denied outright: these queries see every order on the platform.
 *
 * This endpoint is deliberately READ-ONLY. It takes no request body, reads no
 * query parameters and never reads an approver / approval decision from the
 * client. Approving a refund is a separate, server-gated action
 * (`/api/admin/refunds` and `/api/admin/refunds/execute`) where the requester
 * comes from the stored approval and the approver from the signed session —
 * never from a request. Showing that state here cannot authorise it.
 */

import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import {
  validateOwnerInputs,
  type OwnerInputEnv,
} from "@/lib/config/owner-inputs";

export const dynamic = "force-dynamic";

/* ── Pure status / label helpers (shared with the two admin screens) ─────── */

export type ReconciliationStatus = "open" | "retrying" | "resolved" | "escalated";
export type IssueType =
  | "captured_unconfirmed"
  | "authorized_unconfirmed"
  | "failed_order_created"
  | "duplicate_payment"
  | "amount_mismatch"
  | "webhook_missed";
export type RefundExecutionStatus =
  | "pending"
  | "approved"
  | "initiated"
  | "provider_confirmed"
  | "failed"
  | "reversed";

export const RECONCILIATION_STATUS_LABEL: Record<string, string> = {
  open: "open — waiting for the scheduled reconciler",
  retrying: "retrying — provider not confirmed yet",
  resolved: "resolved — closed after verification",
  escalated: "escalated — needs a person to look",
};

export function reconciliationStatusLabel(status: string): string {
  return RECONCILIATION_STATUS_LABEL[status] ?? "unknown status";
}

export const ISSUE_TYPE_LABEL: Record<string, string> = {
  captured_unconfirmed: "captured at provider, order unconfirmed",
  authorized_unconfirmed: "authorized, order unconfirmed",
  failed_order_created: "payment failed but an order exists",
  duplicate_payment: "duplicate payment",
  amount_mismatch: "amount mismatch",
  webhook_missed: "webhook missed",
};

export function issueTypeLabel(type: string): string {
  return ISSUE_TYPE_LABEL[type] ?? "unknown issue";
}

/**
 * Only `provider_confirmed` means the provider actually moved money. An
 * internal `approved` is a permission to try, not evidence of a refund.
 */
export const REFUND_EXECUTION_STATUS_LABEL: Record<string, string> = {
  pending: "pending — nothing sent to the provider",
  approved: "approved internally — money has NOT moved",
  initiated: "initiated with provider — not confirmed",
  provider_confirmed: "provider confirmed — money has moved",
  failed: "failed — nothing moved",
  reversed: "reversed — money returned to the customer",
};

export function refundExecutionStatusLabel(status: string): string {
  return REFUND_EXECUTION_STATUS_LABEL[status] ?? "unknown status";
}

export function moneyLabel(minor: unknown, currency: string = "INR"): string {
  const amount = typeof minor === "number" ? minor : Number(minor);
  if (!Number.isFinite(amount)) return "—";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: (currency || "INR").toUpperCase(),
    maximumFractionDigits: 0,
  }).format(amount / 100);
}

export function whenLabel(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
}

/* ── Sandbox credential readiness (names only, never values) ────────────── */

const SANDBOX_PAYMENT_KEYS = [
  "razorpayKeyId",
  "razorpayKeySecret",
  "razorpayWebhookSecret",
] as const;

export interface SandboxPaymentConfig {
  configured: boolean;
  /** Environment variable / field NAMES that are still missing. No values. */
  missing: string[];
}

/**
 * Presence-only check against the owner-input report from A64. Falls back to
 * the same by-name semantics if a field is absent from the report entirely.
 * The returned `missing` array can be pasted into a ticket safely.
 */
export function sandboxPaymentConfig(
  env: OwnerInputEnv = process.env as OwnerInputEnv
): SandboxPaymentConfig {
  const report = validateOwnerInputs(env);
  const present = new Set(
    report.present
      .filter((field) => field.group === "Payments")
      .map((field) => field.key)
  );
  const missing = report.missing
    .filter(
      (field) =>
        field.group === "Payments" &&
        (SANDBOX_PAYMENT_KEYS as readonly string[]).includes(field.key)
    )
    .map((field) => field.name);
  return {
    configured: SANDBOX_PAYMENT_KEYS.every((key) => present.has(key)),
    missing,
  };
}

/* ── Row shapes ─────────────────────────────────────────────────────────── */

export interface ReconciliationIssueRow {
  id: string;
  order_id: string;
  payment_id: string | null;
  issue_type: string;
  status: string;
  attempts: number;
  next_attempt_at: string | Date;
  last_error: string | null;
}

export interface RefundExecutionRow {
  id: string;
  refund_request_id: string | null;
  order_id: string;
  amount: number;
  currency: string;
  status: string;
  requested_by: string;
  approved_by: string;
  provider: string;
  provider_refund_id: string | null;
  failure_reason: string | null;
  created_at: string;
}

export interface AwaitingApprovalRefund {
  id: string;
  order_id: string;
  amount: number;
  reason: string | null;
  requested_by: string | null;
  created_at: string;
}

/* ── Gated, read-only handler ───────────────────────────────────────────── */

export async function GET() {
  // Imported inside the handler so this module (and its pure helpers) stay
  // importable in unit tests without pulling request-bound Next.js context.
  const { getAdminIdentity, requirePermission } = await import(
    "@/app/admin/actions"
  );

  const identity = await getAdminIdentity();
  if (!identity) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (identity.role === "partner") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!(await requirePermission("refunds:read"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const [issues, executions, awaitingApproval] = await Promise.all([
      query(
        `SELECT id, order_id, payment_id, issue_type, status, attempts,
                next_attempt_at, last_error
           FROM payment_reconciliation_issue
          ORDER BY next_attempt_at ASC, created_at ASC
          LIMIT 200`
      ) as Promise<ReconciliationIssueRow[]>,
      query(
        `SELECT id, refund_request_id, order_id, amount, currency, status,
                requested_by, approved_by, provider, provider_refund_id,
                failure_reason, created_at
           FROM refund_execution
          ORDER BY created_at DESC
          LIMIT 200`
      ) as Promise<RefundExecutionRow[]>,
      query(
        `SELECT id, order_id, amount, reason, requested_by, created_at
           FROM order_refunds
          WHERE status = 'pending'
            AND requested_by IS NOT NULL
            AND approved_by IS NULL
          ORDER BY created_at ASC
          LIMIT 200`
      ) as Promise<AwaitingApprovalRefund[]>,
    ]);

    return NextResponse.json({
      issues,
      executions,
      awaitingApproval,
      config: sandboxPaymentConfig(),
      note:
        "Read-only. Issues are worked by the scheduled reconciler; a refund is money moved only at provider_confirmed. Requester and approver are always derived server-side and must differ.",
    });
  } catch (error) {
    console.error("Could not load marketplace finance data", error);
    return NextResponse.json(
      { error: "Could not load marketplace finance data." },
      { status: 500 }
    );
  }
}
