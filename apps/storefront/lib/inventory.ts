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

import { randomUUID } from "node:crypto";
import { query, transaction } from "./db";
import type { PoolClient } from "pg";
import { isPhysicalRestockableItem, restockDecision, type RestockItemContext } from "./returns/process";

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

/* ── Refund/return-driven stock restoration (additive, idempotent) ────────── */

/**
 * Refund execution records live in migration 007. None of these helpers touches
 * money or order status. They only:
 *   - record an OBSERVABLE restoration action (pending/failed/restored), and
 *   - write an append-only inventory_movement with UNIQUE(movement_key) before
 *     changing stock, so a concurrent replay cannot restore twice.
 *
 * An executor (not a live pool) is taken everywhere so tests can use a fake DB.
 * `restoreSoldForRefund` is the transaction-wrapped production entry point.
 */

export type InventoryExecutor = (sql: string, params?: any[]) => Promise<any[]>;

export type RestorationActionStatus =
  | "not_required"
  | "eligible"
  | "pending"
  | "restored"
  | "failed"
  | "not_eligible";

export function restorationActionKey(
  executionId: string,
  discriminator: string
): string {
  return `inventory-restore:${executionId}:${discriminator}`;
}

export function restorationMovementKey(actionKey: string): string {
  return `${actionKey}:movement`;
}

export interface RestorationActionInput {
  actionKey: string;
  orderId: string;
  status: RestorationActionStatus;
  refundExecutionId?: string | null;
  refundRequestId?: string | null;
  returnRequestId?: string | null;
  orderItemId?: string | null;
  variantId?: string | null;
  reason?: string | null;
  trigger?: string | null;
  actor?: string | null;
  metadata?: Record<string, unknown>;
}

/** Claim (or read back) the observable action row for an idempotency key. */
export async function claimRestorationAction(
  input: RestorationActionInput,
  ex: InventoryExecutor
): Promise<{ row: any | null; claimed: boolean }> {
  const rows = await ex(
    `INSERT INTO inventory_restoration_action
       (id, action_key, refund_execution_id, refund_request_id, return_request_id,
        order_id, order_item_id, variant_id, status, eligibility_reason, trigger,
        actor, attempts, metadata, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,0,$13,now(),now())
     ON CONFLICT (action_key) DO NOTHING RETURNING *`,
    [
      randomUUID(),
      input.actionKey,
      input.refundExecutionId ?? null,
      input.refundRequestId ?? null,
      input.returnRequestId ?? null,
      input.orderId,
      input.orderItemId ?? null,
      input.variantId ?? null,
      input.status,
      input.reason ?? null,
      input.trigger ?? null,
      input.actor ?? null,
      JSON.stringify(input.metadata ?? {}),
    ]
  );
  if (rows?.[0]) return { row: rows[0], claimed: true };
  const existing = await ex(
    "SELECT * FROM inventory_restoration_action WHERE action_key = $1 LIMIT 1",
    [input.actionKey]
  );
  return { row: existing?.[0] ?? null, claimed: false };
}

/** Move an action to a terminal/intermediate state. Idempotent on action_key. */
export async function finalizeRestorationAction(
  args: {
    actionKey: string;
    status: RestorationActionStatus;
    reason?: string | null;
    actor?: string | null;
    lastError?: string | null;
    incrementAttempts?: boolean;
  },
  ex: InventoryExecutor
): Promise<any | null> {
  const rows = await ex(
    `UPDATE inventory_restoration_action
        SET status = $2,
            eligibility_reason = COALESCE($3, eligibility_reason),
            actor = COALESCE($4, actor),
            attempts = attempts + $5,
            last_error = $6,
            updated_at = now()
      WHERE action_key = $1 RETURNING *`,
    [
      args.actionKey,
      args.status,
      args.reason ?? null,
      args.actor ?? null,
      args.incrementAttempts ? 1 : 0,
      args.lastError ?? null,
    ]
  );
  return rows?.[0] ?? null;
}

/** Record a non-restoring decision (not eligible / pending owner decision). */
export async function recordNonRestoringAction(
  input: RestorationActionInput,
  ex: InventoryExecutor
): Promise<any | null> {
  const { row } = await claimRestorationAction(input, ex);
  if (row && row.status === input.status) return row; // already observed
  return finalizeRestorationAction(
    {
      actionKey: input.actionKey,
      status: input.status,
      reason: input.reason,
      actor: input.actor,
    },
    ex
  );
}

export interface RestoreSoldForRefundInput {
  orderId: string;
  actionKey: string;
  movementKey: string;
  actor: string;
  reason: string;
  refundExecutionId?: string | null;
  refundRequestId?: string | null;
  returnRequestId?: string | null;
  orderItemId?: string | null;
  variantId?: string | null;
  quantity?: number;
  trigger?: string | null;
  condition?: unknown;
  item?: RestockItemContext | null;
  metadata?: Record<string, unknown>;
}

export interface RestoreSoldForRefundResult {
  restored: boolean;
  alreadyRestored: boolean;
  restoredQuantity: number;
  actionStatus: RestorationActionStatus;
  reason: string;
}

/**
 * Verify the item is still restockable, then restore consumed stock. The
 * append-only movement is claimed (UNIQUE movement_key) before stock changes;
 * a concurrent caller that loses the claim never touches stock. Called only
 * with an executor inside a transaction in production.
 */
export async function restoreSoldForRefundWithExecutor(
  input: RestoreSoldForRefundInput,
  ex: InventoryExecutor
): Promise<RestoreSoldForRefundResult> {
  const fail = async (reason: string): Promise<RestoreSoldForRefundResult> => {
    await finalizeRestorationAction(
      {
        actionKey: input.actionKey,
        status: "failed",
        reason,
        actor: input.actor,
        lastError: reason,
        incrementAttempts: true,
      },
      ex
    );
    return {
      restored: false,
      alreadyRestored: false,
      restoredQuantity: 0,
      actionStatus: "failed",
      reason,
    };
  };

  // Re-verify the documented condition at execution time. A caller cannot skip
  // eligibility by passing `eligible` straight into this function.
  const preDispatch = input.trigger === "pre_dispatch_cancellation";
  if (
    !isPhysicalRestockableItem(input.item) ||
    (!preDispatch && restockDecision(input.item ?? null, input.condition) !== "restock")
  ) {
    return fail("Condition/item re-verification failed: item is not restockable.");
  }

  const claimedAction = await claimRestorationAction(
    {
      actionKey: input.actionKey,
      orderId: input.orderId,
      status: "eligible",
      reason: input.reason,
      trigger: input.trigger,
      actor: input.actor,
      refundExecutionId: input.refundExecutionId,
      refundRequestId: input.refundRequestId,
      returnRequestId: input.returnRequestId,
      orderItemId: input.orderItemId,
      variantId: input.variantId,
      metadata: input.metadata,
    },
    ex
  );
  if (claimedAction.row?.status === "restored") {
    return {
      restored: false,
      alreadyRestored: true,
      restoredQuantity: 0,
      actionStatus: "restored",
      reason: "Stock was already restored for this action key.",
    };
  }

  const consumedSql = input.variantId
    ? "SELECT id, variant_id, quantity FROM stock_reservation WHERE order_id = $1 AND status = 'consumed' AND variant_id = $2 FOR UPDATE"
    : "SELECT id, variant_id, quantity FROM stock_reservation WHERE order_id = $1 AND status = 'consumed' FOR UPDATE";
  const consumed = await ex(consumedSql, input.variantId ? [input.orderId, input.variantId] : [input.orderId]);
  if (!consumed || consumed.length === 0) {
    return fail("No consumed stock reservation found for this order; nothing to restore.");
  }

  let selected = consumed as Array<{ id: string; variant_id: string; quantity: number }>;
  if (
    typeof input.quantity === "number" &&
    Number.isInteger(input.quantity) &&
    input.quantity > 0
  ) {
    const capped: typeof selected = [];
    let total = 0;
    for (const r of selected) {
      if (total >= input.quantity) break;
      capped.push(r);
      total += r.quantity;
    }
    selected = capped;
  }
  const restoredQuantity = selected.reduce((sum, r) => sum + Number(r.quantity), 0);

  // Append-only movement claim: UNIQUE(movement_key) is the hard idempotency
  // boundary. Losing the claim means another process already restored.
  const movement = await ex(
    `INSERT INTO inventory_movement
       (id, movement_key, direction, order_id, order_item_id, variant_id, quantity,
        refund_execution_id, refund_request_id, return_request_id, actor, reason,
        restoration_action_key, metadata, created_at)
     VALUES ($1,$2,'restock',$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,now())
     ON CONFLICT (movement_key) DO NOTHING RETURNING *`,
    [
      randomUUID(),
      input.movementKey,
      input.orderId,
      input.orderItemId ?? null,
      input.variantId ?? null,
      restoredQuantity,
      input.refundExecutionId ?? null,
      input.refundRequestId ?? null,
      input.returnRequestId ?? null,
      input.actor,
      input.reason,
      input.actionKey,
      JSON.stringify(input.metadata ?? {}),
    ]
  );
  if (!movement?.[0]) {
    await finalizeRestorationAction(
      {
        actionKey: input.actionKey,
        status: "restored",
        reason: "Movement already recorded by a concurrent restoration.",
        actor: input.actor,
      },
      ex
    );
    return {
      restored: false,
      alreadyRestored: true,
      restoredQuantity: 0,
      actionStatus: "restored",
      reason: "Movement already recorded for this key.",
    };
  }

  for (const r of selected) {
    await ex(
      "UPDATE stock_reservation SET status = 'released', updated_at = now() WHERE id = $1 AND status = 'consumed'",
      [r.id]
    );
    await ex(
      "UPDATE variant_stock SET sold = GREATEST(0, sold - $2), updated_at = now() WHERE variant_id = $1",
      [r.variant_id, r.quantity]
    );
  }

  await finalizeRestorationAction(
    {
      actionKey: input.actionKey,
      status: "restored",
      reason: input.reason,
      actor: input.actor,
    },
    ex
  );
  return {
    restored: restoredQuantity > 0,
    alreadyRestored: false,
    restoredQuantity,
    actionStatus: "restored",
    reason: input.reason,
  };
}

/** Transaction-wrapped production entry point. */
export async function restoreSoldForRefund(
  input: RestoreSoldForRefundInput
): Promise<RestoreSoldForRefundResult> {
  return transaction(async (client) => {
    const ex: InventoryExecutor = async (sql, params = []) =>
      (await client.query(sql, params)).rows;
    return restoreSoldForRefundWithExecutor(input, ex);
  });
}
