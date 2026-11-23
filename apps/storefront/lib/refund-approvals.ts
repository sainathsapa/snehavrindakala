/**
 * Two-person approval for refunds above a threshold.
 *
 * A single admin account can be compromised, can be used in a hurry, or can be
 * the person who made the mistake being refunded. For small amounts none of that
 * is worth a second queue; above a threshold it is the cheapest control the shop
 * has: the person who asks for the money cannot also be the person who releases
 * it.
 *
 * The rule is enforced server-side in `decideRefund`, not by hiding a button. A
 * hidden button is a UI opinion; this is the actual gate.
 */

import { query, queryResult } from "@/lib/db";

/**
 * Refund amounts are stored in minor units (paise), matching `order_refunds`.
 * The environment variable is in major units because that is what a person
 * writing "5000" in a `.env` file means.
 */
export function refundApprovalThreshold(): number {
  const rawText = (process.env.REFUND_APPROVAL_THRESHOLD ?? "").trim();
  // `Number("")` is 0, and a zero threshold means "every refund needs two
  // people". An empty line in `.env` therefore used to turn the whole shop into
  // four-eyes-everything by accident. Blank means unset, not zero.
  const raw = rawText === "" ? Number.NaN : Number(rawText);
  const major = Number.isFinite(raw) && raw >= 0 ? raw : 5000;
  return Math.round(major * 100);
}

/** Below the threshold one admin is enough. At or above it, two are. */
export function needsSecondApproval(
  amountMinor: number,
  thresholdMinor = refundApprovalThreshold()
): boolean {
  // A zero threshold means "nothing is auto-approved"; a negative or absent one
  // is treated as the default by refundApprovalThreshold, never as "no checks".
  return thresholdMinor === 0 || amountMinor >= thresholdMinor;
}

export interface RefundRow {
  id: string;
  order_id: string;
  amount: number;
  reason: string | null;
  status: string;
  requested_by: string | null;
  approved_by: string | null;
  decided_at: string | null;
  decision_note: string | null;
  created_at: string;
}

export interface DecisionCheck {
  ok: boolean;
  /** Why the decision is refused, in words an admin can act on. */
  error?: string;
}

/**
 * Whether this admin may decide this refund — pure, so the rule can be tested
 * without a database and reused by any future entry point (an email link, a CLI).
 */
export function canDecide(params: {
  status: string;
  requestedBy: string | null;
  actor: string | null;
}): DecisionCheck {
  const actor = (params.actor ?? "").trim().toLowerCase();
  if (!actor) return { ok: false, error: "Not signed in." };
  if (params.status !== "pending") {
    return { ok: false, error: `This refund is already ${params.status}.` };
  }
  const requester = (params.requestedBy ?? "").trim().toLowerCase();
  if (requester && requester === actor) {
    return {
      ok: false,
      error:
        "You requested this refund, so someone else has to approve it. That is the point of the second signature.",
    };
  }
  return { ok: true };
}

export interface CreatedRefund {
  refund: RefundRow;
  /** True when a second admin still has to approve before it is released. */
  needs_approval: boolean;
}

export async function createRefundRequest(params: {
  orderId: string;
  amount: number;
  reason: string;
  actor: string;
}): Promise<CreatedRefund> {

  const needs = needsSecondApproval(params.amount);
  // Auto-approved rows record the requester as approver and say so in the note.
  // Recording nothing would make a low-value refund indistinguishable from one
  // that skipped the rule.
  const status = needs ? "pending" : "approved";

  const result = await queryResult<RefundRow>(
    `INSERT INTO order_refunds
       (order_id, amount, reason, status, requested_by, approved_by, decided_at, decision_note)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     RETURNING *`,
    [
      params.orderId,
      params.amount,
      params.reason,
      status,
      params.actor,
      needs ? null : params.actor,
      needs ? null : new Date().toISOString(),
      needs ? null : "Below the approval threshold: single-admin refund.",
    ]
  );

  return { refund: result.rows[0], needs_approval: needs };
}

export async function listPendingRefunds(): Promise<RefundRow[]> {
  const result = await queryResult<RefundRow>(
    `SELECT * FROM order_refunds WHERE status = 'pending' ORDER BY created_at ASC`
  );
  return result.rows;
}

export async function listRefundsForOrder(orderId: string): Promise<RefundRow[]> {
  const result = await queryResult<RefundRow>(
    `SELECT * FROM order_refunds WHERE order_id = $1 ORDER BY created_at DESC`,
    [orderId]
  );
  return result.rows;
}

export async function getRefund(refundId: string): Promise<RefundRow | null> {
  const result = await queryResult<RefundRow>(
    `SELECT * FROM order_refunds WHERE id = $1`,
    [refundId]
  );
  return result.rows[0] ?? null;
}

export type Decision = "approve" | "reject";

export async function decideRefund(params: {
  refundId: string;
  decision: Decision;
  actor: string;
  note?: string;
}): Promise<{ ok: boolean; error?: string; refund?: RefundRow }> {
  const refund = await getRefund(params.refundId);
  if (!refund) return { ok: false, error: "Refund not found." };

  const check = canDecide({
    status: refund.status,
    requestedBy: refund.requested_by,
    actor: params.actor,
  });
  if (!check.ok) return { ok: false, error: check.error };

  const result = await queryResult<RefundRow>(
    `UPDATE order_refunds
        SET status = $2,
            approved_by = $3,
            decided_at = now(),
            decision_note = $4,
            updated_at = now()
      WHERE id = $1 AND status = 'pending'
      RETURNING *`,
    [
      params.refundId,
      params.decision === "approve" ? "approved" : "rejected",
      params.actor,
      params.note?.trim() || null,
    ]
  );

  if (!result.rows[0]) {
    // Someone else decided it between the read and the write.
    return { ok: false, error: "This refund was already decided by someone else." };
  }
  return { ok: true, refund: result.rows[0] };
}
