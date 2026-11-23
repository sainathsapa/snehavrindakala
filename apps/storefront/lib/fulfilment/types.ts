/**
 * Fulfilment domain types for multi-partner customer orders.
 *
 * One customer order may contain items owned by several partners. The customer
 * still sees a single order; internally each partner gets exactly one
 * independently managed `fulfilment_group`. These types deliberately contain
 * NO payment, refund, price or payout fields — partner fulfilment must never be
 * able to read or mutate financial state (see the API routes for enforcement).
 */

/** A single line that needs to be fulfilled by exactly one partner. */
export interface FulfilmentLineItem {
  /** Medusa line-item id (stable identity of the line). */
  item_id: string;
  /** Medusa product id — used to resolve the owning partner. */
  product_id?: string | null;
  variant_id?: string | null;
  quantity: number;
  title?: string;
  /** Parent customer (Medusa) order id, when known. */
  order_id?: string | null;
}

export type FulfilmentStatus =
  | "assigned"
  | "accepted"
  | "packing"
  | "ready_for_dispatch"
  | "dispatched"
  | "delivered"
  | "rejected"
  | "cancelled";

/** One entry in the append-only assignment/transition history of a group. */
export interface AssignmentEvent {
  at: string;
  from: FulfilmentStatus | null;
  to: FulfilmentStatus;
  actor: string;
  action?: string;
  note?: string | null;
}

/**
 * The pre-persistence shape produced by `allocateItemsToPartners`.
 * `customer_order_id` is the single parent order shared by every group.
 */
export interface AllocationGroup {
  customer_order_id: string | null;
  partner_id: string;
  items: FulfilmentLineItem[];
}

/** Persisted row (mirrors the `fulfilment_group` table in migration 002). */
export interface FulfilmentGroup extends AllocationGroup {
  id: string;
  customer_order_id: string;
  status: FulfilmentStatus;
  assignment_history: AssignmentEvent[];
  rejection_reason?: string | null;
  fulfilment_deadline?: string | Date | null;
  shipment_id?: string | null;
  created_at?: string | Date;
  updated_at?: string | Date;
}

/** productId -> partnerId. Accepts a plain object or an ES Map. */
export type ProductPartnerMap = Record<string, string> | Map<string, string>;

/** Extra columns a partner may set while transitioning a group. */
export interface FulfilmentExtra {
  rejection_reason?: string | null;
  shipment_id?: string | null;
}
