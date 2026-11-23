-- 006_role_namespacing.sql — PARTITION THE ROLE NAMESPACE (GAP-01 closure)
--
-- Additive, idempotent, forward-recovery migration. It widens the allowed role
-- values on partner_membership so the portal can persist namespaced partner
-- roles. It DOES NOT modify, delete or reassign any existing business row: every
-- existing membership keeps its stored role string and identity. Code in
-- lib/partner/types.ts, lib/partner/context.ts and lib/partner/session.ts maps
-- legacy and canonical values through the same partner-only guard and returns
-- the stable canonical `partner_*` value at resolution time.
--
-- Convention (applied across the codebase):
--   platform (admin/users) roles: platform_super_admin, platform_admin,
--     platform_manager, platform_operations, platform_finance, platform_support,
--     platform_viewer, plus the stable tenant-scoped `partner` role.
--   partner portal roles: partner_owner, partner_manager, partner_operations,
--     partner_finance, partner_viewer.
--   The two domains are disjoint; a partner value can never be evaluated by the
--   platform permission matrix and vice versa (fail closed).
--
-- Explicit legacy -> canonical mapping (implemented in code, documented here):
--   owner->partner_owner  manager->partner_manager  operations->partner_operations
--   finance->partner_finance  viewer->partner_viewer
--   super_admin->platform_super_admin  admin->platform_admin
--   manager->platform_manager  operations->platform_operations
--   finance->platform_finance  support->platform_support  viewer->platform_viewer
--   partner->partner (stable value, unchanged)
-- Note that bare `manager`/`operations`/`finance`/`viewer` are ambiguous: they
-- map to the PARTNER role inside the partner boundary and to the PLATFORM role
-- inside the admin boundary. They are never handed to the wrong matrix because
-- canonicalisation happens at the trusted boundary, before any permission check.
-- An ambiguous record is therefore never SILENTLY granted elevated (platform)
-- access: a partner row with legacy `finance` resolves only to partner_finance
-- permissions.
--
-- Transition policy: BOTH legacy and canonical values remain valid during the
-- rollout. New writes from the portal use canonical `partner_*` values; old rows
-- keep their legacy value and are canonicalised on every read. Once every
-- writer is upgraded, a later migration may narrow the allow-list to canonical
-- values only (a separate, explicitly reviewed change).
--
-- Forward recovery: if this migration is wrong, correct it in a later-numbered
-- migration (never edit this file or its recorded checksum). A bad migrate
-- rolls back the whole transaction automatically; otherwise recovery is a
-- database restore from the pre-deploy backup. No business data is removed.
--
-- Why a constraint is replaced: PostgreSQL cannot "add values" to an existing
-- CHECK. Migration 002 created an inline CHECK limited to the five legacy role
-- names (auto-named partner_membership_role_check). To admit the namespaced
-- values we drop only that legacy CHECK and immediately add a WIDER one that
-- still permits every legacy value. This happens inside the runner's single
-- transaction under the advisory lock, so there is no window in which invalid
-- roles can be written, and no row or column is ever dropped.

DO $$
DECLARE
  c RECORD;
BEGIN
  -- Remove only the legacy, non-namespaced role CHECK(s). The replacement below
  -- contains 'partner_owner', so it is never matched by this loop (idempotent).
  FOR c IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'partner_membership'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%role%'
      AND pg_get_constraintdef(oid) NOT ILIKE '%partner_owner%'
  LOOP
    EXECUTE format('ALTER TABLE partner_membership DROP CONSTRAINT %I', c.conname);
  END LOOP;

  -- Widen the allow-list: canonical partner roles + legacy aliases.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'partner_membership'::regclass
      AND conname = 'partner_membership_role_namespaced_check'
  ) THEN
    ALTER TABLE partner_membership
      ADD CONSTRAINT partner_membership_role_namespaced_check
      CHECK (role IN (
        'partner_owner', 'partner_manager', 'partner_operations',
        'partner_finance', 'partner_viewer',
        'owner', 'manager', 'operations', 'finance', 'viewer'
      ));
  END IF;
END $$;

-- Admin/platform roles (admin_users.role) have NO CHECK constraint in the
-- baseline schema, so canonical `platform_*` values need no DDL here. Existing
-- admin rows keep their legacy role; getAdminIdentity() canonicalises them via
-- canonicalPlatformRole() before any permission check.
