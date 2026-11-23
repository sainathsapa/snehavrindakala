/**
 * Pure integration layer: partner fulfilment status -> customer-facing order
 * status -> shipment status (FINAL GO, A106).
 *
 * This module does NOT reimplement any critical-path contract. It composes the
 * three already-shipped, independently tested modules:
 *
 *   - `lib/fulfilment/allocate.ts`  — the forward-only group status machine
 *     (`canTransition`, `isTerminal`).
 *   - `lib/customer-order/unified.ts` (A101) — the customer-facing status
 *     vocabulary and the single source of truth for status rollup
 *     (`overallStatus`, `CustomerOverallStatus`).
 *   - `lib/shipping/verify.ts` (A61) — the canonical shipment vocabulary and
 *     the raw-carrier-status mapper (`mapShiprocketStatus`,
 *     `LocalShipmentStatus`).
 *
 * Everything here is deterministic and side-effect free: no DB, no network, no
 * payment/refund/email/deploy calls, no mutation of the inputs. The result is a
 * strict allow-list of status fields — no partner id, tenant id, item, price,
 * commission, payout, tax, refund or payment field is ever read or emitted.
 *
 * Consistency invariants enforced here:
 *  1. `customerStatus` is ALWAYS derived from the (possibly advanced) group
 *     statuses via A101's single rollup function.
 *  2. A group only ever advances along a LEGAL edge of A47's status machine;
 *     carrier events never skip stages or resurrect rejected/terminal groups.
 *  3. A shipment event can never touch a sibling group — rejection of one
 *     partner's group stays isolated to that group (and its items).
 *  4. All groups delivered -> customer status "fulfilled" (parent delivered).
 */

import type { FulfilmentGroup, FulfilmentStatus } from "@/lib/fulfilment/types";
import { canTransition, isTerminal } from "@/lib/fulfilment/allocate";
import {
  overallStatus,
  type CustomerOverallStatus,
  type StatusBearingGroup,
} from "@/lib/customer-order/unified";
import {
  LOCAL_SHIPMENT_STATUSES,
  mapShiprocketStatus,
  type LocalShipmentStatus,
} from "@/lib/shipping/verify";

/* ── Public aliases / types ─────────────────────────────────────────────────── */

/** Customer-facing status is A101's vocabulary, exposed under an integration name. */
export type DerivedCustomerStatus = CustomerOverallStatus;

/** The parent-order status that means "every group delivered". */
export const PARENT_DELIVERED_STATUS: DerivedCustomerStatus = "fulfilled";

/**
 * A carrier shipment event. `status` is the canonical A61 status; when absent,
 * `rawStatus` is normalised through A61's `mapShiprocketStatus` so the caller
 * can pass an unmodified carrier payload. `shipmentId`/`awb` are optional
 * correlation guards and are never emitted in the result.
 */
export interface ShipmentEvent {
  status?: LocalShipmentStatus | null;
  rawStatus?: unknown;
  shipmentId?: string | null;
  awb?: string | null;
  eventId?: string | null;
  sequence?: number | null;
  timestamp?: string | number | Date | null;
}

export type SyncSkipReason =
  | "unknown_status"
  | "wrong_shipment"
  | "no_group_equivalent"
  | "rejected_group"
  | "terminal_group"
  | "illegal_transition";

/**
 * Status-only projection of one sync. Deliberately contains NO partner id, no
 * group items, and no financial/tenant/PII fields — only the three statuses
 * being kept consistent plus diagnostics needed for persistence.
 */
export interface OrderSyncResult {
  /** Parent customer order id (carried through for correlation). */
  orderId: string;
  /** The group the event targeted, by id (no tenant / partner identifier). */
  groupId: string;
  /** Customer-facing parent order status, derived from all groups. */
  customerStatus: DerivedCustomerStatus;
  /** Fulfilment status of the targeted group after the event. */
  groupStatus: FulfilmentStatus;
  /** Canonical shipment status recorded from the event. */
  shipmentStatus: LocalShipmentStatus;
  /** True only when the group's fulfilment status actually advanced. */
  groupChanged: boolean;
  /** True when the event mapped to a known local shipment status. */
  shipmentApplied: boolean;
  /** Present when the event was recognised but did not advance the group. */
  reason?: SyncSkipReason;
}

/* ── 1. Customer rollup (delegates to A101 — single source of truth) ──────── */

/**
 * Derive the single customer-facing status from the statuses of an order's
 * fulfilment groups. This is a named integration entry point that delegates to
 * A101's `overallStatus` so the integration can never drift from the unified
 * customer view.
 *
 * Guarantees (inherited from A101, re-stated here because they are the point of
 * this mission):
 *  - every group delivered  -> "fulfilled" (the parent order is delivered);
 *  - one partner rejecting  -> "attention_needed", NEVER "cancelled", so a
 *    rejection is isolated to that partner's items and does not cancel the
 *    whole customer order;
 *  - a mix of delivered/active/cancelled -> partial statuses.
 */
export function deriveCustomerStatus(
  groups: ReadonlyArray<StatusBearingGroup>
): DerivedCustomerStatus {
  return overallStatus(groups);
}

/** True when there is at least one group and all of them are delivered. */
export function allGroupsDelivered(
  groups: ReadonlyArray<StatusBearingGroup>
): boolean {
  return groups.length > 0 && groups.every((g) => g.status === "delivered");
}

/* ── 2. Shipment -> group status mapping ───────────────────────────────────── */

/**
 * Map a canonical shipment status to the closest legal fulfilment status.
 * Returns `null` when there is no faithful group equivalent (failed/unknown)
 * — we never invent a group status to match a carrier string.
 *
 * Rationale: a group is handed to the courier as `dispatched`, so every
 * in-flight consignment state (created/picked_up/in_transit/out_for_delivery)
 * keeps the group at `dispatched`; only `delivered` advances the group to
 * `delivered`. Carrier `cancelled` has no legal edge from `dispatched`, so a
 * transition guard below keeps the group unchanged rather than skipping.
 */
export function shipmentToGroupStatus(
  status: LocalShipmentStatus
): FulfilmentStatus | null {
  switch (status) {
    case "delivered":
      return "delivered";
    case "created":
    case "picked_up":
    case "in_transit":
    case "out_for_delivery":
      return "dispatched";
    case "cancelled":
      return "cancelled";
    case "failed":
    case "unknown":
    default:
      return null;
  }
}

function resolveShipmentStatus(event: ShipmentEvent): LocalShipmentStatus {
  if (event?.status && (LOCAL_SHIPMENT_STATUSES as readonly string[]).includes(event.status)) {
    return event.status;
  }
  return mapShiprocketStatus(event?.rawStatus);
}

function sameId(a: string | null | undefined, b: string | null | undefined): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  return a.trim() !== "" && a.trim() === b.trim();
}

/**
 * Build the post-event status vector for the whole parent order without ever
 * mutating any input. The targeted group takes its advanced status; every
 * sibling is copied unchanged. The target is added once if callers omit it from
 * `allGroups`, and duplicate ids are collapsed so counts stay correct.
 */
function effectiveStatuses(
  group: FulfilmentGroup,
  nextStatus: FulfilmentStatus,
  allGroups: ReadonlyArray<FulfilmentGroup> | undefined
): StatusBearingGroup[] {
  const siblings = allGroups ?? [group];
  const out: StatusBearingGroup[] = [];
  const seen = new Set<string>();

  for (const g of siblings) {
    const key = g.id || `@@idx-${out.length}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ status: sameId(g.id, group.id) ? nextStatus : g.status });
  }
  if (!seen.has(group.id)) out.push({ status: nextStatus });
  return out;
}

/* ── 3. The integration sync ───────────────────────────────────────────────── */

/**
 * Reconcile one partner group, one carrier shipment event and the parent order
 * in a single pure step (Scenario A single-partner and Scenario B multi-partner).
 *
 * @param group       The group the shipment belongs to. Never mutated.
 * @param event       The carrier event (canonical or raw status).
 * @param allGroups   All groups of the same parent order, including `group`.
 *                    Defaults to `[group]`. Siblings are never modified and are
 *                    used only to derive the parent status.
 */
export function syncStatuses(
  group: FulfilmentGroup,
  event: ShipmentEvent,
  allGroups?: ReadonlyArray<FulfilmentGroup>
): OrderSyncResult {
  const shipmentStatus = resolveShipmentStatus(event);
  const orderId = group.customer_order_id;
  const groupId = group.id;

  const base = (reason?: SyncSkipReason): OrderSyncResult => ({
    orderId,
    groupId,
    customerStatus: deriveCustomerStatus(effectiveStatuses(group, group.status, allGroups)),
    groupStatus: group.status,
    shipmentStatus,
    groupChanged: false,
    shipmentApplied: shipmentStatus !== "unknown",
    ...(reason ? { reason } : {}),
  });

  // 1. An unrecognised carrier status is never guessed at.
  if (shipmentStatus === "unknown") return base("unknown_status");

  // 2. Correlation guard: a stray event for a different consignment must not
  //    advance this group. Only enforced when BOTH sides supply an id.
  if (group.shipment_id && event?.shipmentId && !sameId(group.shipment_id, event.shipmentId)) {
    return base("wrong_shipment");
  }

  const target = shipmentToGroupStatus(shipmentStatus);
  if (target === null) return base("no_group_equivalent");

  // 3. A repeated / already-reconciled event is a harmless no-op.
  if (target === group.status) return base();

  // 4. A rejected group is never resurrected by a carrier event; its rejection
  //    stays isolated to its own items. Likewise terminal groups are immutable.
  if (group.status === "rejected") return base("rejected_group");
  if (isTerminal(group.status)) return base("terminal_group");

  // 5. Respect the forward-only status machine — no skipped stages.
  if (!canTransition(group.status, target)) return base("illegal_transition");

  const customerStatus = deriveCustomerStatus(effectiveStatuses(group, target, allGroups));
  return {
    orderId,
    groupId,
    customerStatus,
    groupStatus: target,
    shipmentStatus,
    groupChanged: true,
    shipmentApplied: true,
  };
}
