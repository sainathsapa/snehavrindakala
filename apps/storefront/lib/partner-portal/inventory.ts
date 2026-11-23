/**
 * Partner-portal inventory — READ ONLY, tenant scoped.
 *
 * A partner may see stock only for variants that belong to products mapped to
 * `ctx.partnerId` in `partner_product`. There is no code path here that mutates
 * stock or reservations: the release/consume/restore lifecycle stays with the
 * checkout and cron jobs in `lib/inventory.ts`.
 *
 * Isolation rule: every statement goes through `tenantQuery`, so each SQL string
 * must contain the `{partner}` token. The partner id is appended as a bound
 * parameter from the verified server-side context — a caller cannot supply one,
 * and changing an id in the URL cannot cross tenants.
 *
 * `variant_id` is a Medusa product-variant id. `partner_product.product_id` is a
 * Medusa product id, so the two are linked through Medusa's `product_variant`
 * table (same Postgres database) before reaching the storefront stock tables.
 */

import {
  tenantQuery,
  type QueryExecutor,
} from "@/lib/partner/repository";
import type { PartnerContext } from "@/lib/partner/types";

/** Inventory "exception" threshold. A policy constant, never invented stock. */
export const LOW_STOCK_THRESHOLD = 5;

export interface PartnerInventoryRow {
  product_id: string;
  variant_id: string;
  product_title: string | null;
  variant_title: string | null;
  on_hand: number;
  reserved: number;
  sold: number;
  available: number;
  active_reservations: number;
}

export type StockExceptionKind =
  | "out_of_stock"
  | "low_stock"
  | "expired_reservation";

export interface StockExceptionRow {
  kind: StockExceptionKind;
  product_id: string;
  variant_id: string;
  product_title: string | null;
  variant_title: string | null;
  on_hand: number | null;
  reserved: number | null;
  sold: number | null;
  available: number | null;
  reservation_id: string | null;
  reservation_status: string | null;
  reservation_quantity: number | null;
  expires_at: string | Date | null;
}

/** Canonical availability rule, mirrored from `lib/inventory.ts` (pure). */
function availableOf(onHand: number, reserved: number, sold: number): number {
  return Math.max(0, onHand - reserved - sold);
}

/**
 * All tracked variants owned by the partner, with live reservation counts.
 * Untracked variants have no `variant_stock` row and are deliberately absent —
 * we never invent an on-hand quantity for them.
 */
export function listPartnerInventory(
  ctx: PartnerContext,
  ex?: QueryExecutor
): Promise<PartnerInventoryRow[]> {
  return tenantQuery<PartnerInventoryRow>(
    ctx,
    `SELECT
       pp.product_id,
       pv.id AS variant_id,
       prod.title AS product_title,
       pv.title AS variant_title,
       vs.on_hand,
       vs.reserved,
       vs.sold,
       GREATEST(0, vs.on_hand - vs.reserved - vs.sold) AS available,
       COUNT(sr.id) FILTER (
         WHERE sr.status = 'active' AND sr.expires_at > now()
       )::int AS active_reservations
     FROM partner_product pp
     JOIN product_variant pv
       ON pv.product_id = pp.product_id AND pv.deleted_at IS NULL
     JOIN variant_stock vs
       ON vs.variant_id = pv.id
     LEFT JOIN product prod
       ON prod.id = pp.product_id AND prod.deleted_at IS NULL
     LEFT JOIN stock_reservation sr
       ON sr.variant_id = vs.variant_id
     WHERE pp.partner_id = {partner}
     GROUP BY pp.product_id, pv.id, prod.title, pv.title,
              vs.on_hand, vs.reserved, vs.sold
     ORDER BY prod.title NULLS LAST, pv.title NULLS LAST,
              pp.product_id, pv.id
     LIMIT 500`,
    [],
    ex
  );
}

/**
 * Low/zero stock and stale holds for the partner's own products only.
 * Both statements carry the mandatory `{partner}` predicate. Nothing is
 * released here — expired holds are surfaced so the partner can see them; the
 * cron sweep owns the actual release.
 */
export async function getStockExceptions(
  ctx: PartnerContext,
  ex?: QueryExecutor
): Promise<StockExceptionRow[]> {
  const stockRows = await tenantQuery<StockExceptionRow>(
    ctx,
    `SELECT
       CASE WHEN GREATEST(0, vs.on_hand - vs.reserved - vs.sold) = 0
            THEN 'out_of_stock' ELSE 'low_stock' END AS kind,
       pp.product_id,
       pv.id AS variant_id,
       prod.title AS product_title,
       pv.title AS variant_title,
       vs.on_hand,
       vs.reserved,
       vs.sold,
       GREATEST(0, vs.on_hand - vs.reserved - vs.sold) AS available,
       NULL::text AS reservation_id,
       NULL::text AS reservation_status,
       NULL::int AS reservation_quantity,
       NULL::timestamptz AS expires_at
     FROM partner_product pp
     JOIN product_variant pv
       ON pv.product_id = pp.product_id AND pv.deleted_at IS NULL
     JOIN variant_stock vs
       ON vs.variant_id = pv.id
     LEFT JOIN product prod
       ON prod.id = pp.product_id AND prod.deleted_at IS NULL
     WHERE pp.partner_id = {partner}
       AND GREATEST(0, vs.on_hand - vs.reserved - vs.sold) <= $1
     ORDER BY available ASC, pp.product_id, pv.id
     LIMIT 200`,
    [LOW_STOCK_THRESHOLD],
    ex
  );

  const reservationRows = await tenantQuery<StockExceptionRow>(
    ctx,
    `SELECT
       'expired_reservation'::text AS kind,
       pp.product_id,
       pv.id AS variant_id,
       prod.title AS product_title,
       pv.title AS variant_title,
       vs.on_hand,
       vs.reserved,
       vs.sold,
       GREATEST(0, vs.on_hand - vs.reserved - vs.sold) AS available,
       sr.id AS reservation_id,
       sr.status AS reservation_status,
       sr.quantity AS reservation_quantity,
       sr.expires_at
     FROM partner_product pp
     JOIN product_variant pv
       ON pv.product_id = pp.product_id AND pv.deleted_at IS NULL
     JOIN variant_stock vs
       ON vs.variant_id = pv.id
     JOIN stock_reservation sr
       ON sr.variant_id = vs.variant_id
     LEFT JOIN product prod
       ON prod.id = pp.product_id AND prod.deleted_at IS NULL
     WHERE pp.partner_id = {partner}
       AND (sr.status = 'expired'
            OR (sr.status = 'active' AND sr.expires_at <= now()))
     ORDER BY sr.expires_at DESC
     LIMIT 200`,
    [],
    ex
  );

  return [...stockRows, ...reservationRows];
}

export interface InventorySummary {
  products: number;
  variants: number;
  onHand: number;
  reserved: number;
  sold: number;
  available: number;
  outOfStock: number;
  lowStock: number;
  activeReservations: number;
  exceptions: number;
}

/**
 * Pure aggregation over inventory rows. Availability is recomputed from the
 * raw counts rather than trusting a precomputed column, and nothing is mutated.
 */
export function summariseInventory(
  rows: readonly PartnerInventoryRow[],
  lowStockThreshold = LOW_STOCK_THRESHOLD
): InventorySummary {
  const products = new Set<string>();
  let onHand = 0;
  let reserved = 0;
  let sold = 0;
  let available = 0;
  let outOfStock = 0;
  let lowStock = 0;
  let activeReservations = 0;

  for (const row of rows) {
    products.add(row.product_id);
    const hand = Number(row.on_hand) || 0;
    const held = Number(row.reserved) || 0;
    const unitsSold = Number(row.sold) || 0;
    const avail = availableOf(hand, held, unitsSold);

    onHand += hand;
    reserved += held;
    sold += unitsSold;
    available += avail;
    activeReservations += Number(row.active_reservations) || 0;

    if (avail === 0) outOfStock += 1;
    else if (avail <= lowStockThreshold) lowStock += 1;
  }

  return {
    products: products.size,
    variants: rows.length,
    onHand,
    reserved,
    sold,
    available,
    outOfStock,
    lowStock,
    activeReservations,
    exceptions: outOfStock + lowStock,
  };
}
