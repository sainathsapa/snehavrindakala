/**
 * POST /api/store/checkout/payment-session
 * Create a Razorpay order for cart checkout
 */

import { NextResponse } from "next/server";
import { medusa } from "@/lib/medusa";

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

    const RAZORPAY_KEY_ID =
      process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ||
      process.env.RAZORPAY_KEY_ID;
    const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;

    if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
      return NextResponse.json(
        { error: "Razorpay not configured" },
        { status: 500 }
      );
    }

    const amount = cart.total || 0; // in minor units (paise)
    const currency = (cart.currency_code || "inr").toUpperCase();

    // Create Razorpay order
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
        receipt: `order_${cart.id}`,
        notes: { cart_id },
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
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
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to create payment session" },
      { status: 500 }
    );
  }
}
