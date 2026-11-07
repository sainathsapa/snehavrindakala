/**
 * POST /api/store/shipping/shipment - Create a Shiprocket shipment after order placement
 */

import { NextResponse } from "next/server";
import { createShipment } from "@/lib/shipping/shiprocket";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      order_id,
      order_date,
      pickup_location,
      channel_id,
      comment,
      billing_customer_name,
      billing_last_name,
      billing_address,
      billing_address_2,
      billing_city,
      billing_state,
      billing_pincode,
      billing_country,
      billing_email,
      billing_phone,
      shipping_is_billing,
      shipping_customer_name,
      shipping_last_name,
      shipping_address,
      shipping_address_2,
      shipping_city,
      shipping_state,
      shipping_pincode,
      shipping_country,
      shipping_email,
      shipping_phone,
      order_items,
      payment_method,
      shipping_charges,
      transaction_charges,
      total_items,
      total_value,
      weight,
      length,
      breadth,
      height,
    } = body;

    if (!order_id || !billing_address || !billing_city || !billing_pincode || !order_items) {
      return NextResponse.json(
        { error: "Missing required shipment fields" },
        { status: 400 }
      );
    }

    const shipment = await createShipment({
      order_id,
      order_date,
      pickup_location: pickup_location || "SnehaVrinda Kala",
      channel_id,
      comment,
      billing_customer_name,
      billing_last_name,
      billing_address,
      billing_address_2,
      billing_city,
      billing_state,
      billing_pincode,
      billing_country: billing_country || "IN",
      billing_email,
      billing_phone,
      shipping_is_billing: shipping_is_billing ?? true,
      shipping_customer_name,
      shipping_last_name,
      shipping_address,
      shipping_address_2,
      shipping_city,
      shipping_state,
      shipping_pincode,
      shipping_country: shipping_country || "IN",
      shipping_email,
      shipping_phone,
      order_items,
      payment_method: payment_method || "cod",
      shipping_charges: shipping_charges || 0,
      transaction_charges: transaction_charges || 0,
      total_items: total_items || order_items.length,
      total_value: total_value || 0,
      weight: weight || 1,
      length,
      breadth,
      height,
    });

    return NextResponse.json({ ok: true, shipment });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to create shipment" },
      { status: 500 }
    );
  }
}
