-- Migration 005 — notification retry scheduling + verified SES delivery events.
-- ADDITIVE, idempotent, forward-recovery migration. No business data is altered.
--
-- Scope / safety
-- --------------
-- ADDITIVE ONLY. Every DDL statement is IF NOT EXISTS. No column is dropped, no
-- existing value is rewritten, no business row is deleted. The historical
-- `status` column keeps its six-value CHECK constraint untouched: retry state
-- lives in NEW columns (`delivery_status`, `attempts`, ...), so an old row or an
-- old writer keeps working exactly as before.
--
-- Forward recovery
-- ----------------
-- The production runner (apps/storefront/scripts/migrate.mjs) applies this whole
-- file and its schema_migrations checkpoint in ONE transaction behind an
-- advisory lock. If any statement fails, nothing is recorded; rerun
--   `cd apps/storefront && node scripts/migrate.mjs`
-- after fixing the cause (e.g. a lock timeout). Because every statement is
-- idempotent, a partially-applied state left by a non-transactional run is also
-- safe to re-apply: existing columns/tables/indexes are left as they are and the
-- remaining ones are created. `node scripts/migrate.mjs --verify` confirms the
-- checkpoint. There is no DOWN migration by design — this change never removes
-- data, so rollback is a code change, not a schema reversal.

-- Order independence: `app_notification` is owned by the backend module and
-- normally exists before this runs (compose makes storefront depend on a healthy
-- backend). Create a compatible base table if it is missing so a standalone or
-- reordered storefront migration cannot fail with 42P01. The backend's own
-- `CREATE TABLE IF NOT EXISTS` and the `event_key`/`deleted_at` migrations are
-- idempotent, so this is a no-op in the normal ordered deploy. Column types and
-- defaults mirror the backend create-table migration exactly.
CREATE TABLE IF NOT EXISTS "app_notification" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "recipient" text NOT NULL,
  "channel" text NOT NULL DEFAULT 'email',
  "template" text NOT NULL,
  "data" jsonb,
  "status" text NOT NULL DEFAULT 'pending',
  "provider_message_id" text,
  "error_message" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

-- Retry scheduling on the existing outbox row. Defaults are chosen so that rows
-- written before this migration read as "not retried, not scheduled" and are
-- never picked up by a retry worker until an operator or a failure plans one.
ALTER TABLE "app_notification"
  ADD COLUMN IF NOT EXISTS "attempts" integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "max_attempts" integer NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS "next_attempt_at" timestamptz,
  ADD COLUMN IF NOT EXISTS "last_error" text,
  ADD COLUMN IF NOT EXISTS "error_kind" text,
  ADD COLUMN IF NOT EXISTS "last_attempt_at" timestamptz,
  ADD COLUMN IF NOT EXISTS "delivery_status" text NOT NULL DEFAULT 'queued',
  ADD COLUMN IF NOT EXISTS "terminal_reason" text,
  ADD COLUMN IF NOT EXISTS "dead_lettered_at" timestamptz,
  ADD COLUMN IF NOT EXISTS "suppressed" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "last_delivery_event_at" timestamptz,
  -- Claim/lease: a worker owns a due row only until lease_until. A process that
  -- dies mid-send leaves a lease that expires, so the next run can reclaim it.
  ADD COLUMN IF NOT EXISTS "lease_owner" text,
  ADD COLUMN IF NOT EXISTS "lease_until" timestamptz;

-- Index for the worker's "due rows" scan and for provider-id lookups from SES
-- delivery events. Partial indexes keep them small.
CREATE INDEX IF NOT EXISTS idx_app_notification_retry_due
  ON "app_notification" ("next_attempt_at", "created_at")
  WHERE "delivery_status" = 'retrying';

CREATE INDEX IF NOT EXISTS idx_app_notification_provider_message
  ON "app_notification" ("provider_message_id")
  WHERE "provider_message_id" IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_app_notification_delivery_status
  ON "app_notification" ("delivery_status");

-- One row per verified provider event. The UNIQUE(provider, provider_event_id)
-- pair is the dedupe boundary: SNS redelivery of the same MessageId can never
-- write a second delivery/bounce effect.
CREATE TABLE IF NOT EXISTS "notification_event" (
  "id"               text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "provider"         text NOT NULL DEFAULT 'ses',
  "provider_event_id" text NOT NULL,
  "event_type"       text NOT NULL,
  "message_id"       text,
  "notification_id"  text,
  "bounce_type"      text,
  "received_at"      timestamptz NOT NULL DEFAULT now(),
  UNIQUE ("provider", "provider_event_id")
);

CREATE INDEX IF NOT EXISTS idx_notification_event_message
  ON "notification_event" ("message_id");

-- Suppression list. Recipients are stored because a future send must be able to
-- check them, but they are NEVER written to application logs (GAP-05/07 PII rule).
-- The default policy (hard bounce / complaint) is documented in
-- lib/notifications.ts and is owner-configurable via SES_SUPPRESS_ON_* flags.
CREATE TABLE IF NOT EXISTS "notification_suppression" (
  "id"         text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "recipient"  text NOT NULL,
  "reason"     text NOT NULL CHECK (reason IN ('hard_bounce','complaint')),
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_notification_suppression_recipient
  ON "notification_suppression" (lower("recipient"));
