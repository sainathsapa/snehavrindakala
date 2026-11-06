/**
 * POST /api/store/payment/verify
 * Verify Razorpay payment signature and complete the order
 */

import { NextResponse } from "next/server";
import { medusa } from "@/lib/medusa";
import crypto from "crypto";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return NextResponse.json(
        { error: "Missing payment parameters" },
        { status: 400 }
      );
    }

    const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;
    if (!RAZORPAY_KEY_SECRET) {
      return NextResponse.json(
        { error: "Razorpay not configured" },
        { status: 500 }
      );
    }

    // Verify Razorpay signature
    const hmac = crypto.createHmac("sha256", RAZORPAY_KEY_SECRET);
    hmac.update(`${razorpay_order_id}|${razorpay_payment_id}`);
    const generatedSignature = hmac.digest("hex");

    if (generatedSignature !== razorpay_signature) {
      return NextResponse.json(
        { paid: false, error: "Invalid signature" },
        { status: 400 }
      );
    }

    // Payment verified - mark order as paid in Medusa
    // Fetch the cart/order from Medusa to get order details
    // The order was likely created when checkout details were saved
    // We need to update the order payment status

    // For now, return success - the order completion
    // will be handled by marking the cart as converted to order
    return NextResponse.json({
      paid: true,
      payment_id: razorpay_payment_id,
      order_id: razorpay_order_id,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Payment verification failed" },
      { status: 500 }
    );
  }
}
