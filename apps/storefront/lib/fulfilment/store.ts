/**
 * DB-backed fulfilment store. Every partner-facing read/write goes through
 * `tenantQuery`, which binds `ctx.partnerId` into a `{partner}` predicate. A
 * partner id is NEVER accepted from a request; the only source is the verified
 * `PartnerContext`. A manipulated group id therefore returns no row / no-op.
 *
 * Admin (platform) helpers are clearly separated and are gated by
 * `requirePermission('orders:write')` in the route layer.
 */

import type { QueryResultRow } from "pg";
import { query as defaultQuery } from "@/lib/db";
import {
  findPartnerById,
  tenantQuery,
  type QueryExecutor,
} from "@/lib/partner/repository";
import type { PartnerContext } from "@/lib/partner/types";
import { assertNoDuplicateAllocation, canTransition } from "./allocate";
import type {
  AllocationGroup,
  AssignmentEvent,
  FulfilmentExtra,
  FulfilmentGroup,
  FulfilmentLineItem,
  FulfilmentStatus,
} from "./types";

/* ── Errors ───────────────────────────────────────────────────────────────── */

export class FulfilmentError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "FulfilmentError";
    this.code = code;
  }
}

export class FulfilmentValidationError extends FulfilmentError {
  constructor(message: string) {
    super("VALIDATION", message);
    this.name = "FulfilmentValidationError";
  }
}

export class InvalidTransitionError extends FulfilmentError {
  readonly from: FulfilmentStatus;
  readonly to: FulfilmentStatus;
  constructor(from: FulfilmentStatus, to: FulfilmentStatus) {
    super("INVALID_TRANSITION", `Cannot transition fulfilment group from "${from}" to "${to}"`);
    this.name = "InvalidTransitionError";
    this.from = from;
    this.to = to;
  }
}

/* ── Constants / guards ──────────────────────────────────────────────────── */

const KNOWN_STATUSES = new Set<FulfilmentStatus>([
  "assigned", "accepted", "packing", "ready_for_dispatch",
  "dispatched", "delivered", "rejected", "cancelled",
]);

/** Columns a partner is allowed to set during a status transition. */
const ALLOWED_EXTRA_KEYS = new Set<keyof FulfilmentExtra>([
  "rejection_reason",
  "shipment_id",
]);

/**
 * Fields a partner may never submit. Fulfilment is strictly operational: no
 * price, payment, refund, commission, payout, currency or order identity may be
 * changed (nor the status, which is controlled only by the dedicated route).
 */
const FORBIDDEN_FIELDS = [
  "status", "partner_id", "customer_order_id", "customer_id", "email",
  "amount", "price", "unit_price", "total", "subtotal", "grand_total",
  "tax", "tax_total", "tax_rate", "discount", "discount_total", "shipping_total",
  "refund", "refund_amount", "refund_id", "payment", "payment_id",
  "payment_status", "payment_collection", "commission", "commission_rate",
  "payout", "payout_amount", "currency", "currency_code",
] as const;

/** Call on every partner-mutating route body; throws on any financial field. */
export function assertNoForbiddenFulfilmentFields(body: Record<string, unknown>): void {
  if (!body || typeof body !== "object") {
    throw new FulfilmentValidationError("A JSON object body is required");
  }
  const bad = FORBIDDEN_FIELDS.filter((f) =>
    Object.prototype.hasOwnProperty.call(body, f)
  );
  if (bad.length > 0) {
    throw new FulfilmentValidationError(
      `Field(s) not permitted for partner fulfilment: ${bad.join(", ")}`
    );
  }
}

function newId(): string {
  const c = (globalThis as any).crypto;
  if (c && typeof c.randomUUID === "function") return c.randomUUID() as string;
  return `fg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function parseJson<T>(value: unknown, fallback: T): T {
  if (Array.isArray(value) || (value && typeof value === "object")) return value as T;
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  return fallback;
}

function historyOf(raw: unknown): AssignmentEvent[] {
  return parseJson<AssignmentEvent[]>(raw, []);
}

function asGroup(row: any): FulfilmentGroup {
  return {
    ...row,
    customer_order_id: row.customer_order_id,
    items: parseJson<FulfilmentLineItem[]>(row.items, []),
    assignment_history: historyOf(row.assignment_history),
  };
}

/* ── Writes: allocation (platform / admin) ───────────────────────────────── */

/**
 * Insert one fulfilment group per partner for a customer order. Idempotent:
 * the UNIQUE(customer_order_id, partner_id) conflict is a no-op, so retrying a
 * request never duplicates a group. The initial assignment event is embedded
 * in the INSERT so a newly created row always has append-only history.
 */
export async function createAllocations(
  customerOrderId: string,
  groups: readonly AllocationGroup[],
  executor: QueryExecutor = defaultQuery,
  actor = "platform-admin"
): Promise<FulfilmentGroup[]> {
  if (!customerOrderId) {
    throw new FulfilmentValidationError("customerOrderId is required");
  }
  const normalized = groups.map((g) => ({
    ...g,
    customer_order_id: customerOrderId,
  }));
  assertNoDuplicateAllocation(normalized);

  const inserted: FulfilmentGroup[] = [];
  for (const group of normalized) {
    const id = newId();
    const history: AssignmentEvent[] = [
      {
        at: new Date().toISOString(),
        from: null,
        to: "assigned",
        actor,
        action: "allocated",
      },
    ];
    const rows = await executor(
      "INSERT INTO fulfilment_group " +
        "(id, customer_order_id, partner_id, status, items, assignment_history, created_at, updated_at) " +
        "VALUES ($1, $2, $3, 'assigned', $4::jsonb, $5::jsonb, now(), now()) " +
        "ON CONFLICT (customer_order_id, partner_id) DO NOTHING " +
        "RETURNING *",
      [
        id,
        customerOrderId,
        group.partner_id,
        JSON.stringify(group.items ?? []),
        JSON.stringify(history),
      ]
    );
    for (const row of rows ?? []) inserted.push(asGroup(row));
  }
  return inserted;
}

/* ── Reads: partner-scoped (MUST go through tenantQuery) ─────────────────── */

export async function listPartnerGroups(
  ctx: PartnerContext,
  executor?: QueryExecutor
): Promise<FulfilmentGroup[]> {
  const rows = await tenantQuery(
    ctx,
    "SELECT * FROM fulfilment_group WHERE partner_id = {partner} " +
      "ORDER BY created_at DESC LIMIT 200",
    [],
    executor
  );
  return rows.map(asGroup);
}

/** Returns null — never a foreign row — when the id belongs to another tenant. */
export async function getPartnerGroup(
  ctx: PartnerContext,
  id: string,
  executor?: QueryExecutor
): Promise<FulfilmentGroup | null> {
  const rows = await tenantQuery(
    ctx,
    "SELECT * FROM fulfilment_group WHERE id = $1 AND partner_id = {partner} LIMIT 1",
    [id],
    executor
  );
  const row = rows[0];
  return row ? asGroup(row) : null;
}

/* ── Writes: partner-scoped status transitions ───────────────────────────── */

/**
 * Transition a group after re-loading it through the tenant-scoped helper.
 * The UPDATE itself also carries `partner_id = {partner}`, so even a forged id
 * cannot update another partner's row. `extra` is an allowlist — unknown keys
 * (especially financial ones) are rejected before any SQL is built.
 */
export async function updateGroupStatus(
  ctx: PartnerContext,
  id: string,
  to: FulfilmentStatus,
  actor: string,
  extra: FulfilmentExtra = {},
  executor?: QueryExecutor
): Promise<FulfilmentGroup | null> {
  if (!KNOWN_STATUSES.has(to)) {
    throw new FulfilmentValidationError(`Unknown fulfilment status: ${to}`);
  }
  for (const key of Object.keys(extra)) {
    if (!ALLOWED_EXTRA_KEYS.has(key as keyof FulfilmentExtra)) {
      throw new FulfilmentValidationError(`Field not permitted on transition: ${key}`);
    }
  }

  // Tenant-scoped load: a foreign id yields null and the operation is a no-op.
  const group = await getPartnerGroup(ctx, id, executor);
  if (!group) return null;

  if (!canTransition(group.status, to)) {
    throw new InvalidTransitionError(group.status, to);
  }

  const history = [
    ...historyOf(group.assignment_history),
    {
      at: new Date().toISOString(),
      from: group.status,
      to,
      actor,
      action: "status_change",
      note: extra.rejection_reason ?? null,
    } as AssignmentEvent,
  ];

  const rows = await tenantQuery(
    ctx,
    "UPDATE fulfilment_group SET " +
      "status = $1, " +
      "assignment_history = $2::jsonb, " +
      "rejection_reason = COALESCE($3, rejection_reason), " +
      "shipment_id = COALESCE($4, shipment_id), " +
      "updated_at = now() " +
      "WHERE id = $5 AND partner_id = {partner} " +
      "RETURNING *",
    [
      to,
      JSON.stringify(history),
      extra.rejection_reason ?? null,
      extra.shipment_id ?? null,
      id,
    ],
    executor
  );
  const row = rows[0];
  return row ? asGroup(row) : null;
}

/* ── Platform / admin helpers (no tenant scope; require admin permission) ── */

export async function getGroupById(
  id: string,
  executor: QueryExecutor = defaultQuery
): Promise<FulfilmentGroup | null> {
  const rows = await executor(
    "SELECT * FROM fulfilment_group WHERE id = $1 LIMIT 1",
    [id]
  );
  const row = rows[0];
  return row ? asGroup(row) : null;
}

export async function listGroupsForOrder(
  customerOrderId: string,
  executor: QueryExecutor = defaultQuery
): Promise<FulfilmentGroup[]> {
  const rows = await executor(
    "SELECT * FROM fulfilment_group WHERE customer_order_id = $1 ORDER BY partner_id",
    [customerOrderId]
  );
  return rows.map(asGroup);
}

/** All groups still awaiting a partner action — the admin "unassigned" queue. */
export async function listAllocationQueue(
  executor: QueryExecutor = defaultQuery
): Promise<FulfilmentGroup[]> {
  const rows = await executor(
    "SELECT * FROM fulfilment_group WHERE status = 'assigned' ORDER BY created_at"
  );
  return rows.map(asGroup);
}

/** Admin reassign: move a group to another partner, keeping one group/partner. */
export async function reassignGroup(
  id: string,
  newPartnerId: string,
  actor: string,
  executor: QueryExecutor = defaultQuery
): Promise<FulfilmentGroup | null> {
  const group = await getGroupById(id, executor);
  if (!group) return null;

  const partner = await findPartnerById(newPartnerId, executor);
  if (!partner || partner.account_status !== "active") {
    throw new FulfilmentValidationError(
      `Partner ${newPartnerId} does not exist or is not active`
    );
  }
  if (newPartnerId === group.partner_id) return group;

  const siblings = await listGroupsForOrder(group.customer_order_id, executor);
  const proposed = siblings.map((g) =>
    g.id === id ? { ...g, partner_id: newPartnerId } : g
  );
  assertNoDuplicateAllocation(proposed);

  const history = [
    ...historyOf(group.assignment_history),
    {
      at: new Date().toISOString(),
      from: group.status,
      to: group.status,
      actor,
      action: "reassigned",
      note: `${group.partner_id} -> ${newPartnerId}`,
    } as AssignmentEvent,
  ];

  const rows = await executor(
    "UPDATE fulfilment_group SET partner_id = $1, assignment_history = $2::jsonb, " +
      "updated_at = now() WHERE id = $3 RETURNING *",
    [newPartnerId, JSON.stringify(history), id]
  );
  const row = rows[0];
  return row ? asGroup(row) : null;
}

/** Admin cancel of a group, honouring the same status machine. */
export async function cancelGroupAsAdmin(
  id: string,
  actor: string,
  reason: string | null,
  executor: QueryExecutor = defaultQuery
): Promise<FulfilmentGroup | null> {
  const group = await getGroupById(id, executor);
  if (!group) return null;

  if (!canTransition(group.status, "cancelled")) {
    throw new InvalidTransitionError(group.status, "cancelled");
  }

  const history = [
    ...historyOf(group.assignment_history),
    {
      at: new Date().toISOString(),
      from: group.status,
      to: "cancelled",
      actor,
      action: "cancelled",
      note: reason,
    } as AssignmentEvent,
  ];

  const rows = await executor(
    "UPDATE fulfilment_group SET status = 'cancelled', " +
      "assignment_history = $1::jsonb, rejection_reason = COALESCE($2, rejection_reason), " +
      "updated_at = now() WHERE id = $3 RETURNING *",
    [JSON.stringify(history), reason, id]
  );
  const row = rows[0];
  return row ? asGroup(row) : null;
}

/** Re-export for route convenience. */
export type { QueryExecutor, QueryResultRow, FulfilmentGroup };
