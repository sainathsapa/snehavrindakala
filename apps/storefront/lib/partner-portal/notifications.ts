/**
 * Partner-portal notifications.
 *
 * Decision (per the FINAL GO contract): partner notifications are derived from
 * `partner_audit_log` (migration 002), NOT from `app_notifications`. That table
 * already exists, is keyed by `partner_id`, and needs no new migration. Reading
 * `app_notifications` would also risk leaking admin-only audiences, which this
 * module must never do.
 *
 * Isolation is enforced by routing every query through `tenantQuery(ctx, ...)`
 * with a `{partner}` predicate. There is deliberately no parameter for a
 * partner id supplied by a caller: it is injected from the server-side
 * `PartnerContext` only. A partner can therefore never read another partner's
 * audit rows, no matter what id arrives in a URL, body or header.
 *
 * `partner_audit_log` is append-only and has no `read` column. To provide read
 * state without a migration, read status is stored in the row's existing
 * `metadata` JSONB (`metadata.read`). `markRead` still goes through
 * `tenantQuery`, so even this update is scoped to the authenticated partner.
 */

import type { PartnerContext } from "@/lib/partner/types";
import {
  tenantQuery,
  type QueryExecutor,
} from "@/lib/partner/repository";

/** Friendly, UI-facing shape. Never exposes actor emails or raw audit fields. */
export interface PartnerNotification {
  id: string;
  title: string;
  body: string;
  /** ISO-8601 timestamp string. */
  time: string;
  /** Relevant partner-portal section, or the notifications inbox as fallback. */
  href: string;
  read: boolean;
}

/** Shape we read from `partner_audit_log`. */
export interface AuditRow {
  id: string;
  partner_id?: string | null;
  actor_email?: string | null;
  actor_role?: string | null;
  action: string;
  entity_type?: string | null;
  entity_id?: string | null;
  metadata?: unknown;
  created_at: string | Date;
}

/* ------------------------------------------------------------------ *
 * Relevance — fulfilment-facing events only
 * ------------------------------------------------------------------ */

// Events that affect a partner's catalogue, orders, fulfilment or money.
const RELEVANT =
  /order|fulfil|shipment|shipping|ship|product|inventory|stock|settlement|payout|earning|statement|refund|delivery/i;

// Housekeeping/security events are audit noise, not partner notifications.
const IRRELEVANT =
  /login|logout|sign[-_ ]?in|sign[-_ ]?up|auth|session|password|token|profile|team|member|invite|settings|api[-_ ]?key|audit/i;

function isFulfilmentRelevant(row: AuditRow): boolean {
  const text = `${row?.action ?? ""} ${row?.entity_type ?? ""}`;
  return RELEVANT.test(text) && !IRRELEVANT.test(text);
}

/* ------------------------------------------------------------------ *
 * Pure mapper
 * ------------------------------------------------------------------ */

const SECTION_HREFS: Record<string, string> = {
  order: "/partner/orders",
  fulfilment_group: "/partner/orders",
  fulfillment_group: "/partner/orders",
  fulfilment: "/partner/orders",
  shipment: "/partner/shipments",
  shipping: "/partner/shipments",
  product: "/partner/products",
  partner_product: "/partner/products",
  inventory: "/partner/inventory",
  variant_stock: "/partner/inventory",
  settlement: "/partner/statements",
  settlement_batch: "/partner/statements",
  statement: "/partner/statements",
  payout: "/partner/earnings",
  earning: "/partner/earnings",
  earnings: "/partner/earnings",
  refund: "/partner/earnings",
  refund_execution: "/partner/earnings",
};

function humanize(action: string): string {
  return String(action || "")
    .replace(/[._:/-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function jsonMetadata(metadata: unknown): Record<string, any> {
  if (metadata && typeof metadata === "object") return metadata as Record<string, any>;
  if (typeof metadata === "string") {
    try {
      const parsed = JSON.parse(metadata);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
}

function isoTime(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : String(value);
}

function copyFor(row: AuditRow): { title: string; body: string } {
  const action = String(row.action ?? "");
  const a = action.toLowerCase();
  const label = humanize(action) || "Partner update";
  const ref = row.entity_id ? ` (${row.entity_id})` : "";

  let title = label;
  if (/ship|dispatch|deliver/.test(a)) title = "Shipment update";
  else if (/order|fulfil/.test(a)) title = "Order update";
  else if (/product/.test(a)) title = "Catalogue update";
  else if (/inventory|stock/.test(a)) title = "Inventory alert";
  else if (/settlement|payout|earning|statement|refund/.test(a)) title = "Payment update";

  return { title, body: `${label}${ref}.` };
}

/**
 * Pure mapper: an audit row -> a friendly notification, or `null` when the row
 * is not fulfilment-relevant. No DB access, no partner id of any kind leaks
 * into the result.
 */
export function notificationFromAudit(row: AuditRow): PartnerNotification | null {
  if (!row || !isFulfilmentRelevant(row)) return null;

  const { title, body } = copyFor(row);
  const entityType = String(row.entity_type ?? "").toLowerCase();
  const metadata = jsonMetadata(row.metadata);

  return {
    id: String(row.id),
    title,
    body,
    time: isoTime(row.created_at),
    href: SECTION_HREFS[entityType] ?? "/partner/notifications",
    read: metadata.read === true,
  };
}

/* ------------------------------------------------------------------ *
 * Tenant-scoped reads / writes
 * ------------------------------------------------------------------ */

const LIST_SQL =
  "SELECT id, partner_id, actor_email, actor_role, action, entity_type, " +
  "entity_id, metadata, created_at FROM partner_audit_log " +
  "WHERE partner_id = {partner} ORDER BY created_at DESC LIMIT $1";

/** List only this partner's fulfilment-relevant notifications, newest first. */
export async function listPartnerNotifications(
  ctx: PartnerContext,
  executor?: QueryExecutor
): Promise<PartnerNotification[]> {
  const rows = await tenantQuery<AuditRow>(ctx, LIST_SQL, [50], executor);
  return rows
    .map(notificationFromAudit)
    .filter((n): n is PartnerNotification => n !== null);
}

/**
 * Mark one of THIS partner's notifications as read. The `id` is an audit-row
 * id only; it is always checked together with `partner_id = {partner}` so a
 * guessed or foreign id cannot mark another tenant's row.
 */
export async function markRead(
  ctx: PartnerContext,
  id: string,
  executor?: QueryExecutor
): Promise<PartnerNotification | null> {
  if (typeof id !== "string" || !id.trim()) return null;

  const rows = await tenantQuery<AuditRow>(
    ctx,
    "UPDATE partner_audit_log " +
      "SET metadata = jsonb_set(metadata, '{read}', 'true'::jsonb) " +
      "WHERE id = $1 AND partner_id = {partner} " +
      "RETURNING id, partner_id, action, entity_type, entity_id, metadata, created_at",
    [id.trim()],
    executor
  );

  const row = rows[0];
  return row ? notificationFromAudit(row) : null;
}
