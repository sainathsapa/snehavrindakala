/**
 * Migration: create earnings_ledger_entry table.
 */
export const up = `
  CREATE TABLE IF NOT EXISTS "earnings_ledger_entry" (
    "id" text PRIMARY KEY,
    "partner_id" text NOT NULL,
    "source_type" text NOT NULL,
    "source_id" text NOT NULL,
    "gross_basis" numeric NOT NULL DEFAULT 0,
    "deductions" numeric NOT NULL DEFAULT 0,
    "fee_share" numeric NOT NULL DEFAULT 0,
    "currency" text NOT NULL DEFAULT 'INR',
    "state" text NOT NULL DEFAULT 'pending',
    "audit_metadata" text,
    "created_at" timestamptz NOT NULL DEFAULT now()
  );
`;

export const down = `
  DROP TABLE IF EXISTS "earnings_ledger_entry" CASCADE;
`;
