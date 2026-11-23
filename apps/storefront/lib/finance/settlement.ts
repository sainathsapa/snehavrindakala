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
import { policyConfigured, round2, toNumber } from "./commission-policy";
import type {
  CommissionPolicy,
  EarningsEntry,
  PaymentConfirmation,
  QueryExecutor,
  SettlementBatch,
  SettlementPeriod,
} from "./types";

/** Select only payable, unassigned, policy-linked earning rows. */
export function selectPayableEntries(
  entries: EarningsEntry[],
  policies?: CommissionPolicy[]
): EarningsEntry[] {
  if (policies !== undefined && !policyConfigured(policies)) {
    throw new Error(
      "No active configured commission policy: refusing to settle"
    );
  }
  const eligible = (entries ?? []).filter(
    (entry) =>
      entry &&
      entry.entry_type === "earning" &&
      entry.settlement_batch_id == null &&
      entry.commission_policy_id != null &&
      toNumber(entry.payable_amount) > 0
  );
  if (eligible.length === 0) {
    throw new Error("No payable entries available for settlement");
  }
  return eligible;
}

/** Build a 'calculated' batch. No money moves here. */
export function createBatch(
  entries: EarningsEntry[],
  period: SettlementPeriod,
  policies?: CommissionPolicy[]
): SettlementBatch {
  const eligible = selectPayableEntries(entries, policies);
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

/** Eligible ledger rows, restricted to configured (active) policies. */
export async function listEligibleLedgerEntries(
  executor: QueryExecutor = defaultQuery
): Promise<EarningsEntry[]> {
  return (await executor(
    "SELECT le.* FROM partner_earnings_ledger le " +
      "JOIN commission_policy cp ON cp.id = le.commission_policy_id " +
      "WHERE le.settlement_batch_id IS NULL " +
      "AND le.entry_type = 'earning' " +
      "AND le.payable_amount > 0 " +
      "AND cp.status = 'active'"
  )) as EarningsEntry[];
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
