/**
 * Provider refund execution — the only path that can say money moved.
 *
 * An internal approval (`order_refunds.approved_by`) is a permission, not a
 * transfer. This module is the bridge: it claims an idempotency key, calls the
 * injected provider, and records `provider_confirmed` only when that provider
 * confirms. It never touches order status, so approving a refund can never be
 * mistaken for marking an order paid.
 */

import { randomUUID } from "node:crypto";
import { query as defaultQuery } from "@/lib/db";
import type { DbExecutor } from "./events";
import {
  isProviderRefundConfirmed,
  type ProviderRefund,
  type RefundProvider,
} from "./refund-provider";

export type { DbExecutor };

export class RefundExecutionError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "RefundExecutionError";
    this.code = code;
  }
}

export class DualControlError extends RefundExecutionError {
  constructor() {
    super(
      "DUAL_CONTROL",
      "The person who requested a refund cannot also be the person who executes it."
    );
    this.name = "DualControlError";
  }
}

export class RefundApprovalError extends RefundExecutionError {
  constructor(message: string) {
    super("APPROVAL_MISSING", message);
    this.name = "RefundApprovalError";
  }
}

export interface RefundExecutionRow {
  id: string;
  refund_request_id: string | null;
  order_id: string;
  partner_id: string | null;
  amount: number;
  currency: string;
  status:
    | "pending"
    | "approved"
    | "initiated"
    | "provider_confirmed"
    | "failed"
    | "reversed";
  requested_by: string;
  approved_by: string;
  idempotency_key: string;
  provider: string;
  provider_refund_id: string | null;
  provider_response: unknown;
  ledger_reversal_key: string | null;
  inventory_restored: boolean;
  failure_reason: string | null;
}

export interface ExecuteRefundInput {
  refundRequestId: string;
  orderId: string;
  amount: number;
  requester: string;
  approver: string;
  idempotencyKey: string;
  currency?: string;
  partnerId?: string;
  paymentId?: string;
  reason?: string;
}

export interface ExecuteRefundResult {
  execution: RefundExecutionRow;
  providerRefund: ProviderRefund;
  /** True when an existing execution was returned and no provider call was made. */
  reused: boolean;
}

/** Pure dual-control check, reused by the route and by this module. */
export function assertDualControl(
  requester: string | undefined | null,
  approver: string | undefined | null
): void {
  const req = (requester ?? "").trim().toLowerCase();
  const app = (approver ?? "").trim().toLowerCase();
  if (!req || !app) {
    throw new DualControlError();
  }
  if (req === app) {
    throw new DualControlError();
  }
}

export function buildLedgerReversalKey(executionId: string): string {
  return `refund-ledger-reversal:${executionId}`;
}

/**
 * Execute a refund, at most once per idempotency key.
 *
 * Order matters: the approval and dual-control checks run first, then the
 * idempotency row is claimed with an INSERT ... ON CONFLICT DO NOTHING. Only a
 * caller that claimed the row is allowed to contact the provider. A replay
 * returns the stored execution without ever calling `provider.refund`.
 */
export async function executeRefund(
  input: ExecuteRefundInput,
  provider: RefundProvider,
  executor: DbExecutor = defaultQuery
): Promise<ExecuteRefundResult> {
  assertDualControl(input.requester, input.approver);

  const idempotencyKey = (input.idempotencyKey || "").trim();
  if (!idempotencyKey) {
    throw new RefundExecutionError("IDEMPOTENCY_REQUIRED", "An idempotency key is required.");
  }

  const approvals = await executor(
    `SELECT id, order_id, amount, status, requested_by, approved_by
       FROM order_refunds WHERE id = $1 LIMIT 1`,
    [input.refundRequestId]
  );
  const approval = approvals[0];
  if (!approval) {
    throw new RefundApprovalError("Refund approval not found.");
  }
  if (
    !["approved", "completed"].includes(String(approval.status ?? "").trim().toLowerCase())
  ) {
    throw new RefundApprovalError(
      `Refund approval is ${approval.status || "unknown"}, not approved.`
    );
  }
  if (!(approval.approved_by ?? "").trim()) {
    // Auto-approved small refunds still record an approver in refund-approvals;
    // no approver means no permission to move money.
    throw new RefundApprovalError("This refund has no recorded approver.");
  }
  if (String(approval.order_id) !== String(input.orderId)) {
    throw new RefundApprovalError("The approval belongs to a different order.");
  }

  const executionId = randomUUID();
  const currency = (input.currency || "INR").trim() || "INR";
  const ledgerKey = buildLedgerReversalKey(executionId);

  const claimed = await executor(
    `INSERT INTO refund_execution
       (id, refund_request_id, order_id, partner_id, amount, currency, status,
        requested_by, approved_by, idempotency_key, provider, ledger_reversal_key)
     VALUES ($1, $2, $3, $4, $5, $6, 'initiated', $7, $8, $9, $10, $11)
     ON CONFLICT (idempotency_key) DO NOTHING
     RETURNING *`,
    [
      executionId,
      input.refundRequestId,
      input.orderId,
      input.partnerId ?? null,
      input.amount,
      currency,
      input.requester.trim(),
      input.approver.trim(),
      idempotencyKey,
      provider.name ?? "unknown",
      ledgerKey,
    ]
  );

  if (claimed.length === 0) {
    const existing = await executor(
      "SELECT * FROM refund_execution WHERE idempotency_key = $1 LIMIT 1",
      [idempotencyKey]
    );
    const execution = existing[0] as RefundExecutionRow | undefined;
    if (!execution) {
      throw new RefundExecutionError(
        "IDEMPOTENCY_CONFLICT",
        "Idempotency key was claimed but no execution could be read back."
      );
    }
    return {
      execution,
      providerRefund: {
        providerRefundId: execution.provider_refund_id ?? "",
        status: execution.status,
        raw: execution.provider_response ?? {},
      },
      reused: true,
    };
  }

  let providerRefund: ProviderRefund;
  try {
    providerRefund = await provider.refund({
      amount: input.amount,
      currency,
      orderId: input.orderId,
      refundRequestId: input.refundRequestId,
      idempotencyKey,
      paymentId: input.paymentId,
      reason: input.reason,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await executor(
      `UPDATE refund_execution
          SET status = 'failed', failure_reason = $2, updated_at = now()
        WHERE id = $1`,
      [executionId, message]
    );
    throw error;
  }

  const confirmed = isProviderRefundConfirmed(providerRefund.status);
  const updated = await executor(
    `UPDATE refund_execution
        SET status = $2,
            provider_refund_id = $3,
            provider_response = $4,
            failure_reason = $5,
            updated_at = now()
      WHERE id = $1
      RETURNING *`,
    [
      executionId,
      confirmed ? "provider_confirmed" : "initiated",
      providerRefund.providerRefundId,
      JSON.stringify(providerRefund.raw ?? {}),
      confirmed
        ? null
        : `Provider returned status "${providerRefund.status}"; not confirmed.`,
    ]
  );

  return {
    execution: (updated[0] ?? claimed[0]) as RefundExecutionRow,
    providerRefund,
    reused: false,
  };
}

/**
 * Refresh one execution from the provider. A provider that has not confirmed
 * never becomes `provider_confirmed` through this (or any other) path.
 */
export async function syncRefundStatus(
  id: string,
  provider: RefundProvider,
  executor: DbExecutor = defaultQuery
): Promise<RefundExecutionRow> {
  const rows = await executor(
    "SELECT * FROM refund_execution WHERE id = $1 LIMIT 1",
    [id]
  );
  const current = rows[0] as RefundExecutionRow | undefined;
  if (!current) {
    throw new RefundExecutionError("NOT_FOUND", "Refund execution not found.");
  }
  if (!current.provider_refund_id) {
    return current;
  }

  const providerRefund = await provider.getRefund(current.provider_refund_id);
  const status = String(providerRefund.status ?? "").trim().toLowerCase();
  let next: RefundExecutionRow["status"] = current.status;
  if (isProviderRefundConfirmed(status)) {
    next = "provider_confirmed";
  } else if (status === "reversed") {
    next = "reversed";
  } else if (status.includes("fail") || status === "declined") {
    next = "failed";
  }

  const updated = await executor(
    `UPDATE refund_execution
        SET status = $2, provider_response = $3, updated_at = now()
      WHERE id = $1
      RETURNING *`,
    [id, next, JSON.stringify(providerRefund.raw ?? {})]
  );
  return (updated[0] ?? { ...current, status: next }) as RefundExecutionRow;
}
