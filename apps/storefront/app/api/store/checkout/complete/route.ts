/**
 * POST /api/store/checkout/complete
 * Mark cart as complete / convert to order after successful payment.
 * Also attempts to create a Shiprocket shipment for the order.
 */

import { NextResponse } from "next/server";
import { medusa } from "@/lib/medusa";
import { getAdminOrder } from "@/lib/admin";
import { createShipmentForOrder } from "@/lib/shipping/create-order-shipment";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { cart_id, payment_id } = body;

    if (!cart_id || !payment_id) {
      return NextResponse.json(
        { error: "Cart ID and payment ID required" },
        { status: 400 }
      );
    }

    // Verify the Razorpay payment server-side so a forged payment id cannot
    // complete an unpaid order.
    const RAZORPAY_KEY_ID =
      process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID;
    const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;
    if (RAZORPAY_KEY_ID && RAZORPAY_KEY_SECRET) {
      const paymentRes = await fetch(
        `https://api.razorpay.com/v1/payments/${encodeURIComponent(payment_id)}`,
        {
          headers: {
            Authorization:
              "Basic " +
              Buffer.from(
                `${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`
              ).toString("base64"),
          },
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

      const cart = await medusa.getCart(cart_id);
      if (!cart || payment.amount < cart.total) {
        return NextResponse.json(
          { error: "Payment amount does not match the cart" },
          { status: 400 }
        );
      }
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
    } catch (err: any) {
      console.error("Shipment creation failed:", err);
      shippingError =
        err?.message ||
        "Shipment could not be created. You can retry from the admin panel.";
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
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to complete order" },
      { status: 500 }
    );
  }
}
