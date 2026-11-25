-- 010 — commercial readiness and physical shipping data
--
-- Additive migration: new tables and one new unique index; no existing column,
-- row or constraint is altered. See the forward-recovery note at the end.
--
-- WHY THIS MIGRATION EXISTS
--
-- Two gaps allowed the platform to look operational while the underlying
-- business facts were unknown:
--
--   1. A partner could be flipped to `active` and start transacting with no
--      signed agreement and no approved commission/payout configuration. The
--      status enum was enforced, but nothing required the commercial terms to
--      exist first.
--
--   2. The shipment builder derived weight and package dimensions from a guess
--      (`0.5 kg per item`, `10x10x5 cm`). Shiprocket needs real physical data:
--      a wrong weight produces a wrong courier rate and can invalidate a claim,
--      and a fabricated dimension cannot be reconciled with the parcel that was
--      actually handed over.
--
-- Nothing here invents business data. These tables start EMPTY, and both
-- workflows fail closed until the owner supplies real values:
--
--   * activation requires a signed, in-force agreement AND an approved
--     commercial configuration (see lib/admin-partners/commercial.ts);
--   * shipment creation requires verified weight/dimensions per product and
--     refuses to book rather than substitute defaults (see
--     lib/shipping/product-physical.ts).
--
-- Additive only: no column is dropped or rewritten, and existing rows are
-- untouched, so historical partner/order data keeps working.
--
-- Forward recovery: this migration only CREATEs new tables and one new unique
-- index. Rolling forward is safe to re-run (every statement is IF NOT EXISTS).
-- Rolling back the code without the tables is also safe — the application treats
-- a missing agreement/config row as "not commercially ready" and refuses to
-- activate, and a missing measurement as "cannot ship", so an older build cannot
-- accidentally ship with guessed data. To undo the schema, drop
-- product_shipping_data, partner_commercial_config, partner_agreement and the
-- uq_partner_product_product index; no existing column or row changes.

-- ── marketplace partner agreements ────────────────────────────────────────
--
-- NAMING: this is deliberately NOT called `partner_agreement`. The Medusa
-- artist module already owns a table by that name
-- (apps/backend/src/modules/artist/migrations/20261105000001-create-artist-tables.ts),
-- keyed by artist_id with version/effective_date/expiry_date semantics. That
-- table records agreements with ARTISTS; this one records the COMMERCIAL
-- agreement that lets a marketplace partner transact. Merging them would couple
-- two different approvals, so the names are kept distinct on purpose.
--
-- One row per agreement revision. The latest in-force signed row is what the
-- activation gate reads. `document_ref` is a pointer into the owner's document
-- store (a path or a contract system id) — never the agreement text itself, so
-- no personal or commercial terms are duplicated into this database.
CREATE TABLE IF NOT EXISTS marketplace_partner_agreement (
  id                  text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  partner_id          text NOT NULL REFERENCES partner(id) ON DELETE CASCADE,
  agreement_reference text NOT NULL,
  status              text NOT NULL DEFAULT 'draft'
                      CHECK (status IN ('draft','signed','expired','terminated')),
  signed_on           date,
  effective_from      date,
  effective_to        date,
  document_ref        text,
  approved_by         text,
  approved_at         timestamptz,
  notes               text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  -- A "signed" agreement without a reference, a signing date or an effective
  -- date is not evidence of anything, so the database rejects it rather than
  -- letting the application carry an unprovable row.
  CONSTRAINT marketplace_partner_agreement_signed_fields CHECK (
    status <> 'signed'
    OR (agreement_reference <> '' AND signed_on IS NOT NULL AND effective_from IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_marketplace_partner_agreement_partner
  ON marketplace_partner_agreement (partner_id, status, effective_to);

-- ── approved commercial configuration ──────────────────────────────────────
-- The commission rate itself lives in `commission_policy` (migration 003) and
-- is referenced, not copied: one policy row per scoped decision, auditable and
-- reusable. This table records that the owner APPROVED that policy for this
-- partner, together with payout terms.
CREATE TABLE IF NOT EXISTS partner_commercial_config (
  id                   text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  partner_id           text NOT NULL UNIQUE REFERENCES partner(id) ON DELETE CASCADE,
  commission_policy_id text REFERENCES commission_policy(id) ON DELETE RESTRICT,
  payout_frequency     text CHECK (payout_frequency IN
                        ('weekly','fortnightly','monthly','on_demand')),
  payout_terms         text,
  effective_from       date,
  approved_by          text,
  approved_at          timestamptz,
  -- Approval must be attributable. A configuration with no approver is a draft,
  -- and a draft must never enable settlement.
  CONSTRAINT partner_commercial_config_approval CHECK (
    approved_by IS NULL
    OR (approved_at IS NOT NULL AND commission_policy_id IS NOT NULL
        AND payout_frequency IS NOT NULL AND effective_from IS NOT NULL)
  ),
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_partner_commercial_config_partner
  ON partner_commercial_config (partner_id);

-- ── verified physical data per product ─────────────────────────────────────
-- Keyed by Medusa product id (the same stable id used by `partner_product`),
-- not by display name or tag. `source` records where the measurement came from
-- so a later reviewer can tell an owner-verified measurement from an import.
CREATE TABLE IF NOT EXISTS product_shipping_data (
  product_id   text PRIMARY KEY,
  weight_grams integer NOT NULL CHECK (weight_grams > 0),
  length_cm    numeric(8,2) NOT NULL CHECK (length_cm > 0),
  breadth_cm   numeric(8,2) NOT NULL CHECK (breadth_cm > 0),
  height_cm    numeric(8,2) NOT NULL CHECK (height_cm > 0),
  source       text NOT NULL DEFAULT 'owner'
               CHECK (source IN ('owner','import','measured')),
  verified_by  text NOT NULL,
  verified_at  timestamptz NOT NULL DEFAULT now(),
  notes        text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- ── unresolved product ownership queue ─────────────────────────────────────
-- A product sold through the marketplace must have exactly one owning partner.
-- `partner_product` already enforces one row per (partner, product), but nothing
-- stopped a *second* partner claiming the same product id. This index makes
-- double-claiming impossible at the database level, which is what the
-- "unresolved ownership" queue depends on: any marketplace-enabled product with
-- no `partner_product` row is unambiguously unowned.
CREATE UNIQUE INDEX IF NOT EXISTS uq_partner_product_product
  ON partner_product (product_id);
