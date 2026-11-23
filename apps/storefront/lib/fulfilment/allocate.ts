/**
 * PURE allocation + status-machine helpers. No DB, no I/O, no side effects.
 *
 * Business rules:
 *  - A customer order has ONE parent order but MANY fulfilment groups, one per
 *    partner that owns at least one of its line items.
 *  - A partner can never get two groups for the same customer order.
 *  - The status machine is strictly forward-only, with the two explicit
 *    branches `assigned -> rejected` and `assigned/rejected -> cancelled`.
 */

import type {
  AllocationGroup,
  FulfilmentLineItem,
  FulfilmentStatus,
  ProductPartnerMap,
} from "./types";

/** Directed edges of the fulfilment status machine. */
const TRANSITIONS: Readonly<Record<FulfilmentStatus, readonly FulfilmentStatus[]>> = {
  assigned: ["accepted", "rejected", "cancelled"],
  accepted: ["packing"],
  packing: ["ready_for_dispatch"],
  ready_for_dispatch: ["dispatched"],
  dispatched: ["delivered"],
  delivered: [],
  rejected: ["cancelled"],
  cancelled: [],
};

/** Statuses with no outgoing edge — a group can never leave these states. */
const TERMINAL_STATUSES: ReadonlySet<FulfilmentStatus> = new Set<FulfilmentStatus>([
  "delivered",
  "cancelled",
]);

function mapLookup(map: ProductPartnerMap, productId: string): string | undefined {
  return map instanceof Map ? map.get(productId) : map[productId];
}

/**
 * Group a single customer order's line items by the partner that owns each
 * product. Returns one `AllocationGroup` per distinct partner.
 *
 * Items whose product has no partner mapping are intentionally omitted from the
 * groups (they stay unassigned and must be mapped by an admin before they can
 * be fulfilled — see `getUnassignedItems`). This keeps the DB's FK on
 * `partner_id` intact and never invents a partner identity.
 *
 * Ordering is deterministic: groups follow first appearance of the partner in
 * the input, and items keep their original relative order.
 */
export function allocateItemsToPartners(
  items: readonly FulfilmentLineItem[],
  productPartnerMap: ProductPartnerMap
): AllocationGroup[] {
  const groups: AllocationGroup[] = [];
  const byPartner = new Map<string, AllocationGroup>();
  const customerOrderId = items.find((i) => i.order_id)?.order_id ?? null;

  for (const item of items) {
    const productId = item.product_id;
    if (!productId) continue;
    const partnerId = mapLookup(productPartnerMap, productId);
    if (!partnerId) continue;

    let group = byPartner.get(partnerId);
    if (!group) {
      group = { customer_order_id: customerOrderId, partner_id: partnerId, items: [] };
      byPartner.set(partnerId, group);
      groups.push(group);
    }
    group.items.push({ ...item });
  }

  return groups;
}

/** Line items that have no owning partner and therefore remain unassigned. */
export function getUnassignedItems(
  items: readonly FulfilmentLineItem[],
  productPartnerMap: ProductPartnerMap
): FulfilmentLineItem[] {
  return items.filter((item) => {
    const productId = item.product_id;
    if (!productId) return true;
    return !mapLookup(productPartnerMap, productId);
  });
}

/** True when `to` is a legal direct successor of `from`. */
export function canTransition(
  from: FulfilmentStatus,
  to: FulfilmentStatus
): boolean {
  return (TRANSITIONS[from] ?? []).includes(to);
}

/** True when no further transition is possible from this status. */
export function isTerminal(status: FulfilmentStatus): boolean {
  return TERMINAL_STATUSES.has(status);
}

function groupKey(group: {
  customer_order_id?: string | null;
  customerOrderId?: string | null;
  partner_id: string;
}): string {
  const orderId = group.customer_order_id ?? group.customerOrderId ?? "";
  return `${orderId}::${group.partner_id}`;
}

/** Non-throwing duplicate check (useful for validation / reporting). */
export function hasDuplicateAllocation(
  groups: readonly {
    customer_order_id?: string | null;
    customerOrderId?: string | null;
    partner_id: string;
  }[]
): boolean {
  const seen = new Set<string>();
  for (const group of groups) {
    const key = groupKey(group);
    if (seen.has(key)) return true;
    seen.add(key);
  }
  return false;
}

/**
 * Throw if two groups would target the same (customer order, partner) pair.
 * The DB also enforces this with UNIQUE(customer_order_id, partner_id); this
 * check gives a clear failure before any write is attempted.
 */
export function assertNoDuplicateAllocation(
  groups: readonly {
    customer_order_id?: string | null;
    customerOrderId?: string | null;
    partner_id: string;
  }[]
): void {
  const seen = new Set<string>();
  for (const group of groups) {
    const key = groupKey(group);
    if (seen.has(key)) {
      throw new Error(
        `Duplicate fulfilment allocation for customer order ${groupKey(group)}: ` +
          "a partner may only have one group per customer order"
      );
    }
    seen.add(key);
  }
}
