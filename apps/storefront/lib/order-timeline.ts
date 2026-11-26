/**
 * A buyer's order, as a story rather than a status line.
 *
 * The confirmation page and the tracking page both used to answer "where is it?"
 * with a status word and a tracking number in a definition list. That is a
 * database row, not an experience: it cannot say that the piece was packed on
 * Tuesday, that the courier collected it Wednesday, or that it has been sitting
 * in a Jaipur hub since Friday.
 *
 * The steps come from two sources and are deliberately labelled as such:
 *
 *  - **studio** — what we did, from our own rows: payment confirmed, packed,
 *    handed to the courier, certificate issued, refund decided.
 *  - **courier** — what Shiprocket reports: real scans with their own timestamps
 *    and locations.
 *
 * They are interleaved on one line because that is how a parcel's life actually
 * runs, but each step keeps its origin so nobody has to guess who is speaking.
 */

import type { LiveTracking } from "@/lib/shipping/live-tracking";

export type JourneyState = "done" | "current" | "upcoming";

export interface JourneyStep {
  at: string | null;
  title: string;
  detail?: string | null;
  state: JourneyState;
  source: "studio" | "courier";
}

export interface BuyerOrderInput {
  createdAt?: string | null;
  paymentStatus?: string | null;
  status?: string | null;
  shipment?: {
    status?: string | null;
    trackingNumber?: string | null;
    courier?: string | null;
    createdAt?: string | null;
  } | null;
  live?: LiveTracking | null;
  hasCertificate?: boolean;
}

const PAID = /paid|captured|authorized|completed|settled/i;
const SHIPPED = /shipped|awb|dispatched|handed|picked|in_transit|intransit/i;
const DELIVERED = /delivered/i;

/** Human wording for our own status codes, which are not sentences. */
const STATUS_WORDS: Record<string, string> = {
  created: "Packed and booked",
  awb_assigned: "Handed to the courier",
  picked_up: "Collected by the courier",
  in_transit: "On its way",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  rto: "Returning to the studio",
  cancelled: "Cancelled",
  manual: "Shipped",
};

const words = (status?: string | null) => {
  const clean = String(status ?? "").trim().toLowerCase();
  if (!clean) return "";
  return STATUS_WORDS[clean] ?? clean.replace(/[_-]+/g, " ");
};

/**
 * Build the timeline. Order of the fixed steps is deliberate: the studio's own
 * milestones first, then the courier's scans, and the latest known state marked
 * `current` so the eye lands on "where are we now".
 */
export function buildBuyerTimeline(input: BuyerOrderInput): JourneyStep[] {
  const steps: JourneyStep[] = [];

  if (input.createdAt) {
    steps.push({
      at: input.createdAt,
      title: "Order placed",
      detail: "We have your order and the studio is preparing it.",
      state: "done",
      source: "studio",
    });
  }

  if (input.paymentStatus && PAID.test(input.paymentStatus)) {
    steps.push({
      at: input.createdAt ?? null,
      title: "Payment confirmed",
      state: "done",
      source: "studio",
    });
  }

  const shipment = input.shipment;
  const shipmentStatus = shipment?.status ?? null;

  if (shipment && /created|packed/i.test(String(shipmentStatus ?? ""))) {
    steps.push({
      at: shipment.createdAt ?? null,
      title: words(shipmentStatus) || "Packed and booked",
      state: "done",
      source: "studio",
    });
  }

  if (shipment?.trackingNumber && !/created|packed/i.test(String(shipmentStatus ?? ""))) {
    steps.push({
      at: shipment.createdAt ?? null,
      title: words(shipmentStatus) || "Handed to the courier",
      detail: shipment.courier ? `${shipment.courier} · ${shipment.trackingNumber}` : shipment.trackingNumber,
      state: "done",
      source: "studio",
    });
  }

  if (input.hasCertificate) {
    steps.push({
      at: null,
      title: "Certificate of authenticity issued",
      detail: "One per work, with a code that resolves on this site.",
      state: "done",
      source: "studio",
    });
  }

  // The courier's own scans, oldest first. These are dated strings from
  // Shiprocket, often "2026-11-27 14:32:00"; they are shown as given rather than
  // reformatted into a guess.
  const scans = (input.live?.scans ?? []).slice().reverse();
  for (const scan of scans) {
    steps.push({
      at: scan.at,
      title: scan.activity,
      detail: scan.location,
      state: "done",
      source: "courier",
    });
  }

  if (input.live?.edd && !DELIVERED.test(String(input.live.status ?? ""))) {
    steps.push({
      at: null,
      title: "Expected to arrive",
      detail: input.live.edd,
      state: "upcoming",
      source: "courier",
    });
  }

  if (SHIPPED.test(String(shipmentStatus ?? "")) && scans.length === 0) {
    steps.push({
      at: null,
      title: "Waiting for the courier's first scan",
      detail: "The parcel is booked. Scans appear here as they happen.",
      state: "current",
      source: "courier",
    });
  }

  // Mark the last completed step as the current one when nothing is upcoming:
  // a timeline with no "you are here" is just a list.
  const lastDone = [...steps].reverse().find((step) => step.state === "done");
  if (lastDone && !steps.some((step) => step.state === "current")) {
    lastDone.state = "current";
  }

  return steps;
}
