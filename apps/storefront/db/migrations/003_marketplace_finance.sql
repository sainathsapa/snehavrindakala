-- Migration 003 — commission policy, immutable earnings ledger, settlements.
-- Additive only. Business rates are NEVER seeded here; a policy must be created
-- and approved by an authorized admin before any settlement can be enabled.

CREATE TABLE IF NOT EXISTS commission_policy (
  id            text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name          text NOT NULL,
  scope         text NOT NULL CHECK (scope IN ('global','partner','category','product')),
  scope_ref     text, -- partner/category/product id when scope != global
  rate_basis    text NOT NULL CHECK (rate_basis IN
                 ('gross_item_value','discounted_item_value')),
  tax_included  boolean NOT NULL DEFAULT false,
  shipping_included boolean NOT NULL DEFAULT false,
  rate_percent  numeric(6,3), -- 0..100, null when fixed_amount is used
  fixed_amount  numeric(14,2), -- per item, null when rate_percent is used
  currency      text NOT NULL DEFAULT 'INR',
  refund_effect text NOT NULL DEFAULT 'reverse_earnings'
                CHECK (refund_effect IN ('reverse_earnings','no_reversal')),
  payable_when  text NOT NULL DEFAULT 'order_delivered'
                CHECK (payable_when IN ('order_paid','order_delivered','return_window_elapsed')),
  status        text NOT NULL DEFAULT 'draft'
                CHECK (status IN ('draft','approved','active','archived')),
  version       integer NOT NULL DEFAULT 1,
  effective_from timestamptz,
  effective_to   timestamptz,
  approved_by    text,
  approved_at    timestamptz,
  created_by     text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CHECK ((rate_percent IS NOT NULL) <> (fixed_amount IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS idx_commission_policy_status ON commission_policy (status);
CREATE INDEX IF NOT EXISTS idx_commission_policy_scope ON commission_policy (scope, scope_ref);

-- Immutable, append-only ledger. Corrections are new reversal/adjustment rows
-- linked by reverses_entry_id, never UPDATEs of historical money values.
CREATE TABLE IF NOT EXISTS partner_earnings_ledger (
  id                text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  partner_id        text NOT NULL REFERENCES partner(id) ON DELETE RESTRICT,
  order_id          text NOT NULL,
  item_id           text NOT NULL,
  entry_type        text NOT NULL CHECK (entry_type IN ('earning','refund_reversal','adjustment')),
  gross_basis       numeric(14,2) NOT NULL,
  discount          numeric(14,2) NOT NULL DEFAULT 0,
  tax_amount        numeric(14,2) NOT NULL DEFAULT 0,
  shipping_amount   numeric(14,2) NOT NULL DEFAULT 0,
  commission_amount numeric(14,2) NOT NULL,
  payable_amount    numeric(14,2) NOT NULL,
  currency          text NOT NULL DEFAULT 'INR',
  commission_policy_id text REFERENCES commission_policy(id) ON DELETE SET NULL,
  reverses_entry_id text REFERENCES partner_earnings_ledger(id) ON DELETE RESTRICT,
  settlement_batch_id text,
  idempotency_key   text NOT NULL UNIQUE,
  metadata          jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_earnings_partner ON partner_earnings_ledger (partner_id);
CREATE INDEX IF NOT EXISTS idx_earnings_order ON partner_earnings_ledger (order_id);
CREATE INDEX IF NOT EXISTS idx_earnings_batch ON partner_earnings_ledger (settlement_batch_id);

CREATE TABLE IF NOT EXISTS settlement_batch (
  id              text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  status          text NOT NULL DEFAULT 'calculated'
                  CHECK (status IN ('calculated','approved','payment_initiated',
                                    'payment_completed','payment_failed')),
  period_start    timestamptz NOT NULL,
  period_end      timestamptz NOT NULL,
  currency        text NOT NULL DEFAULT 'INR',
  total_amount    numeric(14,2) NOT NULL DEFAULT 0,
  line_count      integer NOT NULL DEFAULT 0,
  approved_by     text,
  approved_at     timestamptz,
  payment_initiated_by text,
  provider        text,
  payout_reference text,
  provider_confirmation jsonb,
  failure_reason  text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_settlement_status ON settlement_batch (status);

CREATE TABLE IF NOT EXISTS settlement_batch_item (
  id          text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  batch_id    text NOT NULL REFERENCES settlement_batch(id) ON DELETE CASCADE,
  partner_id  text NOT NULL REFERENCES partner(id) ON DELETE RESTRICT,
  ledger_entry_id text NOT NULL REFERENCES partner_earnings_ledger(id) ON DELETE RESTRICT,
  amount      numeric(14,2) NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (batch_id, ledger_entry_id)
);

CREATE INDEX IF NOT EXISTS idx_batch_item_partner ON settlement_batch_item (partner_id);
CREATE INDEX IF NOT EXISTS idx_batch_item_batch ON settlement_batch_item (batch_id);
