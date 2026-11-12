/**
 * Shiprocket shipping client.
 *
 * Authenticates with Shiprocket using email/password and exposes:
 *  - getShippingRates()  — serviceability + courier rates for a PIN pair
 *  - createShipment()    — create an ad-hoc order, assign AWB, request pickup
 *  - trackShipment()     — tracking timeline for an AWB
 *
 * Docs: https://apidocs.shiprocket.in/
 */

const SHIPROCKET_BASE_URL = (
  process.env.SHIPROCKET_BASE_URL || "https://apiv2.shiprocket.in/v1/external"
).replace(/\/+$/, "");

/** Shiprocket pickup-location nickname configured in the dashboard. */
export const SHIPROCKET_PICKUP_LOCATION =
  process.env.SHIPROCKET_PICKUP_LOCATION || "Primary";

let tokenCache: { token: string; expiresAt: number } | null = null;

// Credentials are read from the environment only. A hard-coded fallback here
// would ship a live account password inside the build artifact.
const SHIPROCKET_EMAIL = process.env.SHIPROCKET_EMAIL || "";
const SHIPROCKET_PASSWORD = process.env.SHIPROCKET_PASSWORD || "";

async function getAuthToken(): Promise<string> {
  if (!SHIPROCKET_EMAIL || !SHIPROCKET_PASSWORD) {
    throw new Error(
      "Shiprocket is not configured. Set SHIPROCKET_EMAIL and SHIPROCKET_PASSWORD."
    );
  }

  const now = Date.now();
  if (tokenCache && now < tokenCache.expiresAt) {
    return tokenCache.token;
  }

  const res = await fetch(`${SHIPROCKET_BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: SHIPROCKET_EMAIL,
      password: SHIPROCKET_PASSWORD,
    }),
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

  // Token is valid ~30 days; refresh with a 1-day safety margin.
  tokenCache = { token, expiresAt: now + 60 * 60 * 24 * 29 * 1000 };
  return token;
}

async function shiprocketRequest(
  path: string,
  body?: any,
  method: "GET" | "POST" = "POST"
) {
  const token = await getAuthToken();
  const init: RequestInit = {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  };
  if (method !== "GET") {
    init.body = JSON.stringify(body ?? {});
  }

  const res = await fetch(`${SHIPROCKET_BASE_URL}${path}`, init);

  const text = await res.text();
  let data: any = null;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }

  if (!res.ok) {
    throw new Error(
      `Shiprocket API error (${res.status}): ${
        data?.message || data?.error || text
      }`
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
  /** Rate in paise, matching the storefront's money representation. */
  rate: number;
  expected_delivery: string;
  cod_charges?: number;
}

/** Convert a rupee amount (Shiprocket) to paise (storefront). */
function toPaise(amount: unknown): number {
  const value = Number(amount);
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100);
}

export async function getShippingRates(
  req: ShippingRateRequest
): Promise<ShippingRateOption[]> {
  const params = new URLSearchParams({
    pickup_postcode: String(req.pickup_postcode || ""),
    delivery_postcode: String(req.delivery_postcode || ""),
    weight: String(req.weight || 0.5),
    cod: req.cod ? "1" : "0",
  });

  const data = await shiprocketRequest(
    `/courier/serviceability/?${params.toString()}`,
    undefined,
    "GET"
  );

  const available: any[] =
    data?.data?.available_courier_companies ??
    data?.available_courier_companies ??
    [];

  return available
    .filter(
      (courier: any) =>
        courier.serviceable === true ||
        courier.serviceable === "true" ||
        courier.serviceable === 1 ||
        courier.serviceable === undefined
    )
    .map((courier: any) => {
      const rupeeRate =
        courier.rate ?? courier.freight_charge ?? courier.rate_amount ?? 0;
      return {
        courier_name: courier.courier_name || courier.company_name || "Courier",
        courier_id: Number(
          courier.courier_company_id ?? courier.company_id ?? courier.id ?? 0
        ),
        service_name:
          courier.service_name ||
          (courier.mode === 1 ? "Air" : courier.mode === 2 ? "Surface" : "Standard"),
        service_id: Number(courier.id ?? courier.courier_company_id ?? 0),
        rate: toPaise(rupeeRate),
        expected_delivery:
          courier.etd ||
          (courier.estimated_delivery_days
            ? `${courier.estimated_delivery_days} days`
            : "N/A"),
        cod_charges: toPaise(courier.cod_charges ?? 0),
      };
    })
    .sort((a, b) => a.rate - b.rate);
}

export interface CreateShipmentRequest {
  order_id: string;
  order_date?: string;
  pickup_location?: string;
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
  shipment_id: number | string;
  order_id: string;
  order_status: string;
  awb_code: string | null;
  courier_name: string | null;
  courier_service?: string | null;
  pickup_location: string;
  tracking_url: string | null;
  label_url: string | null;
  pickup_scheduled?: boolean;
}

function shiprocketDate(date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * Create a Shiprocket ad-hoc order, then assign an AWB and request pickup.
 * Shiprocket requires a pickup location configured in the dashboard; when it
 * is missing the API returns a descriptive error that the admin UI surfaces.
 */
export async function createShipment(
  req: CreateShipmentRequest
): Promise<CreateShipmentResponse> {
  const pickupLocation = req.pickup_location || SHIPROCKET_PICKUP_LOCATION;
  const payload = {
    order_id: req.order_id,
    order_date: req.order_date || shiprocketDate(),
    pickup_location: pickupLocation,
    ...(req.channel_id ? { channel_id: req.channel_id } : {}),
    ...(req.comment ? { comment: req.comment } : {}),
    billing_customer_name: req.billing_customer_name,
    billing_last_name: req.billing_last_name || "",
    billing_address: req.billing_address,
    billing_address_2: req.billing_address_2 || "",
    billing_city: req.billing_city,
    billing_state: req.billing_state,
    billing_pincode: req.billing_pincode,
    billing_country: req.billing_country || "India",
    billing_email: req.billing_email,
    billing_phone: req.billing_phone,
    shipping_is_billing: req.shipping_is_billing ?? true,
    shipping_customer_name: req.shipping_customer_name,
    shipping_last_name: req.shipping_last_name,
    shipping_address: req.shipping_address,
    shipping_address_2: req.shipping_address_2,
    shipping_city: req.shipping_city,
    shipping_state: req.shipping_state,
    shipping_pincode: req.shipping_pincode,
    shipping_country: req.shipping_country || "India",
    shipping_email: req.shipping_email,
    shipping_phone: req.shipping_phone,
    order_items: req.order_items,
    payment_method: req.payment_method || "prepaid",
    shipping_charges: req.shipping_charges || 0,
    giftwrap_charges: 0,
    transaction_charges: req.transaction_charges || 0,
    total_discount: 0,
    sub_total: req.total_value,
    length: req.length || 10,
    breadth: req.breadth || 10,
    height: req.height || 5,
    weight: req.weight || 0.5,
  };

  let created: any;
  try {
    created = await shiprocketRequest("/orders/create/adhoc", payload);
  } catch (err: any) {
    if (
      String(err?.message || "").includes("billing/shipping address first")
    ) {
      throw new Error(
        `Shiprocket has no pickup address configured. Add one in the Shiprocket dashboard under Settings → Pickup Addresses named "${pickupLocation}" (or set SHIPROCKET_PICKUP_LOCATION), then retry the shipment.`
      );
    }
    throw err;
  }
  const shipmentId =
    created.shipment_id ?? created.payload?.shipment_id ?? created.id;
  const orderId = created.order_id ?? payload.order_id;

  let awbCode: string | null = created.awb_code ?? null;
  let courierName: string | null =
    created.courier_name ?? created.courier_company_name ?? null;
  let courierService: string | null = created.courier_service ?? null;
  let pickupScheduled = false;

  // Shiprocket returns the shipment first; AWB assignment is a separate call.
  if (shipmentId) {
    try {
      const awb = await shiprocketRequest("/courier/assign/awb", {
        shipment_id: shipmentId,
      });
      const awbData = awb?.response?.data ?? awb?.data ?? awb;
      awbCode = awbData?.awb_code ?? awbCode;
      courierName =
        awbData?.courier_name ?? awbData?.courier_company_name ?? courierName;
      courierService = awbData?.courier_service ?? courierService;
    } catch (err) {
      console.error("Shiprocket AWB assignment failed:", err);
    }

    try {
      await shiprocketRequest("/courier/generate/pickup", {
        shipment_id: shipmentId,
      });
      pickupScheduled = true;
    } catch (err) {
      console.error("Shiprocket pickup request failed:", err);
    }
  }

  return {
    shipment_id: shipmentId,
    order_id: String(orderId),
    order_status: String(created.status ?? "created"),
    awb_code: awbCode,
    courier_name: courierName,
    courier_service: courierService,
    pickup_location: pickupLocation,
    tracking_url: awbCode
      ? `https://shiprocket.co/tracking/${encodeURIComponent(awbCode)}`
      : null,
    label_url: created.label_url ?? null,
    pickup_scheduled: pickupScheduled,
  };
}

export async function trackShipment(awbCode: string) {
  return shiprocketRequest(
    `/courier/track?awb_code=${encodeURIComponent(awbCode)}`,
    undefined,
    "GET"
  );
}

export { SHIPROCKET_BASE_URL };
