/**
 * Commercial readiness for a marketplace partner.
 *
 * WHY
 *
 * `partner.account_status = 'active'` is what unlocks partner portal access,
 * product listing and settlement. Before this module, an admin could set it with
 * a single status change and nothing else — no signed agreement, no approved
 * commission policy, no payout terms. That produced a partner who could sell
 * (and accrue earnings) under terms nobody had agreed to.
 *
 * The rule is now explicit and fail-closed:
 *
 *   a partner may only become COMMERCIALLY ACTIVE when
 *     • a signed agreement is in force today, with a real reference, and
 *     • an approved commercial configuration names the commission policy,
 *       the payout frequency, the payout terms and the approver.
 *
 * This module never invents a rate, a term or a date. It only evaluates what the
 * owner has actually recorded, and refuses with a list of what is missing.
 *
 * The pure evaluator takes `today` as an argument so expiry and
 * not-yet-effective cases are testable without freezing the clock.
 */

import { query as dbQuery } from "@/lib/db";

/* ── types ───────────────────────────────────────────────────────────────── */

export interface PartnerAgreementRecord {
  id: string;
  partner_id: string;
  agreement_reference: string;
  status: "draft" | "signed" | "expired" | "terminated";
  signed_on: string | null;
  effective_from: string | null;
  effective_to: string | null;
  document_ref?: string | null;
  approved_by?: string | null;
  approved_at?: string | null;
}

export interface PartnerCommercialConfigRecord {
  id: string;
  partner_id: string;
  commission_policy_id: string | null;
  payout_frequency: PayoutFrequency | null;
  payout_terms: string | null;
  effective_from: string | null;
  approved_by: string | null;
  approved_at: string | null;
}

export const PAYOUT_FREQUENCIES = [
  "weekly",
  "fortnightly",
  "monthly",
  "on_demand",
] as const;
export type PayoutFrequency = (typeof PAYOUT_FREQUENCIES)[number];

export function isPayoutFrequency(value: unknown): value is PayoutFrequency {
  return (
    typeof value === "string" &&
    (PAYOUT_FREQUENCIES as readonly string[]).includes(value)
  );
}

/**
 * Every reason activation can be refused. Codes are stable so the admin UI, the
 * tests and the runbook can refer to the same thing.
 */
export type CommercialBlocker =
  | "agreement_missing"
  | "agreement_not_signed"
  | "agreement_reference_missing"
  | "agreement_signed_on_missing"
  | "agreement_not_yet_effective"
  | "agreement_expired"
  | "commercial_config_missing"
  | "commission_policy_missing"
  | "payout_frequency_missing"
  | "payout_terms_missing"
  | "commercial_config_not_approved"
  | "commercial_config_not_yet_effective";

export const COMMERCIAL_BLOCKER_MESSAGES: Record<CommercialBlocker, string> = {
  agreement_missing:
    "No partner agreement is recorded. A signed agreement is required before a partner can be commercially active.",
  agreement_not_signed:
    "The recorded agreement is not signed. Only a signed agreement enables activation.",
  agreement_reference_missing:
    "The signed agreement has no reference. Record the contract reference so the approval can be traced.",
  agreement_signed_on_missing:
    "The signed agreement has no signing date. Record the date it was signed.",
  agreement_not_yet_effective:
    "The agreement's effective date is in the future.",
  agreement_expired:
    "The agreement has expired or been terminated. Renew it before re-activating the partner.",
  commercial_config_missing:
    "No approved commercial configuration exists. Commission basis, payout frequency and payout terms must be approved first.",
  commission_policy_missing:
    "The commercial configuration does not reference an approved commission policy.",
  payout_frequency_missing:
    "Payout frequency is not set.",
  payout_terms_missing:
    "Payout terms are not set.",
  commercial_config_not_approved:
    "The commercial configuration has not been approved by an authorised person.",
  commercial_config_not_yet_effective:
    "The commercial configuration's effective date is in the future.",
};

export interface CommercialReadiness {
  ready: boolean;
  blockers: CommercialBlocker[];
  /** Human-readable, safe to show to an admin. Never contains secret values. */
  messages: string[];
}

/* ── pure evaluation ─────────────────────────────────────────────────────── */

const isDate = (value: unknown): value is string =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value) && !Number.isNaN(Date.parse(value));

const dateOnly = (value: string) => value.slice(0, 10);

/**
 * Decide whether a partner may be commercially active.
 *
 * `today` is an ISO date (YYYY-MM-DD). Everything is evaluated against it so the
 * decision is reproducible and does not depend on process timezone.
 */
export function evaluateCommercialReadiness(
  input: {
    agreement?: PartnerAgreementRecord | null;
    commercial?: PartnerCommercialConfigRecord | null;
  },
  today: string
): CommercialReadiness {
  const blockers: CommercialBlocker[] = [];
  const day = dateOnly(today);
  const { agreement, commercial } = input ?? {};

  /* agreement */
  if (!agreement) {
    blockers.push("agreement_missing");
  } else if (agreement.status === "expired" || agreement.status === "terminated") {
    blockers.push("agreement_expired");
  } else if (agreement.status !== "signed") {
    blockers.push("agreement_not_signed");
  } else {
    if (!agreement.agreement_reference?.trim()) {
      blockers.push("agreement_reference_missing");
    }
    if (!isDate(agreement.signed_on)) {
      blockers.push("agreement_signed_on_missing");
    }
    if (!isDate(agreement.effective_from)) {
      // A signed agreement with no start date cannot be in force.
      blockers.push("agreement_not_yet_effective");
    } else if (dateOnly(agreement.effective_from) > day) {
      blockers.push("agreement_not_yet_effective");
    }
    if (isDate(agreement.effective_to) && dateOnly(agreement.effective_to) < day) {
      // An end date in the past is an expiry even if the status column still
      // says "signed" — the status can be stale, the date cannot.
      blockers.push("agreement_expired");
    }
  }

  /* commercial configuration */
  if (!commercial) {
    blockers.push("commercial_config_missing");
  } else {
    if (!commercial.commission_policy_id?.trim()) {
      blockers.push("commission_policy_missing");
    }
    if (!isPayoutFrequency(commercial.payout_frequency)) {
      blockers.push("payout_frequency_missing");
    }
    if (!commercial.payout_terms?.trim()) {
      blockers.push("payout_terms_missing");
    }
    if (!commercial.approved_by?.trim() || !commercial.approved_at) {
      blockers.push("commercial_config_not_approved");
    }
    if (isDate(commercial.effective_from) && dateOnly(commercial.effective_from) > day) {
      blockers.push("commercial_config_not_yet_effective");
    } else if (!isDate(commercial.effective_from)) {
      blockers.push("commercial_config_not_yet_effective");
    }
  }

  const unique = [...new Set(blockers)];
  return {
    ready: unique.length === 0,
    blockers: unique,
    messages: unique.map((code) => COMMERCIAL_BLOCKER_MESSAGES[code]),
  };
}

/* ── persistence ─────────────────────────────────────────────────────────── */

export type Executor = (sql: string, params?: any[]) => Promise<any[]>;

export class CommercialValidationError extends Error {
  readonly blockers: CommercialBlocker[];
  constructor(message: string, blockers: CommercialBlocker[] = []) {
    super(message);
    this.name = "CommercialValidationError";
    this.blockers = blockers;
  }
}

/** The latest agreement row for a partner, whatever its status. */
export async function getLatestAgreement(
  partnerId: string,
  exec: Executor = dbQuery as unknown as Executor
): Promise<PartnerAgreementRecord | null> {
  const rows = await exec(
    `SELECT * FROM marketplace_partner_agreement
      WHERE partner_id = $1
      ORDER BY created_at DESC
      LIMIT 1`,
    [partnerId]
  );
  return (rows?.[0] as PartnerAgreementRecord) ?? null;
}

export async function getCommercialConfig(
  partnerId: string,
  exec: Executor = dbQuery as unknown as Executor
): Promise<PartnerCommercialConfigRecord | null> {
  const rows = await exec(
    `SELECT * FROM partner_commercial_config WHERE partner_id = $1 LIMIT 1`,
    [partnerId]
  );
  return (rows?.[0] as PartnerCommercialConfigRecord) ?? null;
}

/** Readiness as evaluated from what is actually stored. */
export async function loadCommercialReadiness(
  partnerId: string,
  today: string,
  exec: Executor = dbQuery as unknown as Executor
): Promise<CommercialReadiness> {
  const [agreement, commercial] = await Promise.all([
    getLatestAgreement(partnerId, exec),
    getCommercialConfig(partnerId, exec),
  ]);
  return evaluateCommercialReadiness({ agreement, commercial }, today);
}

/** Throw unless the partner may be made commercially active. */
export async function assertCommerciallyActivatable(
  partnerId: string,
  today: string,
  exec: Executor = dbQuery as unknown as Executor
): Promise<CommercialReadiness> {
  const readiness = await loadCommercialReadiness(partnerId, today, exec);
  if (!readiness.ready) {
    throw new CommercialValidationError(
      `Partner cannot be made commercially active: ${readiness.messages.join(" ")}`,
      readiness.blockers
    );
  }
  return readiness;
}
