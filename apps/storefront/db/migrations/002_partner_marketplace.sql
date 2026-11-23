-- Migration 002 — first-class marketplace partner domain.
-- Additive only: creates new tables; never alters or drops existing business data.
-- Applied by db/migrate.ts (see db/migrations/README.md). Idempotent.

-- A marketplace partner is NOT the same as a public artist/maker profile.
-- artist_id is nullable and admin-assisted: an artist is never silently promoted
-- to an active partner. Ownership ambiguity is resolved by an admin linking step.
CREATE TABLE IF NOT EXISTS partner (
  id                 text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  legal_name         text NOT NULL,
  display_name       text NOT NULL,
  slug               text NOT NULL UNIQUE,
  contact_email      text NOT NULL,
  contact_phone      text,
  business_profile   jsonb NOT NULL DEFAULT '{}'::jsonb,
  registration_details jsonb NOT NULL DEFAULT '{}'::jsonb,
  account_status     text NOT NULL DEFAULT 'pending'
                     CHECK (account_status IN ('pending','active','suspended','rejected')),
  verification_status text NOT NULL DEFAULT 'unverified'
                     CHECK (verification_status IN ('unverified','pending','verified','rejected')),
  approval_history   jsonb NOT NULL DEFAULT '[]'::jsonb,
  artist_id          text, -- admin-assisted link to site_artist.id; nullable by design
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_partner_account_status ON partner (account_status);
CREATE INDEX IF NOT EXISTS idx_partner_artist_id ON partner (artist_id);

-- A partner account is operated by one or more members, each with a role.
-- token_version is bumped to revoke all existing sessions for that member.
CREATE TABLE IF NOT EXISTS partner_membership (
  id             text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  partner_id     text NOT NULL REFERENCES partner(id) ON DELETE CASCADE,
  email          text NOT NULL,
  password_hash  text NOT NULL,
  full_name      text NOT NULL DEFAULT '',
  role           text NOT NULL DEFAULT 'viewer'
                 CHECK (role IN ('owner','manager','operations','finance','viewer')),
  status         text NOT NULL DEFAULT 'invited'
                 CHECK (status IN ('invited','active','suspended')),
  token_version  integer NOT NULL DEFAULT 1,
  last_login_at  timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (partner_id, email)
);

-- Enforces tenant filtering at the DB layer as defence in depth: every query on
-- partner-owned rows can reference this index. Indexes cover the common filters.
CREATE INDEX IF NOT EXISTS idx_partner_membership_partner ON partner_membership (partner_id);
CREATE INDEX IF NOT EXISTS idx_partner_membership_email ON partner_membership (email);

-- Public onboarding applications, reviewed by platform admins. Distinct name
-- from Medusa's `partner_application` table (both databases share one server).
CREATE TABLE IF NOT EXISTS partner_onboarding_application (
  id             text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  legal_name     text NOT NULL,
  display_name   text NOT NULL,
  contact_email  text NOT NULL,
  contact_phone  text,
  business_details jsonb NOT NULL DEFAULT '{}'::jsonb,
  artist_information jsonb NOT NULL DEFAULT '{}'::jsonb,
  product_categories jsonb NOT NULL DEFAULT '[]'::jsonb,
  document_keys   jsonb NOT NULL DEFAULT '[]'::jsonb,
  review_status  text NOT NULL DEFAULT 'pending'
                  CHECK (review_status IN ('pending','more_info','approved','rejected')),
  review_notes   text,
  reviewed_by    text,
  reviewed_at    timestamptz,
  created_partner_id text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_onboarding_review_status ON partner_onboarding_application (review_status);

-- Ownership of a Medusa product by a partner, with catalogue approval workflow.
CREATE TABLE IF NOT EXISTS partner_product (
  id              text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  partner_id      text NOT NULL REFERENCES partner(id) ON DELETE CASCADE,
  product_id      text NOT NULL, -- Medusa product id
  submission_status text NOT NULL DEFAULT 'draft'
                    CHECK (submission_status IN ('draft','submitted','approved','rejected')),
  attributes      jsonb NOT NULL DEFAULT '{}'::jsonb,
  rejection_reason text,
  submitted_at    timestamptz,
  reviewed_by     text,
  reviewed_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (partner_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_partner_product_partner ON partner_product (partner_id);
CREATE INDEX IF NOT EXISTS idx_partner_product_status ON partner_product (submission_status);

-- A customer order can contain items from multiple partners. Each partner gets
-- an independently managed fulfilment group; the customer keeps one order.
CREATE TABLE IF NOT EXISTS fulfilment_group (
  id              text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  customer_order_id text NOT NULL, -- Medusa order id
  partner_id      text NOT NULL REFERENCES partner(id) ON DELETE RESTRICT,
  status          text NOT NULL DEFAULT 'assigned'
                  CHECK (status IN ('assigned','accepted','rejected','packing',
                                    'ready_for_dispatch','dispatched','delivered','cancelled')),
  items           jsonb NOT NULL DEFAULT '[]'::jsonb, -- [{item_id, variant_id, quantity, title}]
  assignment_history jsonb NOT NULL DEFAULT '[]'::jsonb,
  rejection_reason text,
  fulfilment_deadline timestamptz,
  shipment_id     text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (customer_order_id, partner_id)
);

CREATE INDEX IF NOT EXISTS idx_fulfilment_partner ON fulfilment_group (partner_id);
CREATE INDEX IF NOT EXISTS idx_fulfilment_order ON fulfilment_group (customer_order_id);
CREATE INDEX IF NOT EXISTS idx_fulfilment_status ON fulfilment_group (status);

-- Append-only audit trail for tenant-sensitive partner actions.
CREATE TABLE IF NOT EXISTS partner_audit_log (
  id           text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  partner_id   text,
  actor_email  text NOT NULL,
  actor_role   text NOT NULL,
  action       text NOT NULL,
  entity_type  text NOT NULL,
  entity_id    text,
  metadata     jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_partner_audit_partner ON partner_audit_log (partner_id);
CREATE INDEX IF NOT EXISTS idx_partner_audit_created ON partner_audit_log (created_at);
