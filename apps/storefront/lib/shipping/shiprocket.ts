/**
 * Shiprocket shipping client.
 *
 * Authenticates with Shiprocket using email/password and exposes:
 *  - getAuthToken() — obtain and cache a bearer token
 *  - getShippingRates({ pickup_postcode, delivery_postcode, weight, cod }) — available couriers + rates
 *  - createShipment({ order_id, order_date, pickup_location, channel_id, comment, billing_customer_name, billing_last_name, billing_address, billing_address_2, billing_city, billing_state, billing_pincode, billing_country, billing_email, billing_phone, shipping_is_billing, shipping_customer_name, shipping_last_name, shipping_address, shipping_address_2, shipping_city, shipping_state, shipping_pincode, shipping_country, shipping_email, shipping_phone, order_items, payment_method, shipping_charges, transaction_charges, total_items, total_value, weight, length, breadth, height }) — create a shipment
 */

const SHIPROCKET_BASE_URL = "https://apishiprocket.in/v1/external";

let tokenCache: { token: string; expiresAt: number } | null = null;

const SHIPROCKET_EMAIL = process.env.SHIPROCKET_EMAIL || "info.djsai@gmail.com";
const SHIPROCKET_PASSWORD =
  process.env.SHIPROCKET_PASSWORD ||
  "HyEf2Kna1Zg@Uusn^ErGOv#Q5Y&LlVw#";

async function getAuthToken(): Promise<string> {
  const now = Date.now();
  if (tokenCache && now < tokenCache.expiresAt) {
    return tokenCache.token;
  }

  const res = await fetch(`${SHIPROCKET_BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: SHIPROCKET_EMAIL, password: SHIPROCKET_PASSWORD }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Shiprocket auth failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  const token = data.token || data.data?.token;
  if (!token) {
    throw new Error("Shiprocket auth returned no token");
  }

  // Token typically valid for ~30 days; refresh with a 1-day safety margin.
  tokenCache = { token, expiresAt: now + 60 * 60 * 24 * 29 * 1000 };
  return token;
}

async function shiprocketRequest(path: string, body: any, method = "POST") {
  const token = await getAuthToken();
  const res = await fetch(`${SHIPROCKET_BASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  let data: any = null;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }

  if (!res.ok) {
    throw new Error(
      `Shiprocket API error (${res.status}): ${data.message || data.error || text}`
    );
  }

  return data;
}

export interface ShippingRateRequest {
  pickup_postcode: string;
  delivery_postcode: string;
  weight: number; // kg
  cod?: boolean;
}

export interface ShippingRateOption {
  courier_name: string;
  courier_id: number;
  service_name: string;
  service_id: number;
  rate: number;
  expected_delivery: string;
  cod_charges?: number;
}

export async function getShippingRates(
  req: ShippingRateRequest
): Promise<ShippingRateOption[]> {
  const data = await shiprocketRequest("/external/courier/serviceability", {
    pickup_postcode: req.pickup_postcode,
    delivery_postcode: req.delivery_postcode,
    weight: req.weight,
    cod: req.cod ?? true,
  });

  const available = data.data?.available_courier_companies ?? data.available_courier_companies ?? [];
  return available
    .filter((c: any) => c.serviceable === true || c.serviceable === "true")
    .flatMap((c: any) =>
      (c.services ?? []).map((s: any) => ({
        courier_name: c.company_name || c.courier_name,
        courier_id: c.company_id || c.courier_id,
        service_name: s.name || s.service_name,
        service_id: s.id || s.service_id,
        rate: s.rate ?? s.rate_amount ?? 0,
        expected_delivery: s.etd ?? s.expected_delivery ?? "N/A",
        cod_charges: s.cod_charges,
      }))
    )
    .sort((a: ShippingRateOption, b: ShippingRateOption) => a.rate - b.rate);
}

export interface CreateShipmentRequest {
  order_id: string;
  order_date: string;
  pickup_location: string;
  channel_id?: string;
  comment?: string;
  billing_customer_name: string;
  billing_last_name: string;
  billing_address: string;
  billing_address_2?: string;
  billing_city: string;
  billing_state: string;
  billing_pincode: string;
  billing_country: string;
  billing_email: string;
  billing_phone: string;
  shipping_is_billing?: boolean;
  shipping_customer_name?: string;
  shipping_last_name?: string;
  shipping_address?: string;
  shipping_address_2?: string;
  shipping_city?: string;
  shipping_state?: string;
  shipping_pincode?: string;
  shipping_country?: string;
  shipping_email?: string;
  shipping_phone?: string;
  order_items: Array<{
    name: string;
    sku: string;
    units: number;
    selling_price: number;
    discount: number;
    tax: number;
    hsn: string;
  }>;
  payment_method: string;
  shipping_charges: number;
  transaction_charges: number;
  total_items: number;
  total_value: number;
  weight: number;
  length?: number;
  breadth?: number;
  height?: number;
}

export interface CreateShipmentResponse {
  shipment_id: number;
  order_id: string;
  order_status: string;
  awb_code: string | null;
  courier_name: string;
  courier_service: string;
  pickup_location: string;
  tracking_url: string | null;
  label_url: string | null;
}

export async function createShipment(
  req: CreateShipmentRequest
): Promise<CreateShipmentResponse> {
  const data = await shiprocketRequest("/external/courier/create/shipment", req);

  const result = data.data ?? data;
  return {
    shipment_id: result.shipment_id ?? result.id,
    order_id: result.order_id,
    order_status: result.order_status,
    awb_code: result.awb_code ?? null,
    courier_name: result.courier_name,
    courier_service: result.courier_service,
    pickup_location: result.pickup_location,
    tracking_url: result.tracking_url ?? null,
    label_url: result.label_url ?? null,
  };
}

export async function trackShipment(awbCode: string) {
  return shiprocketRequest(
    `/external/courier/track?awb_code=${encodeURIComponent(awbCode)}`,
    {},
    "GET"
  );
}

export { SHIPROCKET_BASE_URL };
