/**
 * Builds the `PayabilityResolver` the settlements route passes into the finance
 * policy (A05). Without a real resolver, `payable_when` stayed a documented
 * vocabulary that no settlement ever consulted — the rule was configured but
 * not enforced end to end.
 *
 * Every fact is sourced from existing data. What cannot be proven is left
 * `false`/`null`, and `explainPayability()` then fails closed: an order with an
 * unknown delivery date cannot clear `return_window_elapsed`, and an
 * unconfigured `RETURN_WINDOW_DAYS` settles nothing. No date, window, status or
 * partner identity is invented here.
 */

import { query as defaultQuery } from "@/lib/db";
import {
  configuredReturnWindowDays,
  DELIVERED_STATUSES,
} from "@/lib/returns/process";
import type {
  CommissionPolicy,
  EarningsEntry,
  PayabilityResolver,
  QueryExecutor,
} from "./types";
import {
  payabilityContextForEntry,
  type PayabilityFacts,
} from "./settlement";

/** Payment statuses that prove money was captured for the order. */
const PAID_STATUSES = new Set(["paid", "captured"]);
const CANCELLED_STATUSES = new Set(["canceled", "cancelled"]);
/** Refund rows past these states mean money is on its way back to the buyer. */
const REFUND_ISSUED_STATUSES = new Set([
  "approved", "executed", "completed", "processed", "issued", "paid", "succeeded",
]);
/** Return requests that are still open or awaiting resolution. */
const OPEN_RETURN_STATUSES = new Set(["pending", "needs_evidence", "approved"]);

function norm(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export interface BuildResolverDeps {
  query?: QueryExecutor;
  /** Override only in tests; production uses the owner-configured env value. */
  returnWindowDays?: number | null;
}

/**
 * Batch-load facts for every order referenced by `entries` and return a
 * resolver over those facts. Batching keeps this to a fixed number of queries
 * regardless of batch size, and a query failure propagates (fail closed) rather
 * than silently treating unproven state as payable.
 */
export async function buildPayabilityResolver(
  entries: EarningsEntry[],
  policies: CommissionPolicy[],
  deps: BuildResolverDeps = {}
): Promise<PayabilityResolver> {
  const run = deps.query ?? defaultQuery;
  const orderIds = Array.from(
    new Set(entries.map((e) => e?.order_id).filter((id): id is string => !!id))
  );
  const factsByOrder = new Map<string, PayabilityFacts>();

  if (orderIds.length > 0) {
    const [orders, returns, refunds, shipments] = await Promise.all([
      run(
        `SELECT id, status, payment_status, fulfillment_status
           FROM "order" WHERE id = ANY($1::text[]) AND deleted_at IS NULL`,
        [orderIds]
      ) as Promise<Record<string, any>[]>,
      run(
        `SELECT order_id, status FROM return_requests WHERE order_id = ANY($1::text[])`,
        [orderIds]
      ) as Promise<Record<string, any>[]>,
      run(
        `SELECT order_id, status FROM order_refunds WHERE order_id = ANY($1::text[])`,
        [orderIds]
      ) as Promise<Record<string, any>[]>,
      run(
        `SELECT order_id, status, updated_at FROM order_shipments
          WHERE order_id = ANY($1::text[])`,
        [orderIds]
      ) as Promise<Record<string, any>[]>,
    ]);

    const deliveredAt = new Map<string, Date>();
    for (const s of shipments) {
      if (!DELIVERED_STATUSES.has(norm(s.status)) || !s.updated_at) continue;
      const at = new Date(s.updated_at);
      if (Number.isNaN(at.getTime())) continue;
      const prev = deliveredAt.get(s.order_id);
      if (!prev || at > prev) deliveredAt.set(s.order_id, at);
    }
    const returnOrderIds = new Set(
      returns.filter((r) => OPEN_RETURN_STATUSES.has(norm(r.status))).map((r) => r.order_id)
    );
    const refundOrderIds = new Set(
      refunds
        .filter((r) => REFUND_ISSUED_STATUSES.has(norm(r.status)))
        .map((r) => r.order_id)
    );

    const windowDays =
      deps.returnWindowDays === undefined
        ? configuredReturnWindowDays()
        : deps.returnWindowDays;

    for (const o of orders) {
      const delivered = deliveredAt.get(o.id);
      const days = delivered
        ? Math.floor(
            (Date.now() - delivered.getTime()) / (24 * 60 * 60 * 1000)
          )
        : null;
      factsByOrder.set(o.id, {
        orderPaid: PAID_STATUSES.has(norm(o.payment_status)),
        orderDelivered: DELIVERED_STATUSES.has(norm(o.fulfillment_status)) || !!delivered,
        orderCancelled: CANCELLED_STATUSES.has(norm(o.status)),
        refundIssued: refundOrderIds.has(o.id),
        pendingReturn: returnOrderIds.has(o.id),
        daysSinceDelivery: days != null && days >= 0 ? days : null,
        returnWindowDays: windowDays,
        settlementHeld: false,
      });
    }
  }

  const policiesById = new Map<string, CommissionPolicy>();
  for (const p of policies ?? []) if (p?.id) policiesById.set(p.id, p);

  return (entry: EarningsEntry) => {
    const policy = policiesById.get(entry.commission_policy_id ?? "");
    // No policy match => no declared rule => fail closed with an explicit reason.
    if (!policy) {
      return {
        payable_when: "UNKNOWN",
        orderPaid: false,
        orderDelivered: false,
        orderCancelled: false,
        refundIssued: false,
        pendingReturn: false,
        settlementHeld: true,
        daysSinceDelivery: null,
        returnWindowDays: null,
      };
    }
    const facts = factsByOrder.get(entry.order_id);
    // No order row (missing/deleted/unknown) => unproven => not payable.
    if (!facts) {
      return payabilityContextForEntry(entry, policy, {
        orderPaid: false,
        settlementHeld: false,
      });
    }
    return payabilityContextForEntry(entry, policy, facts);
  };
}
