/**
 * Customer-facing unified order model (Scenario B).
 *
 * A customer places ONE order, but that order may be split internally into one
 * `fulfilment_group` per owning partner (see `lib/fulfilment/types.ts` and
 * migration 002). This module is the read-only projection that turns the parent
 * order plus its partner groups into a SINGLE customer view.
 *
 * Design guarantees (all enforced by construction, not by convention):
 *  - PURE: no I/O, no mutation of the parent order, groups, or their nested
 *    references (including `payment_collections`). Outputs are fresh objects.
 *  - PRIVATE/FINANCIAL DATA NEVER LEAVES: the view is an allowlist. Partner
 *    tenant ids, legal names, contact details, registration/business profiles,
 *    commission/payout/earnings, prices, taxes, refunds and all payment
 *    references on the parent order are simply never read into the view.
 *  - The parent order and its payment references are NEVER altered or emitted.
 *  - Partner identity is shown ONLY as a public `display_name`, resolved from a
 *    caller-supplied directory. An internal `partner_id` is never emitted.
 *
 * This module intentionally contains no policy decisions about refunds,
 * cancellations or partial fulfilment. Those are owner-gated and recorded as
 * PENDING DECISION in `docs/release/CUSTOMER_ORDER_MODEL.md`.
 */

import type { FulfilmentGroup, FulfilmentStatus } from "@/lib/fulfilment/types";

/* ── Input types ───────────────────────────────────────────────────────────── */

/**
 * Structural view of the parent customer order (compatible with MedusaOrder).
 * Only the few public fields the customer is allowed to see are read. All other
 * fields — especially payment/financial ones — are deliberately ignored.
 */
export interface CustomerOrderSource {
  id: string;
  display_id?: number | string | null;
  created_at?: string | null;
  items?: ReadonlyArray<{
    /** Medusa order line id. Fulfilment line items refer to this as `item_id`. */
    id?: string | null;
    item_id?: string | null;
    title?: string | null;
    product_title?: string | null;
    variant_title?: string | null;
    variant_id?: string | null;
    quantity?: number | null;
  }> | null;
  /** Known but intentionally unread: payment_collections, total, payment_status, … */
  [key: string]: unknown;
}

/**
 * Public partner directory: internal partner id -> public display name.
 * Accepts a plain object, an ES Map, or a resolver function. The caller must
 * build this from authoritative, server-side partner records; an internal id is
 * never accepted from a customer request.
 */
export type PartnerDisplayDirectory =
  | Readonly<Record<string, string>>
  | ReadonlyMap<string, string>
  | ((partnerId: string) => string | undefined);

/** Generic, non-identifying label used when a partner has no display name. */
export const UNKNOWN_PARTNER_DISPLAY_NAME = "Marketplace partner";

/* ── Output types (allowlisted — no private/financial fields) ──────────────── */

/** Customer-facing overall status, derived ONLY from group statuses. */
export type CustomerOverallStatus =
  | "no_fulfilment"
  | "pending"
  | "in_progress"
  | "partially_fulfilled"
  | "fulfilled"
  | "partially_cancelled"
  | "cancelled"
  | "attention_needed";

/** Coarse, human-friendly progress bucket for a single group. */
export type GroupProgressLabel =
  | "not_started"
  | "in_progress"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "attention_needed";

/** One line of the customer order, annotated with its owning partner. */
export interface CustomerOrderItemView {
  item_id: string;
  title: string | null;
  variant_title: string | null;
  quantity: number;
  /** Public display name of the owning partner; null when the item is unmapped. */
  partner_display_name: string | null;
  /** Status of the group that owns this item; null when the item is unmapped. */
  fulfilment_status: FulfilmentStatus | null;
}

/** Per-group fulfilment progress. Contains no partner id or DB group id. */
export interface CustomerFulfilmentProgress {
  partner_display_name: string;
  status: FulfilmentStatus;
  item_count: number;
  total_quantity: number;
  /** 0..5 along the happy path (assigned..delivered); -1 for rejected/cancelled. */
  progress_stage: number;
  progress_label: GroupProgressLabel;
}

/** The single unified customer-facing order view. */
export interface CustomerOrderView {
  order_id: string;
  display_id: number | string | null;
  created_at: string | null;
  overall_status: CustomerOverallStatus;
  items: CustomerOrderItemView[];
  fulfilment: CustomerFulfilmentProgress[];
  summary: {
    total_items: number;
    total_quantity: number;
    group_count: number;
    delivered_group_count: number;
    active_group_count: number;
    cancelled_group_count: number;
    rejected_group_count: number;
  };
}

/* ── Status aggregation ────────────────────────────────────────────────────── */

/** The only input `overallStatus` needs — kept minimal so it is trivially pure. */
export interface StatusBearingGroup {
  status: FulfilmentStatus;
}

/**
 * Derive a single customer-facing status from the statuses of the order's
 * fulfilment groups. Pure and deterministic; uses no parent-order or payment
 * state. Precedence (highest first) is documented in CUSTOMER_ORDER_MODEL.md:
 *
 *   no groups            -> no_fulfilment
 *   all delivered        -> fulfilled
 *   all cancelled        -> cancelled
 *   any rejected         -> attention_needed
 *   some cancelled       -> partially_cancelled
 *   some delivered       -> partially_fulfilled
 *   all assigned         -> pending
 *   otherwise (active)   -> in_progress
 */
export function overallStatus(
  groups: ReadonlyArray<StatusBearingGroup>
): CustomerOverallStatus {
  const n = groups.length;
  if (n === 0) return "no_fulfilment";

  let delivered = 0;
  let cancelled = 0;
  let rejected = 0;
  let assigned = 0;

  for (const group of groups) {
    switch (group.status) {
      case "delivered":
        delivered += 1;
        break;
      case "cancelled":
        cancelled += 1;
        break;
      case "rejected":
        rejected += 1;
        break;
      case "assigned":
        assigned += 1;
        break;
      // accepted | packing | ready_for_dispatch | dispatched are "in flight".
      default:
        break;
    }
  }
  const active = n - delivered - cancelled - rejected;

  if (delivered === n) return "fulfilled";
  if (cancelled === n) return "cancelled";
  if (rejected > 0) return "attention_needed";
  if (cancelled > 0) return "partially_cancelled";
  if (delivered > 0) return "partially_fulfilled";
  if (assigned === n) return "pending";
  return "in_progress";
}

/* ── Helpers ───────────────────────────────────────────────────────────────── */

const HAPPY_PATH_STAGE: Readonly<Record<FulfilmentStatus, number>> = {
  assigned: 0,
  accepted: 1,
  packing: 2,
  ready_for_dispatch: 3,
  dispatched: 4,
  delivered: 5,
  rejected: -1,
  cancelled: -1,
};

function progressLabel(status: FulfilmentStatus): GroupProgressLabel {
  switch (status) {
    case "assigned":
      return "not_started";
    case "delivered":
      return "delivered";
    case "cancelled":
      return "cancelled";
    case "rejected":
      return "attention_needed";
    case "dispatched":
      return "shipped";
    default:
      // accepted | packing | ready_for_dispatch
      return "in_progress";
  }
}

function resolveDisplayName(
  directory: PartnerDisplayDirectory | undefined,
  partnerId: string
): string {
  if (!directory) return UNKNOWN_PARTNER_DISPLAY_NAME;
  let name: string | undefined;
  if (typeof directory === "function") {
    name = directory(partnerId);
  } else if (directory instanceof Map || "get" in directory) {
    name = (directory as ReadonlyMap<string, string>).get(partnerId);
  } else {
    name = (directory as Readonly<Record<string, string>>)[partnerId];
  }
  return name && name.length > 0 ? name : UNKNOWN_PARTNER_DISPLAY_NAME;
}

function lineItemId(
  item: NonNullable<CustomerOrderSource["items"]>[number]
): string {
  return String(item.id ?? item.item_id ?? "");
}

/* ── Main projection ───────────────────────────────────────────────────────── */

/**
 * Build the single customer-facing view of one order and its partner groups.
 *
 * @param parentOrder  The customer's parent order. Read for public fields only;
 *                     never mutated and never copied wholesale into the output.
 * @param fulfilmentGroups  All groups for this order (one per owning partner).
 * @param partnerDisplayDirectory  Server-side map of partner id -> public
 *                     display name. When omitted, a generic public label is
 *                     used so no internal partner id is ever exposed.
 */
export function buildCustomerOrderView(
  parentOrder: CustomerOrderSource,
  fulfilmentGroups: ReadonlyArray<FulfilmentGroup>,
  partnerDisplayDirectory?: PartnerDisplayDirectory
): CustomerOrderView {
  // Map each line item id to its owning group's public display name + status.
  // Matching is by stable line-item id; a line never belongs to two groups.
  const ownerByItemId = new Map<string, { name: string; status: FulfilmentStatus }>();
  for (const group of fulfilmentGroups) {
    const name = resolveDisplayName(partnerDisplayDirectory, group.partner_id);
    for (const groupItem of group.items ?? []) {
      if (groupItem && groupItem.item_id) {
        ownerByItemId.set(String(groupItem.item_id), { name, status: group.status });
      }
    }
  }

  // ALL parent items are shown, annotated with owning partner (or null if the
  // item has no group, e.g. an unmapped product awaiting admin assignment).
  const items: CustomerOrderItemView[] = [];
  let totalQuantity = 0;
  for (const sourceItem of parentOrder.items ?? []) {
    const itemId = lineItemId(sourceItem);
    if (!itemId) continue;
    const owner = ownerByItemId.get(itemId) ?? null;
    const quantity =
      typeof sourceItem.quantity === "number" && Number.isFinite(sourceItem.quantity)
        ? sourceItem.quantity
        : 0;
    totalQuantity += quantity;
    items.push({
      item_id: itemId,
      title: sourceItem.title ?? sourceItem.product_title ?? null,
      variant_title: sourceItem.variant_title ?? null,
      quantity,
      partner_display_name: owner ? owner.name : null,
      fulfilment_status: owner ? owner.status : null,
    });
  }

  // Per-group progress. Only public display name + status + counts are emitted.
  const fulfilment: CustomerFulfilmentProgress[] = fulfilmentGroups.map((group) => {
    const groupItems = group.items ?? [];
    return {
      partner_display_name: resolveDisplayName(
        partnerDisplayDirectory,
        group.partner_id
      ),
      status: group.status,
      item_count: groupItems.length,
      total_quantity: groupItems.reduce((sum, li) => sum + (li?.quantity ?? 0), 0),
      progress_stage: HAPPY_PATH_STAGE[group.status] ?? -1,
      progress_label: progressLabel(group.status),
    };
  });

  const deliveredGroupCount = fulfilmentGroups.filter(
    (g) => g.status === "delivered"
  ).length;
  const cancelledGroupCount = fulfilmentGroups.filter(
    (g) => g.status === "cancelled"
  ).length;
  const rejectedGroupCount = fulfilmentGroups.filter(
    (g) => g.status === "rejected"
  ).length;
  const activeGroupCount =
    fulfilmentGroups.length -
    deliveredGroupCount -
    cancelledGroupCount -
    rejectedGroupCount;

  return {
    order_id: parentOrder.id,
    display_id: parentOrder.display_id ?? null,
    created_at: parentOrder.created_at ?? null,
    overall_status: overallStatus(fulfilmentGroups),
    items,
    fulfilment,
    summary: {
      total_items: items.length,
      total_quantity: totalQuantity,
      group_count: fulfilmentGroups.length,
      delivered_group_count: deliveredGroupCount,
      active_group_count: activeGroupCount,
      cancelled_group_count: cancelledGroupCount,
      rejected_group_count: rejectedGroupCount,
    },
  };
}
