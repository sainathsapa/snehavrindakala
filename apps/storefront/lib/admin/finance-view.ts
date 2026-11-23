/**
 * Pure status / label helpers and row shapes for the admin finance screens.
 *
 * These used to be exported from `app/api/admin/marketplace/finance/route.ts`,
 * but Next.js validates Route module exports at build time: only HTTP methods
 * and a fixed set of framework exports are allowed. Named helper exports make
 * `next build` fail with "<name> is not a valid Route export field".
 */

import {
  validateOwnerInputs,
  type OwnerInputEnv,
} from "@/lib/config/owner-inputs";

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
  if (minor === null || minor === undefined) return "—";
  if (typeof minor === "string" && !minor.trim()) return "—";
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
