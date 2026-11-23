/**
 * Pure presentation helpers for the partner order screens.
 *
 * Kept out of the partner orders Page modules because Next.js forbids
 * arbitrary named exports from a Page module (`next build` fails with
 * "<name> is not a valid Page export field").
 */
import type { FulfilmentStatus } from "@/lib/fulfilment/types";

/** Display order of the status buckets (the order of the fulfilment machine). */
export const STATUS_ORDER: FulfilmentStatus[] = [
  "assigned",
  "accepted",
  "packing",
  "ready_for_dispatch",
  "dispatched",
  "delivered",
  "rejected",
  "cancelled",
];

/** Human-friendly, stable labels shown in the UI. */
export const STATUS_LABELS: Record<FulfilmentStatus, string> = {
  assigned: "Awaiting acceptance",
  accepted: "Accepted",
  packing: "Packing",
  ready_for_dispatch: "Ready for dispatch",
  dispatched: "Dispatched",
  delivered: "Delivered",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

export function statusLabel(status: FulfilmentStatus): string {
  return STATUS_LABELS[status] ?? String(status).replace(/_/g, " ");
}

/** Forward progress path; rejected/cancelled are terminal branches, not steps. */
const TIMELINE: FulfilmentStatus[] = [
  "assigned",
  "accepted",
  "packing",
  "ready_for_dispatch",
  "dispatched",
  "delivered",
];

/** Timeline entries up to and including the group's current status. */
export function fulfilmentTimeline(status: FulfilmentStatus): FulfilmentStatus[] {
  if (status === "rejected" || status === "cancelled") return ["assigned", status];
  const index = TIMELINE.indexOf(status);
  return index === -1 ? [] : TIMELINE.slice(0, index + 1);
}
