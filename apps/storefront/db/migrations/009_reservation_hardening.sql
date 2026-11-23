-- Migration 009 — Reservation hardening (GAP-06).
-- Additive, idempotent, no data deletion or alteration. Applied by db/migrate.ts
-- after db/schema.sql; re-running is a no-op.
--
-- WHY A PARTIAL UNIQUE INDEX, AND THE CHOSEN SCOPE
-- ------------------------------------------------
-- The shipped schema has only NON-unique btree indexes on stock_reservation;
-- there is no DB-level guard against a cart acquiring two active holds for the
-- same item. The real safety today is application-side: reserveStock() takes a
-- SELECT ... FOR UPDATE row lock on variant_stock, runs canReserve(), increments
-- reserved atomically, and looks up an existing active hold by
--   (variant_id, cart_id) WHERE status = 'active' AND expires_at > now()
-- to make re-reserves idempotent.
--
-- The correct uniqueness scope is therefore exactly that idempotency key:
--   UNIQUE (variant_id, cart_id) WHERE status = 'active'
--
--   * "active" only — consumed / released / expired rows are append-only
--     history and must be preserved (no data deletion), and a cart may start a
--     NEW active hold for the same variant after the old one is consumed.
--   * (variant_id, cart_id) — one active hold per item per cart. Different
--     carts (different buyers) may each hold units of the same variant, so
--     legitimate MULTI-UNIT variants are NOT blocked.
--   * We deliberately do NOT add UNIQUE(variant_id): that would let one buyer
--     starve every other customer of a variant whose on_hand > 1, and would
--     break the one-of-a-one allocation model (stock quantity is enforced by
--     canReserve() + the reserved/sold counters, not by row cardinality).
--   * expiry cannot appear in the predicate: now() is STABLE, not IMMUTABLE,
--     so a partial index `WHERE expires_at > now()` is rejected by Postgres.
--     TTL is enforced by the application and the releaseExpiredReservations()
--     sweep; see FORWARD RECOVERY below.
--
-- FORWARD RECOVERY / ROLLBACK NOTE
-- --------------------------------
-- This migration is additive: it creates one partial UNIQUE index and one
-- NOT VALID CHECK constraint. It never DELETEs, UPDATEs or DROPs business data,
-- so it needs no data-repair rollback. To disable the guard, DROP the index and
-- constraint by name (destructive DDL, operator-controlled, not done here):
--   DROP INDEX IF EXISTS public.uq_stock_reservation_active_cart;
--   ALTER TABLE public.variant_stock DROP CONSTRAINT IF EXISTS ck_variant_stock_no_oversell;
-- A NOT VALID CHECK does not scan existing rows on apply. Before VALIDATE
-- CONSTRAINT, run releaseExpiredReservations() so stale active holds are swept;
-- an expired-but-unswept active hold for the same (variant, cart) is the one
-- case where the new index can reject a fresh reserve with SQLSTATE 23505 (the
-- application idempotency SELECT filters on expires_at > now(), which cannot be
-- expressed in the index predicate). The sweep makes the row non-active and the
-- retry succeeds. No stock is lost: the failed INSERT rolls back its reserved
-- increment with the transaction.
-- If the live DB already holds TWO active rows for the same (variant, cart),
-- creating the index will itself fail: an operator must reconcile that
-- historical duplicate out-of-band first. This migration never deletes or
-- merges rows, so it reports the condition rather than silently repairing it.

-- 1) One ACTIVE reservation per (variant, cart). The backstop for idempotent
--    duplicate reservation requests and against duplicate cart reservation lines.
CREATE UNIQUE INDEX IF NOT EXISTS uq_stock_reservation_active_cart
  ON public.stock_reservation USING btree (variant_id, cart_id)
  WHERE status = 'active';

-- 2) Safeguard: committed holds plus sold units can never exceed on_hand.
--    Added NOT VALID so historical (possibly inconsistent) rows are untouched;
--    the constraint is enforced for all NEW writes. Validate only after an
--    operator has reconciled historical stock (see note above).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ck_variant_stock_no_oversell'
      AND conrelid = 'public.variant_stock'::regclass
  ) THEN
    ALTER TABLE public.variant_stock
      ADD CONSTRAINT ck_variant_stock_no_oversell
      CHECK (reserved + sold <= on_hand) NOT VALID;
  END IF;
END $$;
