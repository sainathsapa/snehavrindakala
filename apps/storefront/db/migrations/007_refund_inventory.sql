-- Migration 007 — refund/return-driven inventory restoration state + movements.
-- Additive only. Applied by db/migrate.ts (see db/migrations/README.md). Idempotent.
-- This migration NEVER deletes, alters or rewrites existing business/financial
-- data. `refund_execution.inventory_restored` already exists (migration 004)
-- with the safe default false; here we only ADD observability columns around it.

-- Observability on the existing refund execution row. Historical rows keep
-- inventory_restored = false and receive the neutral default 'not_required'.
ALTER TABLE IF EXISTS public.refund_execution
  ADD COLUMN IF NOT EXISTS inventory_restoration_state text
    NOT NULL DEFAULT 'not_required'
    CHECK (inventory_restoration_state IN
      ('not_required','eligible','pending','restored','failed','not_eligible')),
  ADD COLUMN IF NOT EXISTS inventory_eligibility_reason text,
  ADD COLUMN IF NOT EXISTS inventory_restored_by text,
  ADD COLUMN IF NOT EXISTS inventory_restored_at timestamptz,
  ADD COLUMN IF NOT EXISTS inventory_restoration_key text;

-- Optional hard link from the execution row to the single restoration it
-- performed. NULL is valid for refunds that never restore stock.
CREATE UNIQUE INDEX IF NOT EXISTS idx_refund_exec_inventory_restoration_key
  ON public.refund_execution (inventory_restoration_key);

-- Append-only observable action. A row exists for EVERY restoration decision
-- (eligible, pending owner decision, not eligible, restored, failed), so a
-- reviewer can see what happened and why. UNIQUE(action_key) is the idempotency
-- guard: concurrent callers cannot create two actions for one decision.
CREATE TABLE IF NOT EXISTS public.inventory_restoration_action (
  id                    text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  action_key            text NOT NULL,
  refund_execution_id   text,
  refund_request_id     text,
  return_request_id     text,
  order_id              text NOT NULL,
  order_item_id         text,
  variant_id            text,
  status                text NOT NULL DEFAULT 'pending'
                        CHECK (status IN
                          ('not_required','eligible','pending','restored','failed','not_eligible')),
  eligibility_reason    text,
  trigger               text,
  actor                 text,
  attempts              integer NOT NULL DEFAULT 0,
  last_error            text,
  metadata              jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (action_key)
);

-- Append-only stock movement. Written in the same transaction as the stock
-- change, with UNIQUE(movement_key) so a concurrent replay can never restore
-- the same sale twice. Carries the order item and refund/return association.
CREATE TABLE IF NOT EXISTS public.inventory_movement (
  id                    text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  movement_key          text NOT NULL,
  direction             text NOT NULL DEFAULT 'restock'
                        CHECK (direction IN ('restock')),
  order_id              text NOT NULL,
  order_item_id         text,
  variant_id            text,
  quantity              integer NOT NULL CHECK (quantity > 0),
  refund_execution_id   text,
  refund_request_id     text,
  return_request_id     text,
  actor                 text,
  reason                text,
  restoration_action_key text,
  metadata              jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (movement_key)
);

CREATE INDEX IF NOT EXISTS idx_inventory_movement_order
  ON public.inventory_movement (order_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movement_refund
  ON public.inventory_movement (refund_execution_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movement_return
  ON public.inventory_movement (return_request_id);
CREATE INDEX IF NOT EXISTS idx_inventory_restoration_action_refund
  ON public.inventory_restoration_action (refund_execution_id);

-- ── Forward recovery note ────────────────────────────────────────────────────
-- No existing row is updated or deleted. If a restoration is interrupted after
-- the movement is written but before inventory_restored is flagged, replaying
-- the SAME action/movement key is a no-op (UNIQUE conflict) so stock is never
-- restored twice; an operator can reconcile the flag by consulting
-- inventory_movement and re-running restoreInventoryForRefund / the admin
-- recovery path with the same keys. A failed attempt leaves
-- inventory_restoration_action.status = 'failed' with last_error, and the
-- execution row's inventory_restoration_state = 'failed'; neither ever claims
-- inventory_restored = true. Undefined owner policy inputs leave a 'pending'
-- action and inventory unchanged. This migration is safe to re-apply.
