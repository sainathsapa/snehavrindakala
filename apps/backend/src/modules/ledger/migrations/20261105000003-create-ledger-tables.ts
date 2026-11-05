/**
 * Migration: create ledger module tables.
 */
export const up = `
  CREATE TABLE IF NOT EXISTS "earnings_ledger_entry" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "partner_id" text NOT NULL,
    "source_type" text NOT NULL,
    "source_id" text NOT NULL,
    "gross_basis" numeric NOT NULL DEFAULT 0,
    "deductions" numeric NOT NULL DEFAULT 0,
    "fee_share" numeric NOT NULL DEFAULT 0,
    "currency" text NOT NULL DEFAULT 'INR',
    "state" text NOT NULL DEFAULT 'pending',
    "audit_metadata" jsonb,
    "created_at" timestamptz NOT NULL DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS "payout_batch" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "partner_id" text NOT NULL,
    "period_start" text NOT NULL,
    "period_end" text NOT NULL,
    "line_item_count" integer NOT NULL DEFAULT 0,
    "total_amount_minor" numeric NOT NULL DEFAULT 0,
    "currency" text NOT NULL DEFAULT 'INR',
    "provider_reference" text,
    "status" text NOT NULL DEFAULT 'draft',
    "approved_by" text,
    "reconciled_at" timestamptz,
    "created_at" timestamptz NOT NULL DEFAULT now(),
    "updated_at" timestamptz NOT NULL DEFAULT now()
  );

  CREATE INDEX IF NOT EXISTS idx_ledger_entry_partner_id ON "earnings_ledger_entry"("partner_id");
  CREATE INDEX IF NOT EXISTS idx_ledger_entry_state ON "earnings_ledger_entry"("state");
  CREATE INDEX IF NOT EXISTS idx_ledger_entry_source ON "earnings_ledger_entry"("source_type", "source_id");
  CREATE INDEX IF NOT EXISTS idx_payout_batch_partner_id ON "payout_batch"("partner_id");
  CREATE INDEX IF NOT EXISTS idx_payout_batch_status ON "payout_batch"("status");
`;

export const down = `
  DROP TABLE IF EXISTS "payout_batch" CASCADE;
  DROP TABLE IF EXISTS "earnings_ledger_entry" CASCADE;
`;
