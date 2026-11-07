/**
 * POST /api/store/checkout/complete
 * Mark cart as complete / convert to order after successful payment.
 */

import { NextResponse } from "next/server";
import { medusa } from "@/lib/medusa";

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

    const order = await medusa.completeOrder(cart_id);

    return NextResponse.json({
      ok: true,
      order_id: order.id,
      display_id: order.display_id,
      status: order.status,
      payment_status: order.payment_status,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to complete order" },
      { status: 500 }
    );
  }
}
