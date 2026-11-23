/**
 * Single-use guard for Razorpay payments.
 *
 * A verified payment id must never be able to create two orders. We claim the
 * id atomically before converting the cart; a second request for the same id
 * gets no row from ON CONFLICT DO NOTHING and is refused. If order creation
 * fails, the claim is released so a legitimate retry can proceed.
 *
 * This does not replace server-side signature/capture/amount checks — it closes
 * the replay hole those checks cannot see on their own.
 */

import { query } from "./db";

export async function claimPayment(input: {
  paymentId: string;
  cartId: string;
  razorpayOrderId: string;
}): Promise<boolean> {
  const rows = await query<{ payment_id: string }>(
    `INSERT INTO processed_payments (payment_id, cart_id, razorpay_order_id)
     VALUES ($1, $2, $3)
     ON CONFLICT (payment_id) DO NOTHING
     RETURNING payment_id`,
    [input.paymentId, input.cartId, input.razorpayOrderId]
  );
  return rows.length > 0;
}

export async function releasePaymentClaim(paymentId: string): Promise<void> {
  await query("DELETE FROM processed_payments WHERE payment_id = $1", [paymentId]);
}

export async function paymentAlreadyProcessed(paymentId: string): Promise<boolean> {
  const rows = await query<{ payment_id: string }>(
    "SELECT payment_id FROM processed_payments WHERE payment_id = $1 LIMIT 1",
    [paymentId]
  );
  return rows.length > 0;
}
