/**
 * Migration: create audit_record table.
 */
export const up = `
  CREATE TABLE IF NOT EXISTS "audit_record" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "actor" text NOT NULL,
    "actor_role" text,
    "action" text NOT NULL,
    "entity" text NOT NULL,
    "entity_id" text NOT NULL,
    "before" jsonb,
    "after" jsonb,
    "request_correlation_id" text,
    "timestamp" timestamptz NOT NULL DEFAULT now()
  );

  CREATE INDEX IF NOT EXISTS idx_audit_record_entity ON "audit_record"("entity", "entity_id");
  CREATE INDEX IF NOT EXISTS idx_audit_record_actor ON "audit_record"("actor");
  CREATE INDEX IF NOT EXISTS idx_audit_record_timestamp ON "audit_record"("timestamp");
`;

export const down = `
  DROP TABLE IF EXISTS "audit_record" CASCADE;
`;
