/**
 * POST /api/store/payment/verify — check the Razorpay handshake.
 *
 * This route verifies one thing: that Razorpay signed
 * `razorpay_order_id|razorpay_payment_id` with our key secret. It deliberately
 * writes nothing — no order, no payment record, no status change. The order is
 * created by `/api/store/checkout/complete`, which repeats this check and then
 * also asks Razorpay directly for the payment's state.
 *
 * The response says `signature_valid`, not `paid`. The old field was `paid`, and
 * a true value there did not mean a payment had been recorded anywhere — only
 * that a string matched. Two endpoints both claiming to decide whether money
 * arrived is how a shop ends up trusting the wrong one.
 *
 * Comparison is constant-time for the same reason the completion route's is: a
 * byte-by-byte early exit leaks how much of a forged signature was right.
 */

import { NextResponse } from "next/server";
import crypto from "crypto";

export const dynamic = "force-dynamic";

function verifySignature(
  orderId: string,
  paymentId: string,
  signature: string,
  secret: string
): boolean {
  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Expected a JSON body" }, { status: 400 });
  }

  const razorpay_order_id = typeof body.razorpay_order_id === "string" ? body.razorpay_order_id : "";
  const razorpay_payment_id = typeof body.razorpay_payment_id === "string" ? body.razorpay_payment_id : "";
  const razorpay_signature = typeof body.razorpay_signature === "string" ? body.razorpay_signature : "";

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return NextResponse.json(
      { error: "Missing payment parameters" },
      { status: 400 }
    );
  }

  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) {
    // Checkout refuses before this point, so reaching here means the deployment
    // lost its keys mid-session. Say so plainly rather than blaming the buyer.
    return NextResponse.json(
      { error: "Payments are not configured on this shop." },
      { status: 503 }
    );
  }

  if (
    !verifySignature(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      secret
    )
  ) {
    return NextResponse.json(
      { signature_valid: false, error: "Invalid signature" },
      { status: 400 }
    );
  }

  return NextResponse.json({
    signature_valid: true,
    // Named so a reader (or a future client) cannot mistake this for completion.
    note: "Signature checked only. The order is created by /api/store/checkout/complete.",
    payment_id: razorpay_payment_id,
    order_id: razorpay_order_id,
  });
}
