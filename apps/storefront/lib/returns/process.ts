/**
 * Return processing — pure decision rules plus injectable DB helpers.
 *
 * The rules here are deliberately small and synchronous so they can be tested
 * without a database. The DB helpers take a `QueryExecutor` so a test can supply
 * a fake and assert exactly what was written (including the audit rows).
 *
 * IMPORTANT — no return window is invented here. `isReturnEligible` takes the
 * window as an explicit argument. `configuredReturnWindowDays()` reads an
 * operator-supplied value and returns `null` when it is absent; a `null` window
 * is never silently replaced with a default. The owner must decide the window.
 *
 * `return_requests` has no decision/audit/refund-link columns. We therefore use
 * the existing `audit_log` table as the closest durable structure for decision
 * metadata and for the refund link (see report to Lead).
 */

import { query as defaultQuery } from "@/lib/db";
import type { QueryExecutor } from "@/lib/partner/repository";

/* ── Errors ───────────────────────────────────────────────────────────────── */

export class ReturnError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "ReturnError";
    this.code = code;
  }
}

export class ReturnValidationError extends ReturnError {
  constructor(message: string) {
    super("VALIDATION", message);
    this.name = "ReturnValidationError";
  }
}

/* ── Statuses ─────────────────────────────────────────────────────────────── */

export const RETURN_STATUSES = [
  "pending",
  "needs_evidence",
  "approved",
  "rejected",
  "completed",
] as const;
export type ReturnStatus = (typeof RETURN_STATUSES)[number];

const KNOWN_STATUSES = new Set<string>(RETURN_STATUSES);

function asStatus(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

/* ── Eligibility (pure) ──────────────────────────────────────────────────── */

/** Order-like input; only a status is inspected, and only when present. */
export interface ReturnEligibilityOrder {
  status?: unknown;
  fulfillment_status?: unknown;
  fulfilment_status?: unknown;
  order_status?: unknown;
  [key: string]: unknown;
}

export interface EligibilityExplanation {
  eligible: boolean;
  reason: string;
}

/** Statuses that count as a delivered order for return eligibility. */
export const DELIVERED_STATUSES = new Set([
  "delivered",
  "fulfilled",
  "complete",
  "completed",
]);

function orderStatus(order: ReturnEligibilityOrder | null | undefined): string | null {
  if (!order || typeof order !== "object") return null;
  for (const key of ["status", "fulfillment_status", "fulfilment_status", "order_status"]) {
    const status = asStatus((order as Record<string, unknown>)[key]);
    if (status) return status;
  }
  return null;
}

/**
 * Explain eligibility. `windowDays` is REQUIRED and must be a positive number;
 * an unconfigured/invalid window makes the return ineligible rather than
 * falling back to an invented default. `daysSinceDelivery` must be >= 0.
 * The boundary day (equals the window) is still inside the window.
 */
export function explainReturnEligibility(
  order: ReturnEligibilityOrder | null | undefined,
  daysSinceDelivery: number,
  windowDays: number
): EligibilityExplanation {
  if (
    typeof windowDays !== "number" ||
    !Number.isFinite(windowDays) ||
    windowDays <= 0
  ) {
    return {
      eligible: false,
      reason: "Return window is not configured; owner decision required.",
    };
  }
  if (
    typeof daysSinceDelivery !== "number" ||
    !Number.isFinite(daysSinceDelivery) ||
    daysSinceDelivery < 0
  ) {
    return {
      eligible: false,
      reason: "A valid non-negative days-since-delivery value is required.",
    };
  }
  const status = orderStatus(order);
  if (status && !DELIVERED_STATUSES.has(status)) {
    return {
      eligible: false,
      reason: `Order status "${status}" is not a delivered order.`,
    };
  }
  if (daysSinceDelivery > windowDays) {
    return {
      eligible: false,
      reason: `The ${windowDays}-day return window expired (day ${daysSinceDelivery}).`,
    };
  }
  return { eligible: true, reason: "Within the configured return window." };
}

/** Pure boolean form of {@link explainReturnEligibility}. */
export function isReturnEligible(
  order: ReturnEligibilityOrder | null | undefined,
  daysSinceDelivery: number,
  windowDays: number
): boolean {
  return explainReturnEligibility(order, daysSinceDelivery, windowDays).eligible;
}

/**
 * Server-side configuration of the return window. No default: an absent or
 * invalid value is reported as UNCONFIGURED so the owner can decide it.
 */
export function configuredReturnWindowDays(): number | null {
  const raw = (process.env.RETURN_WINDOW_DAYS ?? "").trim();
  if (raw === "") return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : null;
}

/* ── Decisions (pure) ────────────────────────────────────────────────────── */

export type ReturnDecision = "approve" | "reject" | "needs_evidence";

const DECISIONS = new Set<string>(["approve", "reject", "needs_evidence"]);

const STATUS_FOR_DECISION: Record<ReturnDecision, ReturnStatus> = {
  approve: "approved",
  reject: "rejected",
  needs_evidence: "needs_evidence",
};

/** Which decisions are legal from which current status. Terminal = no moves. */
export const DECISION_TRANSITIONS: Record<string, readonly ReturnDecision[]> = {
  pending: ["approve", "reject", "needs_evidence"],
  needs_evidence: ["approve", "reject"],
};

export interface ReturnDecisionInput {
  /** Current status of the return request. Missing status is treated as pending. */
  status?: string | null;
  /** The decision reason. REQUIRED when rejecting; optional otherwise. */
  reason?: string | null;
  decision_note?: string | null;
  note?: string | null;
  [key: string]: unknown;
}

export interface ReturnDecisionResult {
  ok: boolean;
  decision?: ReturnDecision;
  /** Status to persist when ok. */
  status?: ReturnStatus;
  /** Normalised decision reason (null when none supplied). */
  reason: string | null;
  actor: string;
  error?: string;
}

const failed = (actor: string, error: string): ReturnDecisionResult => ({
  ok: false,
  reason: null,
  actor,
  error,
});

/**
 * Pure decision rule. Reject always needs a reason. Decisions are only legal
 * from a decidable status, and the actor must be present (auditability).
 */
export function decideReturn(
  request: ReturnDecisionInput | null | undefined,
  decision: unknown,
  actor: unknown
): ReturnDecisionResult {
  const who = typeof actor === "string" ? actor.trim() : "";
  if (!who) return failed(who, "An actor is required to decide a return.");
  if (!request || typeof request !== "object") {
    return failed(who, "A return request is required.");
  }

  const move = asStatus(decision) as ReturnDecision;
  if (!DECISIONS.has(move)) {
    return failed(who, "decision must be one of: approve, reject, needs_evidence.");
  }

  const current = asStatus(request.status) || "pending";
  const allowed = DECISION_TRANSITIONS[current];
  if (!allowed) {
    return failed(who, `Cannot decide a return already in status "${current}".`);
  }
  if (!allowed.includes(move)) {
    return failed(who, `Cannot move a return from "${current}" to "${move}".`);
  }

  const rawReason =
    request.reason ?? request.decision_note ?? request.note ?? null;
  const reason =
    typeof rawReason === "string" && rawReason.trim() ? rawReason.trim() : null;

  // Rejections without a reason are the failure mode this whole rule exists to
  // prevent: a rejected customer must be told why.
  if (move === "reject" && !reason) {
    return failed(who, "A reason is required to reject a return.");
  }

  return {
    ok: true,
    decision: move,
    status: STATUS_FOR_DECISION[move],
    reason,
    actor: who,
  };
}

/* ── Restock rule (pure) ─────────────────────────────────────────────────── */

export type RestockDecision = "restock" | "no_restock";

/** Conditions that make a returned physical item safe to put back on sale. */
export const RESTOCKABLE_CONDITIONS = new Set([
  "new",
  "as_new",
  "unopened",
  "sealed",
  "like_new",
  "excellent",
  "good",
  "resellable",
]);

export interface ReturnItemLike {
  is_digital?: unknown;
  digital?: unknown;
  is_custom?: unknown;
  custom?: unknown;
  made_to_order?: unknown;
  [key: string]: unknown;
}

/**
 * Digital/custom/made-to-order items and anything not in a resellable condition
 * are never restocked. Everything else in a resellable condition is restocked.
 */
export function restockDecision(
  item: ReturnItemLike | null | undefined,
  condition: unknown
): RestockDecision {
  if (!item || typeof item !== "object") return "no_restock";
  if (item.is_digital || item.digital) return "no_restock";
  if (item.is_custom || item.custom || item.made_to_order) return "no_restock";

  const normalised =
    typeof condition === "string"
      ? condition.trim().toLowerCase().replace(/[\s-]+/g, "_")
      : "";
  return RESTOCKABLE_CONDITIONS.has(normalised) ? "restock" : "no_restock";
}

/* ── Refund-driven restoration eligibility (pure, policy-derived) ────────── */

/**
 * The physical state that a restock decision is derived from. These are NOT new
 * business rules: they name the return/cancellation states already present in
 * the domain (the return status machine in this file, the fulfilment status
 * machine, and the cancellation flow). The caller supplies the state that
 * already exists; we never infer it from a refund approval.
 */
export type RestorationTrigger =
  | "refund_approved_only"
  | "pre_dispatch_cancellation"
  | "post_dispatch_cancellation"
  | "return_requested"
  | "return_approved"
  | "return_received"
  | "return_inspected"
  | "restock_approved"
  | "non_restockable_return"
  | "refund_without_return";

/**
 * Owner/operator-supplied policy inputs. Every field is optional ON PURPOSE:
 * an absent value is an unknown owner decision, never a default. See
 * REFUND_AND_RETURN_POLICY.md ("Restock eligibility is owner-gated") — the
 * return window, the resellable condition and the deliberate restock decision
 * are all supplied by a person. We fail safe when any of them is undefined.
 */
export interface RestockPolicyInput {
  /** Condition recorded at inspection (must be in RESTOCKABLE_CONDITIONS). */
  condition?: unknown;
  /** Explicit owner/operator approval to put this unit back on sale. */
  restockApproved?: boolean;
  /** The physical unit is back in the seller's hands. */
  physicallyReceived?: boolean;
  /** The physical unit has been inspected. */
  inspected?: boolean;
  /** The order had already been dispatched before cancellation. */
  dispatched?: boolean;
}

/** Per-unit context, extending the item shape used by {@link restockDecision}. */
export interface RestockItemContext extends ReturnItemLike {
  unique_artwork?: unknown;
  one_of_one?: unknown;
}

export interface RestockEligibility {
  eligible: boolean;
  reason: string;
  /** True when ineligibility is due to a missing owner/policy input. */
  needsOwnerDecision: boolean;
}

const ineligible = (reason: string, needsOwnerDecision = false): RestockEligibility => ({
  eligible: false,
  reason,
  needsOwnerDecision,
});
const eligible = (reason: string): RestockEligibility => ({
  eligible: true,
  reason,
  needsOwnerDecision: false,
});

/** Digital / custom / made-to-order / one-of-one art is never restocked. */
export function isPhysicalRestockableItem(item: RestockItemContext | null | undefined): boolean {
  if (!item || typeof item !== "object") return false;
  if (item.is_digital || item.digital) return false;
  if (item.is_custom || item.custom || item.made_to_order) return false;
  if (item.unique_artwork || item.one_of_one) return false;
  return true;
}

function hasCondition(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * A physical return reaches "restockable" only after all documented inputs are
 * present: received, inspected, explicitly restock-approved and in a
 * resellable condition. Any undefined input blocks with `needsOwnerDecision`.
 */
function physicalReturnEligibility(
  label: string,
  item: RestockItemContext,
  policy: RestockPolicyInput
): RestockEligibility {
  if (policy.physicallyReceived !== true) {
    return policy.physicallyReceived === undefined
      ? ineligible(`${label}: physical receipt is not recorded; owner decision required.`, true)
      : ineligible(`${label}: goods were not physically received.`);
  }
  if (policy.inspected !== true) {
    return policy.inspected === undefined
      ? ineligible(`${label}: inspection is not recorded; owner decision required.`, true)
      : ineligible(`${label}: goods were not inspected.`);
  }
  if (policy.restockApproved !== true) {
    return policy.restockApproved === undefined
      ? ineligible(`${label}: restock approval is not recorded; owner decision required.`, true)
      : ineligible(`${label}: restock was not approved.`);
  }
  if (!hasCondition(policy.condition)) {
    return ineligible(`${label}: item condition is not recorded; owner decision required.`, true);
  }
  if (restockDecision(item, policy.condition) !== "restock") {
    return ineligible(`${label}: condition is not in RESTOCKABLE_CONDITIONS.`);
  }
  return eligible(`${label}: physical return received, inspected and resellable.`);
}

/**
 * Derive restock eligibility from an EXISTING return/cancellation state plus the
 * documented policy. No rule is invented here:
 *  - a refund approval is a permission, never a restock trigger;
 *  - refund-without-return is a money-only decision (no goods to restock);
 *  - a digital / custom / made-to-order / unique-artwork item is never restocked;
 *  - pre-dispatch cancellation restores consumed stock mechanically (this is
 *    what the existing cancel route already does);
 *  - a dispatched cancellation / return only restocks after receipt, inspection,
 *    explicit restock approval and a resellable condition per restockDecision();
 *  - any undefined owner input fails safe with `needsOwnerDecision = true`.
 */
export function deriveRestockEligibility(
  trigger: RestorationTrigger,
  item: RestockItemContext | null | undefined,
  policy: RestockPolicyInput | null | undefined
): RestockEligibility {
  const t = asStatus(trigger);
  const p: RestockPolicyInput = policy ?? {};

  if (t === "refund_approved_only") {
    return ineligible("A refund approval is a permission, not a restock trigger.");
  }
  if (t === "refund_without_return") {
    return ineligible("Refund without physical return: no goods to restock.");
  }
  if (t === "non_restockable_return") {
    return ineligible("Return was recorded as non-restockable.");
  }
  if (t === "return_requested" || t === "return_approved") {
    return ineligible("Return has not been physically received yet.");
  }
  if (!isPhysicalRestockableItem(item)) {
    return ineligible("Digital, custom, made-to-order or unique artwork is never restocked.");
  }

  if (t === "pre_dispatch_cancellation") {
    if (p.dispatched !== false) {
      return p.dispatched === undefined
        ? ineligible("Dispatch status is not recorded; owner decision required.", true)
        : ineligible("Order was already dispatched; not a pre-dispatch cancellation.");
    }
    return eligible("Pre-dispatch cancellation: consumed stock can be restored.");
  }

  if (
    t === "post_dispatch_cancellation" ||
    t === "return_received" ||
    t === "return_inspected" ||
    t === "restock_approved"
  ) {
    return physicalReturnEligibility(
      t.replace(/_/g, " "),
      item as RestockItemContext,
      p
    );
  }

  return ineligible(`Unknown restoration trigger "${trigger || "none"}".`, true);
}

/* ── DB helpers (injectable executor) ────────────────────────────────────── */

export interface ReturnRow {
  id: string;
  order_id: string;
  customer_id: string | null;
  customer_email: string;
  reason: string | null;
  status: string;
  items: unknown;
  created_at: string;
  updated_at: string;
  [key: string]: unknown;
}

function parseItems(value: unknown): unknown {
  if (Array.isArray(value) || (value && typeof value === "object")) return value;
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
  return value ?? null;
}

function asReturnRow(row: any): ReturnRow {
  return { ...row, items: parseItems(row.items) };
}

/** All return requests, newest first. */
export async function listReturns(
  ex: QueryExecutor = defaultQuery
): Promise<ReturnRow[]> {
  const rows = await ex(
    "SELECT * FROM return_requests ORDER BY created_at DESC LIMIT 200"
  );
  return (rows ?? []).map(asReturnRow);
}

/** Single return request, or null. Used by the decision route for its status. */
export async function getReturn(
  id: string,
  ex: QueryExecutor = defaultQuery
): Promise<ReturnRow | null> {
  const rows = await ex(
    "SELECT * FROM return_requests WHERE id = $1 LIMIT 1",
    [id]
  );
  const row = rows?.[0];
  return row ? asReturnRow(row) : null;
}

export interface ReturnPatch {
  /** Column update: the new status. */
  status?: string | null;
  /** Column update: the customer's reason. Not overwritten by decision reasons. */
  reason?: string | null;
  /** Audit-only metadata below. */
  decision?: ReturnDecision | null;
  decision_reason?: string | null;
  refund_request_id?: string | null;
  actor_role?: string | null;
  [key: string]: unknown;
}

const AUDIT_INSERT =
  "INSERT INTO audit_log " +
  "(entity_type, entity_id, action, old_values, new_values, user_email, user_role, created_at) " +
  "VALUES ($1, $2, $3, $4, $5, $6, $7, now())";

/**
 * Update a return's status and/or reason and record who did it and when.
 * Only status/reason are writable columns; decision metadata goes to
 * `audit_log` (the durable structure available — `return_requests` has no
 * decision columns). Audit metadata is written through the SAME executor so a
 * test with a fake can assert it, and so it participates in the caller's tx.
 */
export async function updateReturn(
  id: string,
  patch: ReturnPatch,
  actor: string,
  ex: QueryExecutor = defaultQuery
): Promise<ReturnRow | null> {
  if (!id) throw new ReturnValidationError("A return id is required.");
  const who = typeof actor === "string" ? actor.trim() : "";
  if (!who) throw new ReturnValidationError("An actor is required to update a return.");
  if (!patch || typeof patch !== "object") {
    throw new ReturnValidationError("A patch object is required.");
  }

  const sets: string[] = [];
  const params: any[] = [];
  if (Object.prototype.hasOwnProperty.call(patch, "status")) {
    const status = asStatus(patch.status);
    if (!KNOWN_STATUSES.has(status)) {
      throw new ReturnValidationError(`Unknown return status: ${status || String(patch.status)}`);
    }
    params.push(status);
    sets.push(`status = $${params.length}`);
  }
  if (Object.prototype.hasOwnProperty.call(patch, "reason")) {
    params.push(patch.reason == null ? null : String(patch.reason));
    sets.push(`reason = $${params.length}`);
  }
  if (sets.length === 0) {
    throw new ReturnValidationError("patch must update status and/or reason.");
  }

  const before = await getReturn(id, ex);
  if (!before) return null;

  params.push(id);
  const updatedRows = await ex(
    `UPDATE return_requests SET ${sets.join(", ")}, updated_at = now() WHERE id = $${params.length} RETURNING *`,
    params
  );
  const updatedRow = updatedRows?.[0];
  if (!updatedRow) return null;

  const decision = patch.decision ?? null;
  const newValues = {
    status: patch.status == null ? before.status : asStatus(patch.status),
    decision,
    decision_reason: patch.decision_reason ?? null,
    refund_request_id: patch.refund_request_id ?? null,
    actor: who,
    decided_at: new Date().toISOString(),
  };
  await ex(AUDIT_INSERT, [
    "return_request",
    id,
    decision ? `return.decision.${decision}` : "return.update",
    JSON.stringify({ status: before.status, reason: before.reason }),
    JSON.stringify(newValues),
    who,
    patch.actor_role ?? null,
  ]);

  return asReturnRow(updatedRow);
}

/**
 * Link a return to an existing refund. `return_requests` has no link column, so
 * the association is recorded as a `return.refund_linked` audit row whose
 * `new_values` carries the refund id, and is readable via `getLinkedRefund`.
 */
export async function linkRefund(
  returnId: string,
  refundRequestId: string,
  ex: QueryExecutor = defaultQuery
): Promise<void> {
  if (!returnId || !refundRequestId) {
    throw new ReturnValidationError("returnId and refundRequestId are required.");
  }
  const refund = await ex(
    "SELECT id FROM order_refunds WHERE id = $1 LIMIT 1",
    [refundRequestId]
  );
  if (!refund?.[0]) {
    throw new ReturnValidationError(`Refund ${refundRequestId} does not exist.`);
  }
  await ex(AUDIT_INSERT, [
    "return_request",
    returnId,
    "return.refund_linked",
    null,
    JSON.stringify({
      return_id: returnId,
      refund_request_id: refundRequestId,
      linked_at: new Date().toISOString(),
    }),
    "system",
    "system",
  ]);
}

/** Read back the refund id linked to a return (latest link wins). */
export async function getLinkedRefund(
  returnId: string,
  ex: QueryExecutor = defaultQuery
): Promise<string | null> {
  const rows = await ex(
    "SELECT new_values FROM audit_log " +
      "WHERE entity_type = $1 AND entity_id = $2 AND action = $3 " +
      "ORDER BY created_at DESC LIMIT 1",
    ["return_request", returnId, "return.refund_linked"]
  );
  const raw = rows?.[0]?.new_values;
  if (!raw) return null;
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    return typeof parsed?.refund_request_id === "string"
      ? parsed.refund_request_id
      : null;
  } catch {
    return null;
  }
}
