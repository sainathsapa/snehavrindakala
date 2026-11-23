/**
 * Commission policy maths + validation.
 *
 * Non-negotiables:
 *  - never invent a rate: exactly one of rate_percent / fixed_amount must be
 *    explicitly configured, otherwise commission is 0 and validation fails;
 *  - a policy can only become active after being approved with an approver;
 *  - `policyConfigured` is the single guard used before any settlement work.
 */

import { query as defaultQuery } from "@/lib/db";
import type {
  CommissionAmounts,
  CommissionPolicy,
  CommissionResult,
  QueryExecutor,
  RefundEffect,
  PayableWhen,
  ValidationResult,
} from "./types";

const POLICY_STATUSES = ["draft", "approved", "active", "archived"];
const SCOPES = ["global", "partner", "category", "product"];
const RATE_BASES = ["gross_item_value", "discounted_item_value"];

/**
 * The complete, documented vocabulary of the two policy rules that drive
 * money behaviour. Anything outside these arrays has NO defined semantics and
 * must fail closed (see `assertKnownRefundEffect` / `assertKnownPayableWhen`).
 *
 *  refund_effect:
 *    reverse_earnings — post a new negative `refund_reversal` ledger row that
 *                       reverses commission AND payable (net effect = 0).
 *    no_reversal      — post nothing; the earning stands per the agreement.
 *  payable_when:
 *    order_paid            — payable once payment is captured.
 *    order_delivered       — also requires confirmed delivery.
 *    return_window_elapsed — also requires the configured return window to have
 *                            elapsed with no pending return / refund / hold.
 */
export const REFUND_EFFECTS = ["reverse_earnings", "no_reversal"] as const;
export const PAYABLE_WHENS = [
  "order_paid",
  "order_delivered",
  "return_window_elapsed",
] as const;

export function isKnownRefundEffect(value: unknown): value is RefundEffect {
  return typeof value === "string" && (REFUND_EFFECTS as readonly string[]).includes(value);
}

export function isKnownPayableWhen(value: unknown): value is PayableWhen {
  return typeof value === "string" && (PAYABLE_WHENS as readonly string[]).includes(value);
}

/** Fail closed: an unknown/undefined refund_effect has no behaviour to apply. */
export function assertKnownRefundEffect(value: unknown): RefundEffect {
  if (!isKnownRefundEffect(value)) {
    throw new Error(
      `UNCONFIGURED_REFUND_EFFECT: "${String(value)}" has no defined refund semantics`
    );
  }
  return value;
}

/** Fail closed: an unknown/undefined payable_when must never settle early. */
export function assertKnownPayableWhen(value: unknown): PayableWhen {
  if (!isKnownPayableWhen(value)) {
    throw new Error(
      `UNCONFIGURED_PAYABLE_WHEN: "${String(value)}" has no defined settlement timing; refusing to settle`
    );
  }
  return value;
}

/** pg returns numeric(14,2) as a string; normalise all inputs to finite numbers. */
export function toNumber(value: unknown): number {
  if (value === null || value === undefined || value === "") return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/** Half-up monetary rounding, safe for negative reversal amounts. */
export function round2(value: unknown): number {
  const x = toNumber(value);
  const sign = x < 0 ? -1 : 1;
  return (sign * Math.round((Math.abs(x) + Number.EPSILON) * 100)) / 100;
}

function validDate(value: unknown): boolean {
  if (value === null || value === undefined || value === "") return false;
  const d = new Date(value as string);
  return !Number.isNaN(d.getTime());
}

function hasRate(policy: CommissionPolicy): "percent" | "fixed" | "none" | "both" {
  const hasPercent =
    policy?.rate_percent !== null &&
    policy?.rate_percent !== undefined &&
    policy?.rate_percent !== "";
  const hasFixed =
    policy?.fixed_amount !== null &&
    policy?.fixed_amount !== undefined &&
    policy?.fixed_amount !== "";
  if (hasPercent && hasFixed) return "both";
  if (hasPercent) return "percent";
  if (hasFixed) return "fixed";
  return "none";
}

/**
 * Deterministic, pure commission calculation. All returned amounts are 2dp.
 *
 * basis = (gross or gross - discount), plus tax / shipping when the policy
 * explicitly includes them. Commission is then percent-of-basis or the fixed
 * per-item amount. Payable is basis minus commission.
 */
export function computeCommission(
  policy: CommissionPolicy,
  amounts: CommissionAmounts
): CommissionResult {
  const gross = toNumber(amounts?.gross);
  const discount = toNumber(amounts?.discount);
  const tax = toNumber(amounts?.tax);
  const shipping = toNumber(amounts?.shipping);

  let basis =
    policy?.rate_basis === "discounted_item_value" ? gross - discount : gross;
  if (policy?.tax_included === true) basis += tax;
  if (policy?.shipping_included === true) basis += shipping;

  const gross_basis = round2(Math.max(0, basis));

  let commission = 0;
  const rate = hasRate(policy);
  if (rate === "percent") {
    commission = round2((gross_basis * toNumber(policy.rate_percent)) / 100);
  } else if (rate === "fixed") {
    commission = round2(Math.max(0, toNumber(policy.fixed_amount)));
  }
  // "none"/"both" → 0. We never guess a rate.

  const payable = round2(gross_basis - commission);
  return { gross_basis, commission, payable };
}

/** Full validation of the explicit business fields of a policy. */
export function validatePolicy(policy: CommissionPolicy): ValidationResult {
  const errors: string[] = [];
  if (!policy || typeof policy !== "object") {
    return { valid: false, errors: ["A commission policy is required"] };
  }

  const rate = hasRate(policy);
  if (rate !== "percent" && rate !== "fixed") {
    errors.push("Exactly one of rate_percent or fixed_amount is required");
  }
  if (rate === "percent") {
    const r = toNumber(policy.rate_percent);
    if (!(r > 0 && r <= 100)) {
      errors.push("rate_percent must be greater than 0 and at most 100");
    }
  }
  if (rate === "fixed") {
    if (!(toNumber(policy.fixed_amount) > 0)) {
      errors.push("fixed_amount must be greater than 0");
    }
  }

  if (!POLICY_STATUSES.includes(policy.status)) {
    errors.push("status must be draft|approved|active|archived");
  }
  if (!SCOPES.includes(policy.scope)) {
    errors.push("scope must be global|partner|category|product");
  }
  if (policy.scope !== "global" && !String(policy.scope_ref ?? "").trim()) {
    errors.push("scope_ref is required for a non-global scope");
  }
  if (!RATE_BASES.includes(policy.rate_basis)) {
    errors.push("rate_basis must be gross_item_value|discounted_item_value");
  }
  if (typeof policy.name !== "string" || !policy.name.trim()) {
    errors.push("name is required");
  }
  if (typeof policy.currency !== "string" || !policy.currency.trim()) {
    errors.push("currency is required");
  }
  if (!REFUND_EFFECTS.includes(policy.refund_effect)) {
    errors.push("refund_effect must be reverse_earnings|no_reversal");
  }
  if (!PAYABLE_WHENS.includes(policy.payable_when)) {
    errors.push("payable_when must be order_paid|order_delivered|return_window_elapsed");
  }
  if (typeof policy.tax_included !== "boolean") {
    errors.push("tax_included must be set explicitly");
  }
  if (typeof policy.shipping_included !== "boolean") {
    errors.push("shipping_included must be set explicitly");
  }

  if (!validDate(policy.effective_from)) {
    errors.push("effective_from must be a valid date");
  }
  if (policy.effective_to !== null && policy.effective_to !== undefined) {
    if (!validDate(policy.effective_to)) {
      errors.push("effective_to must be a valid date");
    } else if (
      validDate(policy.effective_from) &&
      new Date(policy.effective_to).getTime() <=
        new Date(policy.effective_from as string).getTime()
    ) {
      errors.push("effective_to must be after effective_from");
    }
  }

  return { valid: errors.length === 0, errors };
}

/** Activation is only legal from an approved policy that names its approver. */
export function activatePolicy(policy: CommissionPolicy): CommissionPolicy {
  // Explicit fail-safe for the two behaviour-driving rules. validatePolicy also
  // rejects these, but naming the checks here makes "no defined semantics ⇒
  // cannot be activated" an intentional, testable contract.
  assertKnownRefundEffect(policy?.refund_effect);
  assertKnownPayableWhen(policy?.payable_when);
  const validation = validatePolicy(policy);
  if (!validation.valid) {
    throw new Error(
      `Cannot activate an invalid policy: ${validation.errors.join("; ")}`
    );
  }
  if (policy.status !== "approved") {
    throw new Error("Only an approved policy can be activated");
  }
  if (!String(policy.approved_by ?? "").trim()) {
    throw new Error("A policy must have approved_by before it can be activated");
  }
  return { ...policy, status: "active" };
}

/** True when a policy is valid, active, approved and within its date window. */
export function isPolicyEffective(
  policy: CommissionPolicy,
  now: Date = new Date()
): boolean {
  if (!policy || policy.status !== "active" || !String(policy.approved_by ?? "").trim()) {
    return false;
  }
  if (!validDate(policy.effective_from)) return false;
  const from = new Date(policy.effective_from as string).getTime();
  if (from > now.getTime()) return false;
  if (policy.effective_to !== null && policy.effective_to !== undefined) {
    if (!validDate(policy.effective_to)) return false;
    if (new Date(policy.effective_to).getTime() <= now.getTime()) return false;
  }
  return validatePolicy(policy).valid;
}

/** The single guard that decides whether a set of policies is usable. */
export function policyConfigured(
  policies: CommissionPolicy[] | null | undefined,
  now: Date = new Date()
): boolean {
  if (!Array.isArray(policies)) return false;
  return policies.some((p) => isPolicyEffective(p, now));
}

export interface FinanceAuditInput {
  partnerId?: string | null;
  actorEmail: string;
  actorRole: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
}

/** Append-only finance audit entry (partner_audit_log). */
export async function auditFinanceAction(
  input: FinanceAuditInput,
  executor: QueryExecutor = defaultQuery
): Promise<void> {
  await executor(
    "INSERT INTO partner_audit_log " +
      "(partner_id, actor_email, actor_role, action, entity_type, entity_id, metadata) " +
      "VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)",
    [
      input.partnerId ?? null,
      input.actorEmail,
      input.actorRole,
      input.action,
      input.entityType,
      input.entityId ?? null,
      JSON.stringify(input.metadata ?? {}),
    ]
  );
}
