-- Migration 004 — payment reconciliation + provider refund execution.
-- Additive only. Works alongside the existing `processed_payments`, `order_refunds`
-- and `order_shipments` tables without altering them.

-- Every provider webhook/event is recorded once by its provider event id. This
-- is the dedupe boundary: a redelivered event can never create a second order
-- or a second ledger effect.
CREATE TABLE IF NOT EXISTS payment_event (
  id             text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  provider       text NOT NULL DEFAULT 'razorpay',
  provider_event_id text NOT NULL,
  event_type     text NOT NULL,
  order_id       text,
  payment_id     text,
  payload_hash   text NOT NULL,
  status         text NOT NULL DEFAULT 'received'
                 CHECK (status IN ('received','processing','processed','failed','ignored')),
  attempts       integer NOT NULL DEFAULT 0,
  last_error     text,
  received_at    timestamptz NOT NULL DEFAULT now(),
  processed_at   timestamptz,
  UNIQUE (provider, provider_event_id)
);

CREATE INDEX IF NOT EXISTS idx_payment_event_status ON payment_event (status);
CREATE INDEX IF NOT EXISTS idx_payment_event_order ON payment_event (order_id);

-- Browser-abandoned / missed-webhook / inconsistent payments are tracked here
-- until resolved by the scheduled reconciler using the provider API.
CREATE TABLE IF NOT EXISTS payment_reconciliation_issue (
  id           text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  order_id     text NOT NULL,
  payment_id   text,
  issue_type   text NOT NULL CHECK (issue_type IN
               ('captured_unconfirmed','authorized_unconfirmed','failed_order_created',
                'duplicate_payment','amount_mismatch','webhook_missed')),
  status       text NOT NULL DEFAULT 'open'
               CHECK (status IN ('open','retrying','resolved','escalated')),
  attempts     integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_error   text,
  resolution   text,
  resolved_at  timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recon_issue_status ON payment_reconciliation_issue (status, next_attempt_at);
CREATE INDEX IF NOT EXISTS idx_recon_issue_order ON payment_reconciliation_issue (order_id);

-- Provider refund execution is a separate, auditable record. An internal
-- approval (`order_refunds.approved_by`) does NOT mean money moved; only a
-- provider_confirmed status with a provider_refund_id means real money moved.
CREATE TABLE IF NOT EXISTS refund_execution (
  id                text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  refund_request_id text REFERENCES order_refunds(id) ON DELETE SET NULL,
  order_id          text NOT NULL,
  partner_id        text,
  amount            integer NOT NULL,
  currency          text NOT NULL DEFAULT 'INR',
  status            text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','approved','initiated','provider_confirmed',
                                      'failed','reversed')),
  requested_by      text NOT NULL,
  approved_by       text NOT NULL,
  CHECK (requested_by <> approved_by), -- dual control: requester != approver
  idempotency_key   text NOT NULL UNIQUE,
  provider          text NOT NULL DEFAULT 'razorpay',
  provider_refund_id text,
  provider_response jsonb,
  ledger_reversal_key text,
  inventory_restored boolean NOT NULL DEFAULT false,
  failure_reason    text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_refund_exec_order ON refund_execution (order_id);
CREATE INDEX IF NOT EXISTS idx_refund_exec_status ON refund_execution (status);
