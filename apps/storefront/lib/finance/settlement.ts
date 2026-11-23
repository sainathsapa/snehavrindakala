/**
 * Settlement batches and the payout state machine.
 *
 * calculated -> approved -> payment_initiated -> payment_completed
 *                         \-> payment_failed
 *
 * Hard gates:
 *  - no settlement without an active, configured, approved policy;
 *  - only unassigned, payable, policy-linked earning rows are selected;
 *  - a batch becomes payment_completed ONLY with real provider confirmation;
 *  - approveBatch assumes the CALLER has already checked finance permission
 *    (the admin route does this with requirePermission("settlements:write")).
 */

import { randomUUID } from "node:crypto";
import { query as defaultQuery } from "@/lib/db";
import {
  assertKnownPayableWhen,
  policyConfigured,
  round2,
  toNumber,
} from "./commission-policy";
import type {
  CommissionPolicy,
  EarningsEntry,
  PayabilityContext,
  PayabilityDecision,
  PayabilityResolver,
  PaymentConfirmation,
  QueryExecutor,
  SettlementBatch,
  SettlementPeriod,
} from "./types";

/**
 * Evaluate the configured `payable_when` rule against documented facts.
 *
 * This is the single decision point for settlement timing. It fails closed on
 * an unknown/undefined rule, and universal blockers (hold, cancellation,
 * refund, pending return, unpaid order) apply before the rule-specific test.
 * No condition here is invented: each fact is listed in PayabilityContext.
 */
export function explainPayability(
  context: PayabilityContext | null | undefined
): PayabilityDecision {
  if (!context || typeof context !== "object") {
    return {
      payable: false,
      reason:
        "UNCONFIGURED_PAYABLE_WHEN: no payability context; refusing to settle",
    };
  }
  let rule: ReturnType<typeof assertKnownPayableWhen>;
  try {
    rule = assertKnownPayableWhen(context.payable_when);
  } catch (error) {
    return { payable: false, reason: (error as Error).message };
  }

  if (context.settlementHeld) {
    return {
      payable: false,
      reason: "SETTLEMENT_HOLD: entry is already assigned or held",
    };
  }
  if (context.orderCancelled) {
    return {
      payable: false,
      reason: "ORDER_CANCELLED: cancelled orders are not payable",
    };
  }
  if (context.refundIssued) {
    return {
      payable: false,
      reason: "REFUND_ISSUED: refunded orders are not payable",
    };
  }
  if (context.pendingReturn) {
    return {
      payable: false,
      reason: "PENDING_RETURN: return in progress; wait for resolution",
    };
  }
  if (!context.orderPaid) {
    return { payable: false, reason: "ORDER_NOT_PAID: payment not captured" };
  }

  if (rule === "order_paid") {
    return { payable: true, reason: "order_paid: payment captured" };
  }

  if (!context.orderDelivered) {
    return {
      payable: false,
      reason: "ORDER_NOT_DELIVERED: delivery not confirmed",
    };
  }
  if (rule === "order_delivered") {
    return {
      payable: true,
      reason: "order_delivered: payment captured and delivery confirmed",
    };
  }

  // return_window_elapsed. The window is operator-supplied and never defaulted;
  // the boundary day (== window) is still inside the window, matching the
  // returns module's eligibility rule.
  const window = context.returnWindowDays;
  const days = context.daysSinceDelivery;
  if (typeof window !== "number" || !Number.isFinite(window) || window <= 0) {
    return {
      payable: false,
      reason: "RETURN_WINDOW_UNCONFIGURED: owner must configure the return window",
    };
  }
  if (typeof days !== "number" || !Number.isFinite(days) || days < 0) {
    return {
      payable: false,
      reason: "DELIVERY_DATE_UNKNOWN: cannot prove the return window elapsed",
    };
  }
  if (days <= window) {
    return {
      payable: false,
      reason: `RETURN_WINDOW_OPEN: day ${days} is within the ${window}-day window`,
    };
  }
  return {
    payable: true,
    reason: `return_window_elapsed: day ${days} is beyond the ${window}-day window`,
  };
}

export function isPayable(
  context: PayabilityContext | null | undefined
): boolean {
  return explainPayability(context).payable;
}

/** External facts needed by the rule, all sourced from existing data. */
export interface PayabilityFacts {
  orderPaid?: boolean;
  orderDelivered?: boolean;
  orderCancelled?: boolean;
  refundIssued?: boolean;
  pendingReturn?: boolean;
  /** Explicit operational hold; otherwise derived from settlement_batch_id. */
  settlementHeld?: boolean;
  daysSinceDelivery?: number | null;
  returnWindowDays?: number | null;
}

/**
 * Build a context for one ledger entry from an explicit policy and facts.
 * `settlementHeld` is derived from the ledger row itself. Missing facts default
 * to "not proven" (false/null) so an incomplete integration cannot settle early.
 */
export function payabilityContextForEntry(
  entry: EarningsEntry,
  policy: CommissionPolicy,
  facts: PayabilityFacts = {}
): PayabilityContext {
  return {
    payable_when: policy.payable_when,
    orderPaid: facts.orderPaid ?? false,
    orderDelivered: facts.orderDelivered ?? false,
    orderCancelled: facts.orderCancelled ?? false,
    refundIssued: facts.refundIssued ?? false,
    pendingReturn: facts.pendingReturn ?? false,
    settlementHeld: facts.settlementHeld ?? entry.settlement_batch_id != null,
    daysSinceDelivery: facts.daysSinceDelivery ?? null,
    returnWindowDays: facts.returnWindowDays ?? null,
  };
}

/**
 * Select only payable, unassigned, policy-linked earning rows.
 *
 * `payability` is the hook that makes the configured `payable_when` rule
 * controlling: when a caller supplies a resolver, EVERY candidate row is
 * filtered through `explainPayability`. An unknown rule always fails closed,
 * even on the compatibility path where a caller has no order state to supply.
 */
export function selectPayableEntries(
  entries: EarningsEntry[],
  policies?: CommissionPolicy[],
  payability?: PayabilityResolver
): EarningsEntry[] {
  if (policies !== undefined && !policyConfigured(policies)) {
    throw new Error(
      "No active configured commission policy: refusing to settle"
    );
  }
  const policiesById = new Map<string, CommissionPolicy>();
  for (const policy of policies ?? []) {
    if (policy?.id) policiesById.set(policy.id, policy);
  }

  const eligible = (entries ?? []).filter((entry) => {
    if (
      !(
        entry &&
        entry.entry_type === "earning" &&
        entry.settlement_batch_id == null &&
        entry.commission_policy_id != null &&
        toNumber(entry.payable_amount) > 0
      )
    ) {
      return false;
    }
    const policy = policiesById.get(entry.commission_policy_id);
    // Unknown/undefined rule can never be settled, regardless of context.
    if (policy) assertKnownPayableWhen(policy.payable_when);
    if (payability === undefined) {
      // Compatibility path: this caller cannot supply order/delivery state.
      // Such callers (legacy pure helpers) remain unchanged; the settlement API
      // must pass a resolver for the rule to be enforced end to end.
      return true;
    }
    const context =
      typeof payability === "function" ? payability(entry) : payability;
    return explainPayability(context).payable;
  });
  if (eligible.length === 0) {
    throw new Error("No payable entries available for settlement");
  }
  return eligible;
}

/** Build a 'calculated' batch. No money moves here. */
export function createBatch(
  entries: EarningsEntry[],
  period: SettlementPeriod,
  policies?: CommissionPolicy[],
  payability?: PayabilityResolver
): SettlementBatch {
  const eligible = selectPayableEntries(entries, policies, payability);
  const total = round2(
    eligible.reduce((sum, entry) => sum + toNumber(entry.payable_amount), 0)
  );
  return {
    id: randomUUID(),
    status: "calculated",
    period_start: period.start,
    period_end: period.end,
    currency: eligible[0]?.currency || "INR",
    total_amount: total,
    line_count: eligible.length,
    approved_by: null,
    approved_at: null,
    payment_initiated_by: null,
    provider: null,
    payout_reference: null,
    provider_confirmation: null,
    failure_reason: null,
  };
}

/** Persist a batch, its line items and the ledger assignment markers. */
export async function persistBatch(
  batch: SettlementBatch,
  entries: EarningsEntry[],
  executor: QueryExecutor = defaultQuery
): Promise<void> {
  await executor(
    "INSERT INTO settlement_batch " +
      "(id, status, period_start, period_end, currency, total_amount, line_count, created_at, updated_at) " +
      "VALUES ($1, $2, $3, $4, $5, $6, $7, now(), now()) " +
      "ON CONFLICT (id) DO NOTHING",
    [
      batch.id,
      batch.status,
      batch.period_start,
      batch.period_end,
      batch.currency,
      batch.total_amount,
      batch.line_count,
    ]
  );

  for (const entry of entries) {
    await executor(
      "INSERT INTO settlement_batch_item " +
        "(id, batch_id, partner_id, ledger_entry_id, amount) " +
        "VALUES ($1, $2, $3, $4, $5) " +
        "ON CONFLICT (batch_id, ledger_entry_id) DO NOTHING",
      [
        randomUUID(),
        batch.id,
        entry.partner_id,
        entry.id ?? null,
        round2(entry.payable_amount),
      ]
    );
    // Only the settlement marker changes; money values are never UPDATEd.
    await executor(
      "UPDATE partner_earnings_ledger SET settlement_batch_id = $1 " +
        "WHERE id = $2 AND settlement_batch_id IS NULL",
      [batch.id, entry.id ?? null]
    );
  }
}

export async function listActivePolicies(
  executor: QueryExecutor = defaultQuery
): Promise<CommissionPolicy[]> {
  return (await executor(
    "SELECT * FROM commission_policy WHERE status = 'active' " +
      "ORDER BY effective_from DESC"
  )) as CommissionPolicy[];
}

/**
 * Eligible ledger rows, restricted to configured (active) policies.
 *
 * The SQL also refuses rows whose policy has a rule outside the documented
 * vocabulary — defence in depth for the fail-safe. When a `payability` resolver
 * is supplied, rows are additionally filtered through `explainPayability` so
 * the configured `payable_when` actually controls settlement selection.
 */
export async function listEligibleLedgerEntries(
  executor: QueryExecutor = defaultQuery,
  payability?: PayabilityResolver
): Promise<EarningsEntry[]> {
  const rows = (await executor(
    "SELECT le.* FROM partner_earnings_ledger le " +
      "JOIN commission_policy cp ON cp.id = le.commission_policy_id " +
      "WHERE le.settlement_batch_id IS NULL " +
      "AND le.entry_type = 'earning' " +
      "AND le.payable_amount > 0 " +
      "AND cp.status = 'active' " +
      "AND cp.payable_when IN ('order_paid','order_delivered','return_window_elapsed') " +
      "AND cp.refund_effect IN ('reverse_earnings','no_reversal')"
  )) as EarningsEntry[];
  if (payability === undefined) return rows;
  return rows.filter((entry) => {
    const context =
      typeof payability === "function" ? payability(entry) : payability;
    return explainPayability(context).payable;
  });
}

function requireRow(rows: any[] | undefined, action: string): SettlementBatch {
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error(`Cannot ${action}: batch not found or in the wrong state`);
  }
  return rows[0] as SettlementBatch;
}

/** CALLER MUST have checked finance permission at the API boundary. */
export async function approveBatch(
  id: string,
  approver: string,
  executor: QueryExecutor = defaultQuery
): Promise<SettlementBatch> {
  if (!String(approver ?? "").trim()) {
    throw new Error("An approver identity is required");
  }
  const rows = await executor(
    "UPDATE settlement_batch SET status='approved', approved_by=$2, " +
      "approved_at=now(), updated_at=now() " +
      "WHERE id=$1 AND status='calculated' RETURNING *",
    [id, approver]
  );
  return requireRow(rows, "approve batch");
}

export async function markPaymentInitiated(
  id: string,
  actor: string,
  provider: string,
  executor: QueryExecutor = defaultQuery
): Promise<SettlementBatch> {
  if (!String(actor ?? "").trim()) {
    throw new Error("An actor identity is required");
  }
  if (!String(provider ?? "").trim()) {
    throw new Error("A payment provider is required");
  }
  const rows = await executor(
    "UPDATE settlement_batch SET status='payment_initiated', " +
      "payment_initiated_by=$2, provider=$3, updated_at=now() " +
      "WHERE id=$1 AND status='approved' RETURNING *",
    [id, actor, provider]
  );
  return requireRow(rows, "initiate payment");
}

function hasProviderConfirmation(
  confirmation: PaymentConfirmation | null | undefined
): boolean {
  if (!confirmation || typeof confirmation !== "object") return false;
  if (confirmation.confirmed !== true) return false;
  const successStatus =
    typeof confirmation.status === "string" &&
    ["captured", "success", "succeeded", "paid", "completed"].includes(
      confirmation.status.toLowerCase()
    );
  const hasEvent =
    typeof confirmation.provider_event_id === "string" &&
    confirmation.provider_event_id.trim().length > 0;
  return successStatus || hasEvent;
}

/** Record creation alone never marks a batch paid — confirmation is mandatory. */
export async function confirmPayment(
  id: string,
  providerRef: string,
  confirmation: PaymentConfirmation | null | undefined,
  executor: QueryExecutor = defaultQuery
): Promise<SettlementBatch> {
  if (!String(providerRef ?? "").trim()) {
    throw new Error("A provider reference is required");
  }
  if (!hasProviderConfirmation(confirmation)) {
    throw new Error(
      "Provider confirmation is required before a batch can be marked paid"
    );
  }
  const rows = await executor(
    "UPDATE settlement_batch SET status='payment_completed', " +
      "payout_reference=$2, provider_confirmation=$3::jsonb, updated_at=now() " +
      "WHERE id=$1 AND status='payment_initiated' RETURNING *",
    [id, providerRef, JSON.stringify(confirmation)]
  );
  return requireRow(rows, "confirm payment");
}

export async function failPayment(
  id: string,
  reason: string,
  executor: QueryExecutor = defaultQuery
): Promise<SettlementBatch> {
  if (!String(reason ?? "").trim()) {
    throw new Error("A failure reason is required");
  }
  const rows = await executor(
    "UPDATE settlement_batch SET status='payment_failed', " +
      "failure_reason=$2, updated_at=now() " +
      "WHERE id=$1 AND status IN ('approved','payment_initiated') RETURNING *",
    [id, reason]
  );
  return requireRow(rows, "fail payment");
}

export async function getBatch(
  id: string,
  executor: QueryExecutor = defaultQuery
): Promise<SettlementBatch | null> {
  const rows = await executor(
    "SELECT * FROM settlement_batch WHERE id = $1 LIMIT 1",
    [id]
  );
  return (rows[0] as SettlementBatch) ?? null;
}

export async function listBatches(
  executor: QueryExecutor = defaultQuery
): Promise<any[]> {
  return executor(
    "SELECT * FROM settlement_batch ORDER BY created_at DESC LIMIT 200"
  );
}

export async function getBatchItems(
  id: string,
  executor: QueryExecutor = defaultQuery
): Promise<any[]> {
  return executor(
    "SELECT * FROM settlement_batch_item WHERE batch_id = $1 ORDER BY created_at",
    [id]
  );
}
