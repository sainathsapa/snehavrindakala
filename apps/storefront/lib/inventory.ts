/**
 * Atomic stock reservations for SnehaVrinda Kala.
 *
 * The old `sold-works` guard was a read: two buyers paying in the same instant
 * could both pass it and both receive a certificate for one one-of-one work.
 * This module closes that with a row lock in a real Postgres transaction.
 *
 * IMPORTANT — no stock quantities are invented. A variant is "tracked" only
 * once the owner has explicitly initialised `variant_stock` through the admin
 * workflow. Untracked variants keep the previous behaviour (the sold-works
 * guard), so existing products and customer data are untouched.
 *
 * Lifecycle:
 *   reserveStock()        add-to-cart / payment-session  → active (expires)
 *   consumeReservation()  checkout completion            → consumed, sold++
 *   releaseReservation()  payment failure / cart abandon → released
 *   restoreSoldForOrder() cancellation / eligible refund → released, sold--
 *   releaseExpired()      cron / admin                   → expired
 */

import { query, transaction } from "./db";
import type { PoolClient } from "pg";

export const RESERVATION_TTL_SECONDS = 15 * 60; // 15 minutes, matching a checkout window

export interface StockRow {
  variant_id: string;
  on_hand: number;
  reserved: number;
  sold: number;
}

export interface ReservationResult {
  ok: boolean;
  tracked: boolean;
  reason?: "insufficient" | "not_tracked" | "no_reservation";
  reservationId?: string;
}

/** Pure availability rule — exported so the concurrency guarantee is testable. */
export function availableStock(stock: StockRow): number {
  return Math.max(0, stock.on_hand - stock.reserved - stock.sold);
}

/** Pure decision: may `quantity` units be reserved from this locked row? */
export function canReserve(
  stock: StockRow,
  quantity: number,
  alreadyReservedForSameBuyer = 0
): boolean {
  if (!Number.isInteger(quantity) || quantity <= 0) return false;
  // Re-reserving the same buyer's units is idempotent, not additional demand.
  return availableStock(stock) + alreadyReservedForSameBuyer >= quantity;
}

async function findStock(
  client: PoolClient,
  variantId: string,
  forUpdate: boolean
): Promise<StockRow | null> {
  const res = await client.query<StockRow>(
    `SELECT variant_id, on_hand, reserved, sold FROM variant_stock
      WHERE variant_id = $1 ${forUpdate ? "FOR UPDATE" : ""}`,
    [variantId]
  );
  return res.rows[0] ?? null;
}

/** Claim `quantity` units atomically. One winner when on_hand = 1. */
export async function reserveStock(input: {
  variantId: string;
  cartId: string;
  quantity?: number;
  ttlSeconds?: number;
}): Promise<ReservationResult> {
  const quantity = input.quantity ?? 1;
  if (!Number.isInteger(quantity) || quantity <= 0) {
    return { ok: false, tracked: false, reason: "insufficient" };
  }

  return transaction(async (client) => {
    const stock = await findStock(client, input.variantId, true);
    if (!stock) return { ok: true, tracked: false }; // untracked → legacy behaviour

    const existing = await client.query<{ id: string; quantity: number }>(
      `SELECT id, quantity FROM stock_reservation
        WHERE variant_id = $1 AND cart_id = $2 AND status = 'active' AND expires_at > now()
        LIMIT 1`,
      [input.variantId, input.cartId]
    );
    const prior = existing.rows[0];
    if (prior) {
      // Idempotent: refresh the TTL and keep the original claim.
      await client.query(
        `UPDATE stock_reservation SET expires_at = now() + ($3 * interval '1 second')
          WHERE id = $1`,
        [prior.id, input.cartId, input.ttlSeconds ?? RESERVATION_TTL_SECONDS]
      );
      return { ok: true, tracked: true, reservationId: prior.id };
    }

    if (!canReserve(stock, quantity)) {
      return { ok: false, tracked: true, reason: "insufficient" };
    }

    await client.query(
      "UPDATE variant_stock SET reserved = reserved + $2, updated_at = now() WHERE variant_id = $1",
      [input.variantId, quantity]
    );
    const inserted = await client.query<{ id: string }>(
      `INSERT INTO stock_reservation (variant_id, cart_id, quantity, status, expires_at)
       VALUES ($1, $2, $3, 'active', now() + ($4 * interval '1 second'))
       RETURNING id`,
      [input.variantId, input.cartId, quantity, input.ttlSeconds ?? RESERVATION_TTL_SECONDS]
    );
    return { ok: true, tracked: true, reservationId: inserted.rows[0].id };
  });
}

/**
 * Turn a reservation into a sale. If no active reservation exists (e.g. a cart
 * created before reservations were introduced), reserve-and-consume happens in
 * the SAME locked transaction — this is the point that closes the double-sale
 * race even for legacy carts.
 */
export async function consumeReservation(input: {
  variantId: string;
  cartId: string;
  orderId: string;
  quantity?: number;
}): Promise<ReservationResult> {
  const quantity = input.quantity ?? 1;
  return transaction(async (client) => {
    const stock = await findStock(client, input.variantId, true);
    if (!stock) return { ok: true, tracked: false };

    const found = await client.query<{ id: string; quantity: number }>(
      `SELECT id, quantity FROM stock_reservation
        WHERE variant_id = $1 AND cart_id = $2 AND status = 'active'
        ORDER BY expires_at DESC LIMIT 1 FOR UPDATE`,
      [input.variantId, input.cartId]
    );
    let reservation = found.rows[0];

    if (!reservation) {
      if (!canReserve(stock, quantity)) {
        return { ok: false, tracked: true, reason: "no_reservation" };
      }
      await client.query(
        "UPDATE variant_stock SET reserved = reserved + $2, updated_at = now() WHERE variant_id = $1",
        [input.variantId, quantity]
      );
      const inserted = await client.query<{ id: string }>(
        `INSERT INTO stock_reservation (variant_id, cart_id, quantity, status, order_id, expires_at)
         VALUES ($1, $2, $3, 'active', $4, now() + ($5 * interval '1 second'))
         RETURNING id`,
        [input.variantId, input.cartId, quantity, input.orderId, RESERVATION_TTL_SECONDS]
      );
      reservation = { id: inserted.rows[0].id, quantity };
    }

    await client.query(
      `UPDATE stock_reservation
         SET status = 'consumed', order_id = $2, updated_at = now()
       WHERE id = $1 AND status = 'active'`,
      [reservation.id, input.orderId]
    );
    await client.query(
      `UPDATE variant_stock
         SET reserved = reserved - $2, sold = sold + $2, updated_at = now()
       WHERE variant_id = $1`,
      [input.variantId, reservation.quantity]
    );
    return { ok: true, tracked: true, reservationId: reservation.id };
  });
}

/** After the order exists, bind the consumed holds to its real id for refund/cancel restore. */
export async function linkReservationsToOrder(
  reservationIds: string[],
  orderId: string
): Promise<void> {
  if (!reservationIds.length) return;
  await query(
    "UPDATE stock_reservation SET order_id = $1, updated_at = now() WHERE id = ANY($2::text[])",
    [orderId, reservationIds]
  );
}

/** Release one active reservation (payment failed / cart abandoned). */
export async function releaseReservation(id: string): Promise<void> {
  await transaction(async (client) => {
    const row = await client.query<{ variant_id: string; quantity: number; status: string }>(
      "SELECT variant_id, quantity, status FROM stock_reservation WHERE id = $1 FOR UPDATE",
      [id]
    );
    const r = row.rows[0];
    if (!r || r.status !== "active") return;
    await client.query(
      "UPDATE stock_reservation SET status = 'released', updated_at = now() WHERE id = $1",
      [id]
    );
    await client.query(
      "UPDATE variant_stock SET reserved = GREATEST(0, reserved - $2), updated_at = now() WHERE variant_id = $1",
      [r.variant_id, r.quantity]
    );
  });
}

/** Restore a consumed sale when an order is cancelled or an eligible refund completes. */
export async function restoreSoldForOrder(orderId: string): Promise<number> {
  return transaction(async (client) => {
    const rows = await client.query<{ id: string; variant_id: string; quantity: number }>(
      "SELECT id, variant_id, quantity FROM stock_reservation WHERE order_id = $1 AND status = 'consumed' FOR UPDATE",
      [orderId]
    );
    for (const r of rows.rows) {
      await client.query(
        "UPDATE stock_reservation SET status = 'released', updated_at = now() WHERE id = $1",
        [r.id]
      );
      await client.query(
        "UPDATE variant_stock SET sold = GREATEST(0, sold - $2), updated_at = now() WHERE variant_id = $1",
        [r.variant_id, r.quantity]
      );
    }
    return rows.rows.length;
  });
}

/** Sweep stale holds. Safe to run repeatedly (cron or admin). */
export async function releaseExpiredReservations(): Promise<number> {
  const res = await query<{ id: string; variant_id: string; quantity: number }>(
    `UPDATE stock_reservation SET status = 'expired', updated_at = now()
      WHERE status = 'active' AND expires_at <= now()
      RETURNING id, variant_id, quantity`
  );
  for (const r of res) {
    await query(
      "UPDATE variant_stock SET reserved = GREATEST(0, reserved - $2), updated_at = now() WHERE variant_id = $1",
      [r.variant_id, r.quantity]
    );
  }
  return res.length;
}

/** Owner initialisation — the ONLY way a variant becomes tracked. Never called automatically. */
export async function initialiseStock(
  variantId: string,
  onHand: number
): Promise<StockRow> {
  if (!Number.isInteger(onHand) || onHand < 0) {
    throw new Error("on_hand must be a non-negative integer");
  }
  const rows = await query<StockRow>(
    `INSERT INTO variant_stock (variant_id, on_hand, reserved, sold)
     VALUES ($1, $2, 0, 0)
     ON CONFLICT (variant_id) DO UPDATE SET on_hand = EXCLUDED.on_hand, updated_at = now()
     RETURNING variant_id, on_hand, reserved, sold`,
    [variantId, onHand]
  );
  return rows[0];
}

/** All tracked variants with their derived availability, for the admin view. */
export async function queryInventory(): Promise<
  Array<StockRow & { available: number }>
> {
  const rows = await query<StockRow>(
    "SELECT variant_id, on_hand, reserved, sold FROM variant_stock ORDER BY variant_id"
  );
  return rows.map((row) => ({ ...row, available: availableStock(row) }));
}

export async function getStock(variantId: string): Promise<StockRow | null> {
  const rows = await query<StockRow>(
    "SELECT variant_id, on_hand, reserved, sold FROM variant_stock WHERE variant_id = $1",
    [variantId]
  );
  return rows[0] ?? null;
}
