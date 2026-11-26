/**
 * One order's whole life, and the person behind it.
 *
 * The admin could already see an order, a shipment, a refund and a ticket — in
 * four places, none of which knew about the others. A support person answering
 * "where is my order?" had to open the order, then the shipments table, then
 * guess whether a refund had been decided. The facts were all recorded; nobody
 * could read them as a sequence.
 *
 * Everything here is assembled from rows that already exist. Nothing is inferred:
 * if an email was not logged, the timeline does not claim one was sent.
 */

import { query } from "./db";

export type JourneyKind =
  | "order"
  | "payment"
  | "shipment"
  | "refund"
  | "certificate"
  | "ticket"
  | "account";

export interface JourneyEvent {
  at: string;
  kind: JourneyKind;
  title: string;
  detail?: string;
  /** A short machine-ish reference: payment id, AWB, code. */
  ref?: string | null;
  /** Worth the reader's attention: a failure, a revocation, an open dispute. */
  flag?: "good" | "warn" | "bad" | null;
}

const money = (minor: number | string | null | undefined) => {
  const value = Number(minor ?? 0);
  if (!Number.isFinite(value) || value === 0) return "₹0";
  return `₹${(value / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
};

const stamps = [
  "order.created",
  "order.placed",
  "payment.captured",
  "payment.failed",
  "refund.processed",
  "shipment.delivered",
];

/** Every recorded event for an order, oldest first. */
export async function orderJourney(input: {
  orderId: string;
  createdAt?: string | null;
  displayId?: number | string | null;
  total?: number | null;
  currency?: string | null;
  email?: string | null;
  status?: string | null;
}): Promise<JourneyEvent[]> {
  const { orderId } = input;
  const events: JourneyEvent[] = [];

  if (input.createdAt) {
    events.push({
      at: input.createdAt,
      kind: "order",
      title: `Order #${input.displayId ?? orderId} placed`,
      detail: [input.status ? `Status ${input.status}` : null, input.total != null ? money(input.total) : null]
        .filter(Boolean)
        .join(" · "),
      ref: orderId,
      flag: null,
    });
  }

  const [payments, shipments, refunds, certs, tickets] = await Promise.all([
    query<any>(
      `SELECT event_type, amount, currency, payment_id, status, last_error, received_at
         FROM payment_event
        WHERE order_id = $1
        ORDER BY received_at`,
      [orderId]
    ).catch(() => []),
    query<any>(
      `SELECT status, awb_code, courier_name, tracking_url, created_at, updated_at
         FROM order_shipments
        WHERE order_id = $1`,
      [orderId]
    ).catch(() => []),
    query<any>(
      `SELECT amount, reason, status, requested_by, approved_by, created_at, decided_at
         FROM order_refunds
        WHERE order_id = $1
        ORDER BY created_at`,
      [orderId]
    ).catch(() => []),
    query<any>(
      `SELECT code, title, issued_at, revoked_at FROM certificates WHERE order_id = $1`,
      [orderId]
    ).catch(() => []),
    query<any>(
      `SELECT id, subject, status, created_at FROM support_tickets WHERE email = $1 ORDER BY created_at`,
      [input.email ?? ""]
    ).catch(() => []),
  ]);

  for (const event of payments) {
    const failed = event.event_type === "payment.failed" || event.status === "failed";
    events.push({
      at: event.received_at,
      kind: "payment",
      title: event.event_type,
      detail: [money(event.amount), event.currency?.toUpperCase()].filter(Boolean).join(" ") +
        (event.last_error ? ` · ${event.last_error}` : ""),
      ref: event.payment_id,
      flag: failed ? "bad" : event.event_type === "payment.captured" ? "good" : null,
    });
  }

  for (const shipment of shipments) {
    events.push({
      at: shipment.created_at,
      kind: "shipment",
      title: `Shipment created${shipment.courier_name ? ` · ${shipment.courier_name}` : ""}`,
      detail: shipment.awb_code ? `AWB ${shipment.awb_code}` : "No AWB yet",
      ref: shipment.tracking_url,
      flag: null,
    });
    if (shipment.status && shipment.updated_at && shipment.updated_at !== shipment.created_at) {
      events.push({
        at: shipment.updated_at,
        kind: "shipment",
        title: `Shipment ${shipment.status}`,
        ref: shipment.awb_code,
        flag: /deliver|rto|undeliver|cancel/i.test(shipment.status) ? "warn" : null,
      });
    }
  }

  for (const refund of refunds) {
    events.push({
      at: refund.decided_at ?? refund.created_at,
      kind: "refund",
      title: `Refund ${refund.status}`,
      detail: [money(refund.amount), refund.reason].filter(Boolean).join(" · "),
      ref: [refund.requested_by, refund.approved_by].filter(Boolean).join(" → ") || null,
      flag: refund.status === "rejected" ? "bad" : refund.status === "completed" ? "good" : "warn",
    });
  }

  for (const cert of certs) {
    events.push({
      at: cert.issued_at,
      kind: "certificate",
      title: cert.revoked_at ? `Certificate revoked · ${cert.title}` : `Certificate issued · ${cert.title}`,
      ref: cert.code,
      flag: cert.revoked_at ? "bad" : "good",
    });
  }

  for (const ticket of tickets) {
    events.push({
      at: ticket.created_at,
      kind: "ticket",
      title: `Support: ${ticket.subject}`,
      detail: `Status ${ticket.status}`,
      ref: ticket.id,
      flag: ticket.status === "open" ? "warn" : null,
    });
  }

  return events.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
}

export interface CustomerProfile {
  email: string;
  orders: number;
  lifetimeValueMinor: number;
  firstOrderAt: string | null;
  lastOrderAt: string | null;
  failedPayments: number;
  refundedMinor: number;
  openTickets: number;
  tickets: number;
  addresses: number;
  wishlist: number;
  certificates: number;
}

/**
 * What the shop knows about a buyer, in one screen.
 *
 * Keyed on email because that is what ties a guest order, a refund and a ticket
 * together — Medusa leaves `customer_id` null on a guest order, and pretending
 * otherwise would show a support person a partial life story.
 */
export async function customerProfile(email: string): Promise<CustomerProfile> {
  const clean = String(email || "").trim().toLowerCase();
  const empty: CustomerProfile = {
    email: clean,
    orders: 0,
    lifetimeValueMinor: 0,
    firstOrderAt: null,
    lastOrderAt: null,
    failedPayments: 0,
    refundedMinor: 0,
    openTickets: 0,
    tickets: 0,
    addresses: 0,
    wishlist: 0,
    certificates: 0,
  };
  if (!clean) return empty;

  const [orders, payments, refunds, tickets, wishlist] = await Promise.all([
    // Medusa v2 keeps money in `order_summary.totals`, not on `order`. Reading
    // `total` off the order table raised, the catch swallowed it, and the profile
    // showed a buyer with one order as having none and a lifetime value of ₹0 —
    // which is worse than showing nothing, because it looks authoritative.
    query<any>(
      `SELECT count(DISTINCT o.id)::int AS n,
              coalesce(sum((s.totals->>'current_order_total')::bigint), 0)::bigint AS v,
              min(o.created_at) AS first,
              max(o.created_at) AS last
         FROM "order" o
         LEFT JOIN order_summary s ON s.order_id = o.id
        WHERE lower(o.email) = $1`,
      [clean]
    ).catch(() => []),
    query<any>(
      `SELECT count(*)::int AS failed
         FROM payment_event pe
         JOIN "order" o ON o.id = pe.order_id
        WHERE lower(o.email) = $1 AND (pe.event_type = 'payment.failed' OR pe.status = 'failed')`,
      [clean]
    ).catch(() => []),
    query<any>(
      `SELECT coalesce(sum(r.amount),0)::bigint AS refunded
         FROM order_refunds r
         JOIN "order" o ON o.id = r.order_id
        WHERE lower(o.email) = $1`,
      [clean]
    ).catch(() => []),
    query<any>(
      `SELECT count(*)::int AS n,
              count(*) FILTER (WHERE status IN ('open','pending'))::int AS open
         FROM support_tickets WHERE lower(email) = $1`,
      [clean]
    ).catch(() => []),
    query<any>(
      `SELECT count(*)::int AS n FROM customer_wishlist WHERE lower(email) = $1`,
      [clean]
    ).catch(() => []),
  ]);

  return {
    ...empty,
    orders: orders[0]?.n ?? 0,
    lifetimeValueMinor: Number(orders[0]?.v ?? 0),
    firstOrderAt: orders[0]?.first ?? null,
    lastOrderAt: orders[0]?.last ?? null,
    failedPayments: payments[0]?.failed ?? 0,
    refundedMinor: Number(refunds[0]?.refunded ?? 0),
    tickets: tickets[0]?.n ?? 0,
    openTickets: tickets[0]?.open ?? 0,
    wishlist: wishlist[0]?.n ?? 0,
  };
}

export const JOURNEY_STAMPS = stamps;
