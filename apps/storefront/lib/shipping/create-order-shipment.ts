/**
 * Create a Shiprocket shipment for a Medusa order and persist the result.
 * Shared by the checkout completion route and the admin "Create shipment"
 * action so both paths behave identically.
 */

import { getOrderShipment, saveOrderShipment } from "./store";
import { createShipment, SHIPROCKET_PICKUP_LOCATION } from "./shiprocket";
import {
  loadProductPhysicalData,
  MissingPhysicalDataError,
  resolvePackagePhysicalData,
} from "./product-physical";

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

  // PHYSICAL DATA IS MEASURED, NEVER GUESSED.
  //
  // This function used to send `weight = totalItems * 0.5` and a fixed
  // `10 x 10 x 5 cm` box to Shiprocket. Both were inventions: the weight decides
  // the courier rate the shop pays, and the dimensions are what a damage or
  // lost-parcel claim is judged against. lib/shipping/verify.ts already refused
  // to build a request without real data; this was the path that bypassed it.
  //
  // Now every line must resolve a verified measurement or the shipment is
  // refused with the product ids that are missing. The caller decides whether to
  // surface that to the customer (checkout) or the admin (manual shipment).
  const lines = (order.items || []).map((item: any) => ({
    productId:
      (typeof item.product_id === "string" && item.product_id) ||
      (typeof item.product?.id === "string" && item.product.id) ||
      null,
    quantity: Number(item.quantity) || 1,
  }));

  const physicalRows = await loadProductPhysicalData(
    lines
      .map((l: { productId: string | null }) => l.productId)
      .filter((id: string | null): id is string => Boolean(id))
  );
  const physical = resolvePackagePhysicalData(lines, physicalRows);
  if (!physical.ok) {
    throw new MissingPhysicalDataError(physical.missingProductIds);
  }

  const weight = physical.weightKg;
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
    length: physical.dimensionsCm.length,
    breadth: physical.dimensionsCm.breadth,
    height: physical.dimensionsCm.height,
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
