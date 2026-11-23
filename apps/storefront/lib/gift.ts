/**
 * Gift notes.
 *
 * Art is bought for other people more often than the checkout allowed for: the
 * order arrived in a box with an invoice and nothing else. A note is a few lines
 * of the buyer's own words and, optionally, gift wrapping.
 *
 * The note travels with the cart rather than with the payment, so it is written
 * before the money moves and cannot be lost if the browser closes on the
 * confirmation page. At completion it is copied into its own table keyed by the
 * order, where the order page and the packing bench can both read it.
 */

import { query, queryResult } from "@/lib/db";

/**
 * A gift note is read by a person, so newlines are kept and only the edges are
 * trimmed. 300 characters is about what fits on a card — longer is a letter, and
 * a letter would need a different promise about when it is written.
 */
export function cleanGiftNote(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.replace(/\r\n/g, "\n").trim().slice(0, 300);
}

export function parseGiftWrap(value: unknown): boolean {
  return value === true || value === "on" || value === "true" || value === "1";
}

export interface GiftNote {
  order_id: string;
  note: string;
  wrap: boolean;
}

export async function saveGiftForOrder(
  orderId: string,
  note: unknown,
  wrap: unknown
): Promise<void> {
  if (!orderId) return;
  const cleaned = cleanGiftNote(note);
  const wrapped = parseGiftWrap(wrap);
  // Nothing asked for, nothing stored: an empty row would make every ordinary
  // order look like it had a gift option that was declined.
  if (!cleaned && !wrapped) return;
  await query(
    `INSERT INTO order_gift_notes (order_id, note, wrap)
     VALUES ($1,$2,$3)
     ON CONFLICT (order_id) DO UPDATE SET note=EXCLUDED.note, wrap=EXCLUDED.wrap`,
    [orderId, cleaned, wrapped]
  );
}

export async function getGiftForOrder(orderId: string): Promise<GiftNote | null> {
  if (!orderId) return null;
  const result = await queryResult<GiftNote>(
    `SELECT order_id, note, wrap FROM order_gift_notes WHERE order_id=$1`,
    [orderId]
  );
  return result.rows[0] ?? null;
}
