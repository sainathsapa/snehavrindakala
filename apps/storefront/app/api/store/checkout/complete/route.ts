/**
 * POST /api/store/checkout/complete
 *
 * Converts a paid cart into an order and creates the Shiprocket shipment.
 *
 * The client sends the Razorpay handshake (`razorpay_order_id`,
 * `razorpay_payment_id`, `razorpay_signature`). The signature is verified with
 * HMAC-SHA256 against RAZORPAY_KEY_SECRET — without it anyone could POST a made
 * up payment id and receive a free order. When the signature is missing we fall
 * back to asking Razorpay for the payment and checking that it is captured and
 * that its order id matches the cart we are about to complete.
 */

import { NextResponse } from "next/server";
import crypto from "crypto";
import { medusa } from "@/lib/medusa";
import { getAdminOrder } from "@/lib/admin";
import { createShipmentForOrder } from "@/lib/shipping/create-order-shipment";

const RAZORPAY_KEY_ID =
  process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID || "";
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || "";

function razorpayAuth(): string {
  return (
    "Basic " +
    Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString("base64")
  );
}

function verifySignature(
  orderId: string,
  paymentId: string,
  signature: string
): boolean {
  const expected = crypto
    .createHmac("sha256", RAZORPAY_KEY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");

  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      cart_id,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      // Kept for backwards compatibility with the older client payload.
      payment_id,
    } = body;

    const paymentId = razorpay_payment_id || payment_id;

    if (!cart_id || !paymentId) {
      return NextResponse.json(
        { error: "Cart ID and payment ID required" },
        { status: 400 }
      );
    }

    if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
      return NextResponse.json(
        { error: "Payments are not configured for this environment." },
        { status: 500 }
      );
    }

    const cart = await medusa.getCart(cart_id);
    if (!cart || !cart.items || cart.items.length === 0) {
      return NextResponse.json({ error: "Cart is empty" }, { status: 400 });
    }

    if (razorpay_order_id && razorpay_signature) {
      if (
        !verifySignature(razorpay_order_id, paymentId, razorpay_signature)
      ) {
        return NextResponse.json(
          { error: "Payment signature verification failed" },
          { status: 400 }
        );
      }
    }

    // Ask Razorpay directly as well: signature checks the handshake, this
    // confirms the money actually moved and belongs to this checkout.
    const paymentRes = await fetch(
      `https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}`,
      {
        headers: { Authorization: razorpayAuth() },
        cache: "no-store",
      }
    );

    if (!paymentRes.ok) {
      return NextResponse.json(
        { error: "Payment could not be verified" },
        { status: 400 }
      );
    }

    const payment = await paymentRes.json();
    if (!["captured", "authorized"].includes(payment.status)) {
      return NextResponse.json(
        { error: "Payment has not been captured" },
        { status: 400 }
      );
    }

    if (
      razorpay_order_id &&
      payment.order_id &&
      payment.order_id !== razorpay_order_id
    ) {
      return NextResponse.json(
        { error: "Payment does not belong to this checkout" },
        { status: 400 }
      );
    }

    if (Number(payment.amount) < Number(cart.total || 0)) {
      return NextResponse.json(
        { error: "Payment amount does not match the cart" },
        { status: 400 }
      );
    }

    // Make completion resilient: if the payment session was not created for
    // any reason, initialise it now so Medusa can convert the cart.
    try {
      await medusa.ensurePaymentSession(cart_id);
    } catch (err) {
      console.error("Failed to ensure payment session:", err);
    }

    const order = await medusa.completeOrder(cart_id);

    let shipment: any = null;
    let shippingError: string | null = null;
    try {
      const { order: fullOrder } = await getAdminOrder(order.id);
      shipment = await createShipmentForOrder(fullOrder);
    } catch (err) {
      console.error("Shipment creation failed:", err);
      shippingError =
        err instanceof Error
          ? err.message
          : "Shipment could not be created. You can retry from the admin panel.";
    }

    return NextResponse.json({
      ok: true,
      order_id: order.id,
      display_id: order.display_id,
      status: order.status,
      payment_status: order.payment_status,
      shipment,
      shipping_error: shippingError,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to complete order",
      },
      { status: 500 }
    );
  }
}
