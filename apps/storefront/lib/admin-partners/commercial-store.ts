/**
 * Writes for partner agreement + commercial configuration.
 *
 * Kept separate from `commercial.ts` so the readiness rule stays a pure,
 * testable function while the persistence lives here. Both writers are
 * append/upsert-only and both refuse to store an "approved" record without the
 * fields that make it provable — the same rule the database CHECK enforces.
 *
 * Nothing here creates a partner, a rate or a term. The values must come from an
 * authenticated admin who took them from the signed agreement.
 */

import { query as dbQuery } from "@/lib/db";
import {
  isPayoutFrequency,
  type PayoutFrequency,
  type PartnerAgreementRecord,
  type PartnerCommercialConfigRecord,
} from "./commercial";

export type Executor = (sql: string, params?: any[]) => Promise<any[]>;

export class CommercialStoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CommercialStoreError";
  }
}

const requireText = (value: unknown, label: string, max = 500): string => {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) throw new CommercialStoreError(`${label} is required.`);
  if (text.length > max) {
    throw new CommercialStoreError(`${label} must be ${max} characters or fewer.`);
  }
  return text;
};

const requireDate = (value: unknown, label: string): string => {
  const text = typeof value === "string" ? value.trim() : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || Number.isNaN(Date.parse(text))) {
    throw new CommercialStoreError(`${label} must be a date in YYYY-MM-DD form.`);
  }
  return text;
};

const optionalDate = (value: unknown, label: string): string | null => {
  if (value === undefined || value === null || value === "") return null;
  return requireDate(value, label);
};

export interface RecordAgreementInput {
  partnerId: string;
  agreementReference: string;
  status: "draft" | "signed" | "expired" | "terminated";
  signedOn?: string | null;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  documentRef?: string | null;
  actor: string;
}

/**
 * Record an agreement revision.
 *
 * A `signed` row must carry a reference, a signing date and an effective date —
 * an approval with no date is not evidence, and the database rejects it too.
 */
export async function recordAgreement(
  input: RecordAgreementInput,
  exec: Executor = dbQuery as unknown as Executor
): Promise<PartnerAgreementRecord> {
  const partnerId = requireText(input.partnerId, "partner id", 100);
  const actor = requireText(input.actor, "actor", 200);
  const status = input.status;
  if (!["draft", "signed", "expired", "terminated"].includes(status)) {
    throw new CommercialStoreError("Invalid agreement status.");
  }
  const reference = requireText(input.agreementReference, "agreement reference", 200);

  // For a signed agreement the dates are mandatory; for a draft they are optional
  // so an admin can stage the reference before the document is countersigned.
  const signedOn =
    status === "signed"
      ? requireDate(input.signedOn, "signed date")
      : optionalDate(input.signedOn, "signed date");
  const effectiveFrom =
    status === "signed"
      ? requireDate(input.effectiveFrom, "effective-from date")
      : optionalDate(input.effectiveFrom, "effective-from date");
  const effectiveTo = optionalDate(input.effectiveTo, "effective-to date");

  if (signedOn && effectiveTo && effectiveTo < signedOn) {
    throw new CommercialStoreError("effective-to date cannot precede the signing date.");
  }
  if (effectiveFrom && effectiveTo && effectiveTo < effectiveFrom) {
    throw new CommercialStoreError("effective-to date cannot precede effective-from date.");
  }

  const rows = await exec(
    `INSERT INTO marketplace_partner_agreement
       (partner_id, agreement_reference, status, signed_on, effective_from, effective_to,
        document_ref, approved_by, approved_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING *`,
    [
      partnerId,
      reference,
      status,
      signedOn,
      effectiveFrom,
      effectiveTo,
      input.documentRef?.trim() || null,
      status === "signed" ? actor : null,
      status === "signed" ? new Date().toISOString() : null,
    ]
  );
  return rows[0] as PartnerAgreementRecord;
}

export interface SaveCommercialConfigInput {
  partnerId: string;
  commissionPolicyId: string;
  payoutFrequency: PayoutFrequency;
  payoutTerms: string;
  effectiveFrom: string;
  /** Omit to save an unapproved draft that cannot enable activation. */
  approve?: boolean;
  actor: string;
}

/**
 * Upsert the commercial configuration.
 *
 * Saving without `approve` keeps `approved_by` null: the record exists for
 * review, but the activation gate still refuses, because an unapproved rate must
 * never enable settlement.
 */
export async function saveCommercialConfig(
  input: SaveCommercialConfigInput,
  exec: Executor = dbQuery as unknown as Executor
): Promise<PartnerCommercialConfigRecord> {
  const partnerId = requireText(input.partnerId, "partner id", 100);
  const commissionPolicyId = requireText(input.commissionPolicyId, "commission policy id", 100);
  if (!isPayoutFrequency(input.payoutFrequency)) {
    throw new CommercialStoreError(
      "payout frequency must be one of: weekly, fortnightly, monthly, on_demand."
    );
  }
  const payoutTerms = requireText(input.payoutTerms, "payout terms", 2000);
  const effectiveFrom = requireDate(input.effectiveFrom, "effective-from date");

  let approvedBy: string | null = null;
  let approvedAt: string | null = null;
  if (input.approve) {
    approvedBy = requireText(input.actor, "approver", 200);
    approvedAt = new Date().toISOString();
  }

  const rows = await exec(
    `INSERT INTO partner_commercial_config
       (partner_id, commission_policy_id, payout_frequency, payout_terms,
        effective_from, approved_by, approved_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     ON CONFLICT (partner_id) DO UPDATE SET
       commission_policy_id = EXCLUDED.commission_policy_id,
       payout_frequency     = EXCLUDED.payout_frequency,
       payout_terms         = EXCLUDED.payout_terms,
       effective_from       = EXCLUDED.effective_from,
       approved_by          = EXCLUDED.approved_by,
       approved_at          = EXCLUDED.approved_at,
       updated_at           = now()
     RETURNING *`,
    [
      partnerId,
      commissionPolicyId,
      input.payoutFrequency,
      payoutTerms,
      effectiveFrom,
      approvedBy,
      approvedAt,
    ]
  );
  return rows[0] as PartnerCommercialConfigRecord;
}
