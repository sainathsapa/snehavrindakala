/**
 * Commission policy PREVIEW + form helpers (pure, no database access here).
 *
 * The critical rule: previewing a policy is informational only. It computes
 * illustrative commission/payable numbers for a DRAFT policy without approving,
 * activating or otherwise enabling settlement. `settlementEnabled` reflects the
 * real partner-contract guard (`policyConfigured`) and is false for a draft.
 *
 * All maths delegates to the shared partner contract in
 * `@/lib/finance/commission-policy` — no rates are reimplemented or invented.
 */

import {
  computeCommission,
  policyConfigured,
  validatePolicy,
} from "@/lib/finance/commission-policy";
import type {
  CommissionAmounts,
  CommissionPolicy,
  CommissionResult,
  PayableWhen,
  PolicyScope,
  RateBasis,
  RefundEffect,
  ValidationResult,
} from "@/lib/finance/types";

/* ------------------------------------------------------------------ *
 * Form values
 * ------------------------------------------------------------------ */

export interface CommissionFormValues {
  name: string;
  scope: PolicyScope | string;
  scope_ref: string;
  rate_basis: RateBasis | string;
  tax_included: boolean;
  shipping_included: boolean;
  rate_percent: string;
  fixed_amount: string;
  currency: string;
  refund_effect: RefundEffect | string;
  payable_when: PayableWhen | string;
  effective_from: string;
  effective_to: string;
  /** Explicit "I confirm this matches the signed partner agreement". */
  confirmation: boolean;
  /** Named identity accountable for approving this policy. */
  approverIdentity: string;
}

/** HTML form values as strings (checkboxes use "on"). */
export type RawFormRecord = Record<string, string | string[] | undefined | null>;

export const DEFAULT_FORM_VALUES: CommissionFormValues = {
  name: "",
  scope: "global",
  scope_ref: "",
  rate_basis: "gross_item_value",
  tax_included: false,
  shipping_included: false,
  rate_percent: "",
  fixed_amount: "",
  currency: "INR",
  refund_effect: "reverse_earnings",
  payable_when: "order_delivered",
  effective_from: "",
  effective_to: "",
  confirmation: false,
  approverIdentity: "",
};

function asString(value: string | string[] | undefined | null): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value === null || value === undefined ? "" : String(value);
}

function asBool(value: string | string[] | undefined | null): boolean {
  const v = asString(value).toLowerCase();
  return v === "on" || v === "true" || v === "1" || v === "yes";
}

/** Normalise query-string / FormData values into typed form values. */
export function parseCommissionFormValues(raw: RawFormRecord): CommissionFormValues {
  const get = (k: keyof CommissionFormValues) => asString(raw[k]);
  return {
    name: get("name"),
    scope: get("scope") || DEFAULT_FORM_VALUES.scope,
    scope_ref: get("scope_ref"),
    rate_basis: get("rate_basis") || DEFAULT_FORM_VALUES.rate_basis,
    tax_included: asBool(raw.tax_included),
    shipping_included: asBool(raw.shipping_included),
    rate_percent: get("rate_percent"),
    fixed_amount: get("fixed_amount"),
    currency: get("currency") || DEFAULT_FORM_VALUES.currency,
    refund_effect: get("refund_effect") || DEFAULT_FORM_VALUES.refund_effect,
    payable_when: get("payable_when") || DEFAULT_FORM_VALUES.payable_when,
    effective_from: get("effective_from"),
    effective_to: get("effective_to"),
    confirmation: asBool(raw.confirmation),
    approverIdentity: get("approverIdentity"),
  };
}

/**
 * Build the object that will be persisted. It is ALWAYS a draft with no
 * approver stamped: approval/activation happen through a separate, authorised
 * step. The named approver from the form is captured in the audit trail, not in
 * `approved_by`, so a draft never masquerades as an approved policy.
 */
export function buildDraftPolicy(
  values: CommissionFormValues,
  createdBy: string | null = null
): CommissionPolicy {
  return {
    name: values.name.trim(),
    scope: values.scope as CommissionPolicy["scope"],
    scope_ref: values.scope === "global" ? null : values.scope_ref.trim() || null,
    rate_basis: values.rate_basis as CommissionPolicy["rate_basis"],
    tax_included: values.tax_included === true,
    shipping_included: values.shipping_included === true,
    rate_percent:
      values.rate_percent === "" || values.rate_percent == null
        ? null
        : values.rate_percent,
    fixed_amount:
      values.fixed_amount === "" || values.fixed_amount == null
        ? null
        : values.fixed_amount,
    currency: values.currency.trim() || "INR",
    refund_effect: values.refund_effect as CommissionPolicy["refund_effect"],
    payable_when: values.payable_when as CommissionPolicy["payable_when"],
    status: "draft",
    version: 1,
    effective_from: values.effective_from.trim() || null,
    effective_to: values.effective_to.trim() || null,
    approved_by: null,
    approved_at: null,
    created_by: createdBy,
  };
}

export interface CommissionFormSubmission {
  policy: CommissionPolicy;
  confirmation: boolean;
  approverIdentity: string;
}

/**
 * Form-level validation = the shared business validation PLUS the human
 * accountability gates the UI requires. No policy is saved unless all pass.
 */
export function validateCommissionForm(input: CommissionFormSubmission): ValidationResult {
  const errors: string[] = [];
  if (!input?.policy) {
    return { valid: false, errors: ["A commission policy is required"] };
  }
  errors.push(...validatePolicy(input.policy).errors);

  if (input.policy.status !== "draft") {
    errors.push("A newly created policy must start in draft status");
  }
  if (input.policy.approved_by) {
    errors.push("A new draft cannot carry an approver in approved_by");
  }
  if (input.confirmation !== true) {
    errors.push("You must confirm this matches the signed partner agreement");
  }
  const approver = String(input.approverIdentity ?? "").trim();
  if (!approver) {
    errors.push("An approver identity is required");
  } else if (!approver.includes("@")) {
    errors.push("The approver identity must be an email address");
  }

  return { valid: errors.length === 0, errors };
}

/* ------------------------------------------------------------------ *
 * Preview
 * ------------------------------------------------------------------ */

export interface PreviewSampleInput {
  label?: string;
  amounts: CommissionAmounts;
}

/** A sample may be a plain gross number, an amounts object, or labelled. */
export type SampleAmount = number | CommissionAmounts | PreviewSampleInput;

/** Illustrative examples only — never seeded as business rates. */
export const DEFAULT_SAMPLES: PreviewSampleInput[] = [
  { label: "Single work · ₹1,000", amounts: { gross: 1000 } },
  {
    label: "Work with discount, tax & shipping · ₹2,500 gross",
    amounts: { gross: 2500, discount: 250, tax: 120, shipping: 80 },
  },
  { label: "Higher-value work · ₹5,000", amounts: { gross: 5000 } },
];

export interface CommissionPreviewLine extends CommissionResult {
  label: string;
  amounts: CommissionAmounts;
}

export interface CommissionPreview {
  status: CommissionPolicy["status"];
  validation: ValidationResult;
  /** True only for a valid, approved, active policy inside its date window. */
  configured: boolean;
  /** Alias used by the UI: a preview never enables settlement for a draft. */
  settlementEnabled: boolean;
  lines: CommissionPreviewLine[];
}

function normaliseSample(sample: SampleAmount, index: number): PreviewSampleInput {
  if (typeof sample === "number") {
    return { label: `Example ${index + 1}`, amounts: { gross: sample } };
  }
  if ("amounts" in sample && sample.amounts) {
    return { label: sample.label || `Example ${index + 1}`, amounts: sample.amounts };
  }
  return { label: `Example ${index + 1}`, amounts: sample as CommissionAmounts };
}

/**
 * Pure, side-effect-free preview. It computes illustrative numbers for any
 * policy (including drafts) but does NOT change status, stamp an approver or
 * enable settlement — `settlementEnabled` is the real config guard.
 */
export function previewCommission(
  policy: CommissionPolicy,
  sampleAmounts: SampleAmount[] = DEFAULT_SAMPLES,
  now: Date = new Date()
): CommissionPreview {
  const validation = validatePolicy(policy);
  const configured = policyConfigured([policy], now);
  const samples =
    Array.isArray(sampleAmounts) && sampleAmounts.length > 0
      ? sampleAmounts
      : DEFAULT_SAMPLES;

  const lines = samples.map((sample, index) => {
    const normalised = normaliseSample(sample, index);
    return {
      label: normalised.label,
      amounts: normalised.amounts,
      ...computeCommission(policy, normalised.amounts),
    };
  });

  return {
    status: policy?.status,
    validation,
    configured,
    settlementEnabled: configured,
    lines,
  };
}
