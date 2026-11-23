-- Migration 008 — finance policy fail-safes + approver != initiator constraints.
-- ADDITIVE ONLY. Adds CHECK constraints and documentation comments; it never
-- deletes, rewrites or UPDATEs any business/financial row.
--
-- Owner-gated semantics (no rule is invented here):
--   refund_effect = reverse_earnings | no_reversal
--       reverse_earnings -> post a NEW negative `refund_reversal` ledger row
--                           (reverses commission AND payable, net effect zero)
--       no_reversal      -> post nothing, the earning stands per the agreement
--   payable_when = order_paid | order_delivered | return_window_elapsed
--       order_paid            -> payable once payment is captured
--       order_delivered       -> also requires confirmed delivery
--       return_window_elapsed -> also requires the configured return window to
--                                have elapsed with no pending return/refund/hold
--   Any other stored value has NO defined semantics. The application fails
--   closed (assertKnownRefundEffect / assertKnownPayableWhen, explainPayability)
--   and the CHECK constraints below keep the stored vocabulary closed.
--
-- HISTORICAL-DATA GUARD (GAP-07): before adding the dual-control constraints we
-- COUNT existing offending rows and RAISE if any exist. We do NOT silently
-- change financial history. The migration is one transaction with the runner's
-- checkpoint, so a raise rolls the whole apply back and no checkpoint is written.
--
-- FORWARD RECOVERY: if this migration aborts on the guard, do NOT edit the
-- offending financial rows directly. Have an authorised owner reconcile the
-- approval via the audited dual-control correction runbook, then re-run
-- `node scripts/migrate.mjs`. There is no down-script — rollback is a database
-- restore from a verified backup (see docs/release/QA_BACKUP_RESTORE_REPORT.md).
-- Re-running after a successful apply is safe: every addition is guarded by
-- pg_constraint / IF NOT EXISTS.

-- 1. Historical-data report + fail-safe. NULL approval fields (pending state)
--    are explicitly NOT offending: "requested, not yet approved" is legal.
DO $$
DECLARE
  bad_settlement   integer := 0;
  bad_refunds      integer := 0;
  bad_executions   integer := 0;
  bad_refund_effect integer := 0;
  bad_payable_when  integer := 0;
BEGIN
  SELECT count(*) INTO bad_settlement
    FROM settlement_batch
   WHERE approved_by IS NOT NULL
     AND payment_initiated_by IS NOT NULL
     AND lower(btrim(approved_by)) = lower(btrim(payment_initiated_by));

  SELECT count(*) INTO bad_refunds
    FROM order_refunds
   WHERE requested_by IS NOT NULL
     AND approved_by IS NOT NULL
     AND lower(btrim(requested_by)) = lower(btrim(approved_by));

  -- Migration 004 already forbids this on refund_execution. Counted so a DB
  -- that skipped 004 is reported rather than silently constrained.
  SELECT count(*) INTO bad_executions
    FROM refund_execution
   WHERE requested_by IS NOT NULL
     AND approved_by IS NOT NULL
     AND lower(btrim(requested_by)) = lower(btrim(approved_by));

  SELECT count(*) INTO bad_refund_effect
    FROM commission_policy
   WHERE refund_effect IS NULL
      OR refund_effect NOT IN ('reverse_earnings','no_reversal');

  SELECT count(*) INTO bad_payable_when
    FROM commission_policy
   WHERE payable_when IS NULL
      OR payable_when NOT IN ('order_paid','order_delivered','return_window_elapsed');

  IF bad_settlement > 0 OR bad_refunds > 0 OR bad_executions > 0
     OR bad_refund_effect > 0 OR bad_payable_when > 0 THEN
    RAISE EXCEPTION
      '008_finance_constraints: refusing to add constraints. Offending row counts: settlement_batch approver=initiator=%, order_refunds requester=approver=%, refund_execution requester=approver=%, unknown refund_effect=%, unknown payable_when=%. Financial history was NOT changed. Reconcile via the owner-approved audited correction runbook then re-run the migration',
      bad_settlement, bad_refunds, bad_executions,
      bad_refund_effect, bad_payable_when;
  END IF;
END $$;

-- 2. Settlement batch: the approver cannot also be the payment initiator.
--    Both columns are NULL until their step, so NULL means "not yet set" and is
--    allowed. Comparison is case-insensitive and whitespace trimmed, matching
--    the application-level assertDualControl check.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'settlement_batch_approver_ne_initiator'
       AND conrelid = 'settlement_batch'::regclass
  ) THEN
    ALTER TABLE settlement_batch
      ADD CONSTRAINT settlement_batch_approver_ne_initiator
      CHECK (
        approved_by IS NULL
        OR payment_initiated_by IS NULL
        OR lower(btrim(approved_by)) <> lower(btrim(payment_initiated_by))
      );
  END IF;
END $$;

-- 3. Refund approvals: the requester cannot also be the approver. Pending rows
--    have NULL approver (and may have NULL requester for legacy rows) and are
--    legal; only a populated, equal pair is rejected.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'order_refunds_approver_ne_initiator'
       AND conrelid = 'order_refunds'::regclass
  ) THEN
    ALTER TABLE order_refunds
      ADD CONSTRAINT order_refunds_approver_ne_initiator
      CHECK (
        requested_by IS NULL
        OR approved_by IS NULL
        OR lower(btrim(requested_by)) <> lower(btrim(approved_by))
      );
  END IF;
END $$;

-- 4. Pin the documented rule vocabularies as named DB constraints as well.
--    Migration 003 already has equivalent inline CHECKs; these named ones make
--    the fail-safe explicit and survive an inline CHECK being edited later.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'commission_policy_refund_effect_supported'
       AND conrelid = 'commission_policy'::regclass
  ) THEN
    ALTER TABLE commission_policy
      ADD CONSTRAINT commission_policy_refund_effect_supported
      CHECK (refund_effect IN ('reverse_earnings','no_reversal'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'commission_policy_payable_when_supported'
       AND conrelid = 'commission_policy'::regclass
  ) THEN
    ALTER TABLE commission_policy
      ADD CONSTRAINT commission_policy_payable_when_supported
      CHECK (payable_when IN ('order_paid','order_delivered','return_window_elapsed'));
  END IF;
END $$;

-- 5. Machine-readable documentation of the two behaviour-driving rules.
COMMENT ON COLUMN commission_policy.refund_effect IS
  'reverse_earnings: post a negative refund_reversal ledger row reversing commission and payable; no_reversal: post nothing. Other values fail closed.';
COMMENT ON COLUMN commission_policy.payable_when IS
  'order_paid: payable on payment capture; order_delivered: also needs confirmed delivery; return_window_elapsed: also needs the configured return window to have elapsed with no pending return/refund/hold. Other values fail closed.';
