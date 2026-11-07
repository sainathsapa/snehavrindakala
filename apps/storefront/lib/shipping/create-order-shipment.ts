/**
 * Create a Shiprocket shipment for a Medusa order and persist the result.
 * Shared by the checkout completion route and the admin "Create shipment"
 * action so both paths behave identically.
 */

import { getOrderShipment, saveOrderShipment } from "./store";
import { createShipment, SHIPROCKET_PICKUP_LOCATION } from "./shiprocket";

function paiseToRupees(amount: unknown): number {
  const value = Number(amount);
  if (!Number.isFinite(value)) return 0;
  return Math.round(value / 100);
}

export async function createShipmentForOrder(order: any) {
  const existing = await getOrderShipment(order.id);
  if (existing) {
    return existing;
  }

  const address = order.shipping_address || order.billing_address || {};
  interface ShipmentItem {
    name: string;
    sku: string;
    units: number;
    selling_price: number;
    discount: number;
    tax: number;
    hsn: string;
  }
  const items: ShipmentItem[] = (order.items || []).map((item: any) => ({
    name: item.product_title || item.title || "Product",
    sku: item.variant_sku || item.sku || item.variant_id || "",
    units: Number(item.quantity) || 1,
    selling_price: Math.max(paiseToRupees(item.unit_price), 1),
    discount: 0,
    tax: 0,
    hsn: "",
  }));

  const totalItems = items.reduce(
    (sum: number, item: ShipmentItem) => sum + item.units,
    0
  );
  const weight = Math.max(totalItems * 0.5, 0.5);
  const totalValue =
    paiseToRupees(order.total) ||
    items.reduce(
      (sum: number, item: ShipmentItem) =>
        sum + item.selling_price * item.units,
      0
    );

  const customerName =
    `${address.first_name || ""} ${address.last_name || ""}`.trim() ||
    "Customer";
  const fullAddress = [address.address_1, address.address_2]
    .filter(Boolean)
    .join(", ");

  const shipment = await createShipment({
    order_id: order.id,
    pickup_location: SHIPROCKET_PICKUP_LOCATION,
    comment: "SnehaVrinda Kala storefront order",
    billing_customer_name: customerName,
    billing_last_name: address.last_name || "",
    billing_address: fullAddress || address.address_1 || "Address on file",
    billing_city: address.city || "",
    billing_state: address.province || "",
    billing_pincode: address.postal_code || "",
    billing_country: address.country_code || "IN",
    billing_email: order.email || address.email || "",
    billing_phone: address.phone || "",
    shipping_is_billing: true,
    order_items: items,
    payment_method: "prepaid",
    shipping_charges: 0,
    transaction_charges: 0,
    total_items: totalItems,
    total_value: totalValue,
    weight,
    length: 10,
    breadth: 10,
    height: 5,
  });

  return saveOrderShipment(order.id, {
    shiprocket_order_id: shipment.order_id,
    shipment_id: shipment.shipment_id,
    awb_code: shipment.awb_code,
    courier_name: shipment.courier_name,
    courier_service: shipment.courier_service,
    tracking_url: shipment.tracking_url,
    label_url: shipment.label_url,
    pickup_location: shipment.pickup_location,
    status: shipment.awb_code ? "awb_assigned" : "created",
    raw: shipment,
  });
}
