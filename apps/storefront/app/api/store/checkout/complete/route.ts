/**
 * POST /api/store/checkout/complete
 * Mark cart as complete / convert to order after successful payment.
 * Also creates a Shiprocket shipment for the order.
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

    // Create a Shiprocket shipment for the completed order
    try {
      const cart = await medusa.getCart(cart_id);
      const shippingAddress = cart.shipping_address || {};
      const billingAddress = cart.billing_address || {};

      // Calculate total weight (0.5kg per item)
      const totalWeight = (cart.items || []).reduce(
        (sum: number, item: any) => sum + (item.quantity || 0) * 0.5,
        0
      );

      const orderItems = (cart.items || []).map((item: any) => ({
        name: item.product_title || item.title || "Product",
        sku: item.sku || "",
        units: item.quantity || 1,
        selling_price: item.unit_price || 0,
        discount: 0,
        tax: 0,
        hsn: "",
      }));

      await fetch(
        `${process.env.NEXT_PUBLIC_STOREFRONT_URL || "http://localhost:3000"}/api/store/shipping/shipment`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            order_id: order.id,
            order_date: new Date().toISOString(),
            pickup_location: "SnehaVrinda Kala",
            channel_id: "",
            comment: "Order placed via SnehaVrinda Kala storefront",
            billing_customer_name:
              `${shippingAddress.first_name || ""} ${shippingAddress.last_name || ""}`.trim() ||
              "Customer",
            billing_last_name: shippingAddress.last_name || "",
            billing_address: shippingAddress.address_1 || "",
            billing_address_2: shippingAddress.address_2 || "",
            billing_city: shippingAddress.city || "",
            billing_state: shippingAddress.province || "",
            billing_pincode: shippingAddress.postal_code || "",
            billing_country: shippingAddress.country_code || "IN",
            billing_email: shippingAddress.email || "",
            billing_phone: shippingAddress.phone || "",
            shipping_is_billing: true,
            shipping_customer_name:
              `${shippingAddress.first_name || ""} ${shippingAddress.last_name || ""}`.trim() ||
              "Customer",
            shipping_last_name: shippingAddress.last_name || "",
            shipping_address: shippingAddress.address_1 || "",
            shipping_address_2: shippingAddress.address_2 || "",
            shipping_city: shippingAddress.city || "",
            shipping_state: shippingAddress.province || "",
            shipping_pincode: shippingAddress.postal_code || "",
            shipping_country: shippingAddress.country_code || "IN",
            shipping_email: shippingAddress.email || "",
            shipping_phone: shippingAddress.phone || "",
            order_items: orderItems,
            payment_method: "cod",
            shipping_charges: 0,
            transaction_charges: 0,
            total_items: (cart.items || []).length,
            total_value: cart.total || 0,
            weight: totalWeight,
            length: 10,
            breadth: 10,
            height: 5,
          }),
        }
      );
    } catch (shipErr) {
      console.error("Shipment creation failed:", shipErr);
      // Don't fail the order completion if shipment creation fails
    }

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
