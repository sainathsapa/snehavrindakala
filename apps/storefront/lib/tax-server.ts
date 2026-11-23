/**
 * Reads the GST configuration from the environment (with sane defaults).
 *
 * `getSellerHomeState` / `getGstRate` are the *calculation* inputs: they fall
 * back to the historical defaults so a shopping cart never breaks because an
 * operator has not filled in a form.
 *
 * `gstConfigStatus` is the *compliance* check added by GST-01. It reports only
 * presence and validity — never a value — because the seller identity and
 * GSTIN are owner/accountant data. Validation is all this module does: no
 * statutory invoice is issued and no GSTIN, HSN code or rate is invented here.
 */

import {
  DEFAULT_GST_RATE,
  DEFAULT_HOME_STATE,
  type TaxBreakdown,
  calculateTax,
  taxLabel,
} from "./tax";

export function getSellerHomeState(): string {
  return process.env.SELLER_HOME_STATE || DEFAULT_HOME_STATE;
}

export function getGstRate(): number {
  const rate = Number(process.env.GST_RATE);
  return Number.isFinite(rate) && rate >= 0 ? rate : DEFAULT_GST_RATE;
}

/** Tax breakdown for a GST-inclusive amount in paise. */
export function taxForAmount(
  amountInPaise: number,
  state?: string | null
): TaxBreakdown {
  return calculateTax(amountInPaise, state, {
    gstRate: getGstRate(),
    homeState: getSellerHomeState(),
  });
}

/* ── GST-01: validated seller / tax configuration ─────────────────────────── */

export const GST_ENV_KEYS = [
  "SELLER_LEGAL_NAME",
  "SELLER_GSTIN",
  "SELLER_ADDRESS",
  "SELLER_HOME_STATE",
  "GST_RATE",
  "HSN_SAC_DEFAULT",
] as const;

export type GstEnvKey = (typeof GST_ENV_KEYS)[number];
type EnvLike = Record<string, string | undefined>;

export interface GstFieldStatus {
  key: GstEnvKey;
  present: boolean;
  valid: boolean;
}

export interface GstConfigStatus {
  /** All mandatory fields present and well-formed. Still needs CA sign-off. */
  ready: boolean;
  fields: GstFieldStatus[];
  missing: GstEnvKey[];
  invalid: GstEnvKey[];
}

/**
 * Indian GSTIN: 2-digit state code, 10-character PAN, entity number,
 * `Z` (default), and a check digit. Checking the shape is cheap; confirming
 * that the number is really the seller's is the accountant's job.
 */
const GSTIN_RE = /^\d{2}[A-Z]{5}\d{4}[A-Z][0-9A-Z]Z[0-9A-Z]$/;

/**
 * Presence and validity of every GST/seller field, with no values in the
 * result. The source is injectable so the rules can be unit-tested; the default
 * reads the real environment through an indirection so no secret is logged.
 */
export function gstConfigStatus(
  source: EnvLike = process.env as unknown as EnvLike
): GstConfigStatus {
  const value = (key: GstEnvKey): string =>
    String(source?.[key] ?? "").trim();

  const fields: GstFieldStatus[] = GST_ENV_KEYS.map((key) => {
    const raw = value(key);
    const present = raw.length > 0;
    let valid = present;
    if (present) {
      switch (key) {
        case "SELLER_GSTIN":
          valid = GSTIN_RE.test(raw.toUpperCase());
          break;
        case "GST_RATE": {
          const rate = Number(raw);
          valid = Number.isFinite(rate) && rate >= 0 && rate <= 100;
          break;
        }
        case "SELLER_HOME_STATE":
        case "SELLER_LEGAL_NAME":
        case "SELLER_ADDRESS":
        case "HSN_SAC_DEFAULT":
          // Presence only. Inventing a state code, an HSN or a legal identity
          // would be worse than reporting the field as unfilled.
          valid = raw.length > 0;
          break;
      }
    }
    return { key, present, valid };
  });

  const missing = fields.filter((f) => !f.present).map((f) => f.key);
  const invalid = fields
    .filter((f) => f.present && !f.valid)
    .map((f) => f.key);
  return {
    ready: missing.length === 0 && invalid.length === 0,
    fields,
    missing,
    invalid,
  };
}

/** Whether the operator has started supplying seller/GST configuration. */
export function hasAnyGstConfig(source: EnvLike): boolean {
  return GST_ENV_KEYS.some((key) => String(source?.[key] ?? "").trim().length > 0);
}

export { taxLabel };
export type { TaxBreakdown };
