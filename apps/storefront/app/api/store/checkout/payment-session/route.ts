/**
 * POST /api/store/checkout/payment-session
 *
 * Prepares a checkout for payment:
 *  1. Initialises a Medusa payment collection/session so the cart can be
 *     converted into an order after payment.
 *  2. Quotes the cheapest Shiprocket rate for the delivery PIN.
 *  3. Creates a Razorpay order for cart total + shipping.
 */

import { NextResponse } from "next/server";
import { medusa } from "@/lib/medusa";
import { getShippingRates } from "@/lib/shipping/shiprocket";

const PICKUP_POSTCODE = process.env.SHIPROCKET_PICKUP_POSTCODE || "560001";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { cart_id } = body;

    if (!cart_id) {
      return NextResponse.json({ error: "Cart ID required" }, { status: 400 });
    }

    const cart = await medusa.getCart(cart_id);
    if (!cart || cart.items.length === 0) {
      return NextResponse.json({ error: "Cart is empty" }, { status: 400 });
    }

    // Medusa needs a payment session before the cart can be completed.
    await medusa.ensurePaymentSession(cart_id);

    // Quote shipping for the delivery PIN. Failure here should not block
    // checkout — fall back to free shipping and let the admin reconcile.
    let shippingAmount = 0;
    let shippingQuote: {
      courier_name: string;
      service_name: string;
      expected_delivery: string;
    } | null = null;
    const deliveryPostcode =
      cart.shipping_address?.postal_code || cart.billing_address?.postal_code;
    if (deliveryPostcode) {
      const weight = (cart.items || []).reduce(
        (sum: number, item: any) => sum + (item.quantity || 1) * 0.5,
        0
      );
      try {
        const rates = await getShippingRates({
          pickup_postcode: PICKUP_POSTCODE,
          delivery_postcode: deliveryPostcode,
          weight: weight || 0.5,
          cod: false,
        });
        if (rates.length > 0) {
          shippingAmount = rates[0].rate;
          shippingQuote = {
            courier_name: rates[0].courier_name,
            service_name: rates[0].service_name,
            expected_delivery: rates[0].expected_delivery,
          };
        }
      } catch (err) {
        console.error("Failed to quote shipping", err);
      }
    }

    const RAZORPAY_KEY_ID =
      process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID;
    const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;

    if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
      return NextResponse.json(
        { error: "Razorpay not configured" },
        { status: 500 }
      );
    }

    const amount = (cart.total || 0) + shippingAmount; // minor units (paise)
    const currency = (cart.currency_code || "inr").toUpperCase();

    const res = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization:
          "Basic " +
          Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString(
            "base64"
          ),
      },
      body: JSON.stringify({
        amount,
        currency,
        receipt: `cart_${cart.id}`,
        notes: {
          cart_id,
          shipping_amount: String(shippingAmount),
          shipping_courier: shippingQuote?.courier_name || "",
        },
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error("Razorpay order creation failed:", errorText);
      return NextResponse.json(
        { error: "Failed to create Razorpay order" },
        { status: 500 }
      );
    }

    const orderData = await res.json();

    return NextResponse.json({
      razorpay_order_id: orderData.id,
      amount: orderData.amount,
      currency: orderData.currency,
      status: orderData.status,
      shipping_amount: shippingAmount,
      shipping: shippingQuote,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to create payment session" },
      { status: 500 }
    );
  }
}
