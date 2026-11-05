/**
 * Migration: create commission module tables.
 */
export const up = `
  CREATE TABLE IF NOT EXISTS "commission_request" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "reference_id" text NOT NULL UNIQUE,
    "customer_id" uuid,
    "art_form" text NOT NULL,
    "brief" text NOT NULL,
    "intended_use" text,
    "dimensions" text,
    "budget_range" text,
    "target_date" timestamptz,
    "delivery_region" text,
    "delivery_pin" text,
    "status" text NOT NULL DEFAULT 'New',
    "assigned_artist_id" uuid,
    "metadata" jsonb,
    "created_at" timestamptz NOT NULL DEFAULT now(),
    "updated_at" timestamptz NOT NULL DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS "commission_attachment" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "commission_request_id" uuid NOT NULL REFERENCES "commission_request"("id") ON DELETE CASCADE,
    "object_key" text NOT NULL,
    "mime_type" text NOT NULL,
    "size_bytes" integer NOT NULL,
    "original_filename" text,
    "scan_complete" boolean NOT NULL DEFAULT false,
    "scan_passed" boolean NOT NULL DEFAULT false,
    "scan_result" text,
    "retention_delete_at" timestamptz,
    "created_at" timestamptz NOT NULL DEFAULT now(),
    "updated_at" timestamptz NOT NULL DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS "commission_quote" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "commission_request_id" uuid NOT NULL REFERENCES "commission_request"("id") ON DELETE CASCADE,
    "version" integer NOT NULL DEFAULT 1,
    "scope" text NOT NULL,
    "deliverables" text,
    "total_minor" integer NOT NULL DEFAULT 0,
    "tax_minor" integer NOT NULL DEFAULT 0,
    "fee_share_minor" integer NOT NULL DEFAULT 0,
    "deposit_rules" jsonb,
    "milestone_schedule" jsonb,
    "status" text NOT NULL DEFAULT 'draft',
    "expiry_at" timestamptz,
    "medusa_order_id" text,
    "created_at" timestamptz NOT NULL DEFAULT now(),
    "updated_at" timestamptz NOT NULL DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS "commission_milestone" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "commission_request_id" uuid NOT NULL REFERENCES "commission_request"("id") ON DELETE CASCADE,
    "commission_quote_id" uuid REFERENCES "commission_quote"("id") ON DELETE SET NULL,
    "name" text NOT NULL,
    "sequence" integer NOT NULL DEFAULT 0,
    "description" text,
    "due_date" timestamptz,
    "status" text NOT NULL DEFAULT 'pending',
    "proof_object_key" text,
    "approval_record" jsonb,
    "created_at" timestamptz NOT NULL DEFAULT now(),
    "updated_at" timestamptz NOT NULL DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS "commission_revision" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "commission_request_id" uuid NOT NULL REFERENCES "commission_request"("id") ON DELETE CASCADE,
    "milestone_id" uuid NOT NULL REFERENCES "commission_milestone"("id") ON DELETE CASCADE,
    "revision_number" integer NOT NULL DEFAULT 1,
    "customer_brief" text,
    "artist_response" text,
    "approval_record" jsonb,
    "created_at" timestamptz NOT NULL DEFAULT now(),
    "updated_at" timestamptz NOT NULL DEFAULT now()
  );

  CREATE INDEX IF NOT EXISTS idx_commission_request_reference_id ON "commission_request"("reference_id");
  CREATE INDEX IF NOT EXISTS idx_commission_request_customer_id ON "commission_request"("customer_id");
  CREATE INDEX IF NOT EXISTS idx_commission_request_status ON "commission_request"("status");
  CREATE INDEX IF NOT EXISTS idx_commission_request_assigned_artist_id ON "commission_request"("assigned_artist_id");
  CREATE INDEX IF NOT EXISTS idx_commission_quote_request_id ON "commission_quote"("commission_request_id");
  CREATE INDEX IF NOT EXISTS idx_commission_milestone_request_id ON "commission_milestone"("commission_request_id");
  CREATE INDEX IF NOT EXISTS idx_commission_revision_milestone_id ON "commission_revision"("milestone_id");
`;

export const down = `
  DROP TABLE IF EXISTS "commission_revision" CASCADE;
  DROP TABLE IF EXISTS "commission_milestone" CASCADE;
  DROP TABLE IF EXISTS "commission_quote" CASCADE;
  DROP TABLE IF EXISTS "commission_attachment" CASCADE;
  DROP TABLE IF EXISTS "commission_request" CASCADE;
`;
