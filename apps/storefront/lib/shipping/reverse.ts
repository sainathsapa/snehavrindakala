/**
 * The parcel coming back.
 *
 * Returns were a request queue: a buyer asked, an admin approved, and then
 * somebody arranged the pickup by hand and typed the AWB into an email. The
 * queue knew about the request and nothing about the parcel.
 *
 * This books the reverse leg with Shiprocket and records it, so the same journey
 * a buyer sees on the way out works on the way back — and so the studio has a
 * pickup date rather than a promise.
 *
 * Important: this is deliberately best-effort. A return a studio has already
 * approved must not fail because a courier API is unhappy; the caller stores the
 * request either way and the admin panel shows what is outstanding.
 */

import { shiprocketRequest } from "./shiprocket";

export interface ReversePickupRequest {
  /** Our order id; becomes the reference Shiprocket echoes back. */
  orderId: string;
  displayId?: string | number | null;
  pickupLocation?: string | null;
  customer: {
    name: string;
    email: string;
    phone: string;
  };
  address: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    pincode: string;
    country?: string;
  };
  item: {
    name: string;
    sku?: string;
    units?: number;
    weightKg?: number;
  };
  reason?: string | null;
}

export interface ReversePickupResult {
  ok: boolean;
  awb?: string | null;
  shiprocketOrderId?: string | null;
  /** Why it did not book, in words an admin can act on. */
  error?: string;
}

const SETTINGS_HINT =
  "Shiprocket could not book the reverse pickup. Check that the API user is active and that the pickup location exists, then book the pickup from the Shiprocket panel — the return request is saved either way.";

export async function bookReversePickup(
  request: ReversePickupRequest
): Promise<ReversePickupResult> {
  const reference = `${request.orderId}-R`.slice(0, 60);

  const payload = {
    order_id: reference,
    order_date: new Date().toISOString().slice(0, 10),
    pickup_location: request.pickupLocation || process.env.SHIPROCKET_PICKUP_LOCATION || "Primary",
    // A return travels the other way: the customer's address is the pickup and
    // the studio is the destination, which Shiprocket infers for a return order.
    channel_id: "",
    comment: request.reason ? String(request.reason).slice(0, 120) : "Return",
    billing_customer_name: request.customer.name.split(" ")[0] || "Customer",
    billing_last_name: request.customer.name.split(" ").slice(1).join(" ") || "",
    billing_address: request.address.line1,
    billing_address_2: request.address.line2 || "",
    billing_city: request.address.city,
    billing_pincode: request.address.pincode,
    billing_state: request.address.state,
    billing_country: request.address.country || "India",
    billing_email: request.customer.email,
    billing_phone: request.customer.phone,
    shipping_is_billing: true,
    order_items: [
      {
        name: request.item.name.slice(0, 100),
        sku: (request.item.sku || "RETURN").slice(0, 40),
        units: request.item.units ?? 1,
        selling_price: 0,
        weight: request.item.weightKg ?? 0.5,
      },
    ],
    payment_method: "prepaid",
    sub_total: 0,
    length: 10,
    breadth: 10,
    height: 5,
    weight: request.item.weightKg ?? 0.5,
  };

  try {
    const created: any = await shiprocketRequest("/orders/create/return", payload);
    const awb = created?.awb_code ?? created?.response?.data?.awb_code ?? null;
    const orderId = created?.order_id ?? created?.response?.data?.order_id ?? null;
    return { ok: true, awb, shiprocketOrderId: orderId == null ? null : String(orderId) };
  } catch (error) {
    const message = String((error as Error)?.message ?? "").slice(0, 200);
    console.warn("[returns] reverse pickup not booked:", message);
    return { ok: false, error: `${SETTINGS_HINT}${message ? ` (${message})` : ""}` };
  }
}
