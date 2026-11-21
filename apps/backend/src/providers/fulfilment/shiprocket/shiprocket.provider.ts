import { AbstractFulfillmentProviderService, MedusaError } from "@medusajs/utils";
import type {
  CalculatedShippingOptionPrice,
  CreateFulfillmentResult,
  CreateShippingOptionDTO,
  FulfillmentOption,
  ValidateFulfillmentDataContext,
} from "@medusajs/types";

/**
 * Shiprocket fulfilment provider for Medusa v2.
 *
 * The v1 adapter this replaces was a plain class with a `({container, options})`
 * factory, so Medusa v2 could not register it and the shop fell back to
 * `manual_manual`. This extends `AbstractFulfillmentProviderService`, which is
 * what the loader looks for, and implements the v2 method names.
 *
 * Two options are offered rather than a courier list, because the real courier
 * is chosen per delivery PIN by Shiprocket's serviceability API at checkout
 * (the storefront already quotes it). Pinning a courier id here would quote a
 * service the buyer may not be able to receive.
 *
 * Credentials are never invented: without email/password/token the provider
 * refuses to be registered (see the conditional block in `medusa-config.ts`).
 */

export type ShiprocketOptions = {
  email?: string;
  password?: string;
  api_token?: string;
  pickup_location?: string;
  /** Shiprocket's webhook token, used to reject forged tracking callbacks. */
  webhook_token?: string;
  base_url?: string;
};

type ShiprocketOrderResponse = {
  order_id?: number | string;
  shipment_id?: number | string;
  status?: string;
  awb_code?: string;
  courier_name?: string;
  courier_company_id?: number | string;
  label_url?: string;
  tracking_url?: string;
  [k: string]: unknown;
};

export class ShiprocketFulfilmentProvider extends AbstractFulfillmentProviderService {
  static identifier = "shiprocket";

  protected readonly email_: string;
  protected readonly password_: string;
  protected readonly apiToken_: string;
  protected readonly pickupLocation_: string;
  protected readonly webhookToken_: string;
  protected readonly baseUrl_: string;
  protected cachedToken_: string | null = null;

  static validateOptions(options: Record<string, unknown>): void {
    const hasToken = Boolean(options.api_token || process.env.SHIPROCKET_API_TOKEN);
    const hasPassword = Boolean(
      (options.email || process.env.SHIPROCKET_EMAIL) &&
        (options.password || process.env.SHIPROCKET_PASSWORD)
    );
    if (!hasToken && !hasPassword) {
      throw new Error(
        "Shiprocket provider requires SHIPROCKET_API_TOKEN or SHIPROCKET_EMAIL + SHIPROCKET_PASSWORD"
      );
    }
  }

  constructor(_container: Record<string, unknown>, options: ShiprocketOptions = {}) {
    super();

    this.email_ = options.email || process.env.SHIPROCKET_EMAIL || "";
    this.password_ =
      options.password || process.env.SHIPROCKET_PASSWORD || "";
    this.apiToken_ =
      options.api_token || process.env.SHIPROCKET_API_TOKEN || "";
    this.webhookToken_ =
      options.webhook_token || process.env.SHIPROCKET_WEBHOOK_TOKEN || "";
    this.pickupLocation_ =
      options.pickup_location ||
      process.env.SHIPROCKET_PICKUP_LOCATION ||
      "Primary";
    this.baseUrl_ =
      options.base_url || "https://apiv2.shiprocket.in/v1/external";

    if (!this.apiToken_ && (!this.email_ || !this.password_)) {
      throw new Error(
        "Shiprocket provider requires email and password credentials"
      );
    }
  }

  // ── Shipping options ──────────────────────────────────────────────────

  async getFulfillmentOptions(): Promise<FulfillmentOption[]> {
    return [
      {
        id: "shiprocket-standard",
        name: "Shiprocket — standard courier",
        service: "standard",
      },
      {
        id: "shiprocket-express",
        name: "Shiprocket — priority courier",
        service: "express",
      },
    ];
  }

  async validateOption(data: Record<string, unknown>): Promise<boolean> {
    return Boolean(data?.id);
  }

  /**
   * Stores the chosen service on the shipping method. No network call: the
   * quote belongs to checkout, and a failure here would make the admin form
   * unusable whenever Shiprocket is slow.
   */
  async validateFulfillmentData(
    optionData: Record<string, unknown>,
    data: Record<string, unknown>,
    _context: ValidateFulfillmentDataContext
  ): Promise<Record<string, unknown>> {
    return {
      ...data,
      shiprocket: {
        service: optionData?.service || "standard",
        pickup_location: this.pickupLocation_,
      },
    };
  }

  /**
   * Prices are fixed on the shipping option in the admin, so this provider does
   * not calculate them. Quoting per PIN happens at checkout (`lib/shipping`),
   * where the buyer's address is known.
   */
  async canCalculate(_data: CreateShippingOptionDTO): Promise<boolean> {
    return false;
  }

  async calculatePrice(): Promise<CalculatedShippingOptionPrice> {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "Shiprocket prices are fixed on the shipping option; this provider does not calculate them."
    );
  }

  // ── Fulfilment lifecycle ──────────────────────────────────────────────

  async createFulfillment(
    data: Record<string, unknown>,
    items: Record<string, any>[],
    order: Record<string, any> | undefined,
    fulfillment: Record<string, any>,
    _additionalData?: Record<string, unknown>
  ): Promise<CreateFulfillmentResult> {
    const address = order?.shipping_address || order?.billing_address || {};
    const service = String(
      (data?.shiprocket as Record<string, unknown>)?.service || "standard"
    );

    const payload = {
      order_id: `medusa_${order?.id || fulfillment?.id || Date.now()}`,
      order_date: new Date().toISOString().slice(0, 16).replace("T", " "),
      pickup_location: this.pickupLocation_,
      channel: "Web",
      comment: "SnehaVrinda Kala",
      billing_customer_name: first(address.first_name, address.last_name),
      billing_last_name: String(address.last_name || ""),
      billing_address: String(address.address_1 || ""),
      billing_address_2: String(address.address_2 || ""),
      billing_city: String(address.city || ""),
      billing_pincode: String(address.postal_code || ""),
      billing_state: String(
        (address.province as string) || address.province_code || ""
      ),
      billing_country: "India",
      billing_email: String(order?.email || ""),
      billing_phone: String(address.phone || order?.shipping_address?.phone || ""),
      shipping_is_billing: true,
      order_items: (items || []).map((item) => ({
        name: String(item.title || item.product_title || "Artwork"),
        sku: String(item.sku || item.variant_sku || item.id || ""),
        units: Number(item.quantity || 1),
        selling_price: Number(item.unit_price || 0),
        discount: 0,
        tax: 0,
        hsn: 9701, // original works of art
      })),
      payment_method: "Prepaid",
      shipping_charges: 0,
      giftwrap_charges: 0,
      transaction_charges: 0,
      total_discount: 0,
      sub_total: (items || []).reduce(
        (sum, item) =>
          sum + Number(item.unit_price || 0) * Number(item.quantity || 1),
        0
      ),
      length: 10,
      breadth: 10,
      height: 10,
      weight: 0.5,
    };

    const created = await this.request<ShiprocketOrderResponse>(
      "POST",
      "/orders/create/adhoc",
      payload
    );

    const shipmentId = created?.shipment_id;
    let awb = created?.awb_code;
    let courierName = created?.courier_name;

    // Ad-hoc orders come back without an AWB; assigning one is what turns the
    // order into a shippable shipment. A failure here is not fatal — the
    // order exists in Shiprocket and can be assigned from its dashboard — so
    // it is recorded rather than thrown.
    if (shipmentId && !awb) {
      try {
        const assigned = await this.request<ShiprocketOrderResponse>(
          "POST",
          "/courier/assign/awb",
          { shipment_id: shipmentId }
        );
        awb = assigned?.awb_code;
        courierName = assigned?.courier_name || courierName;
      } catch {
        // Left for the admin exception queue: the order exists, the AWB does not.
      }
    }

    const providerData = {
      shiprocket_order_id: created?.order_id ?? null,
      shiprocket_shipment_id: shipmentId ?? null,
      awb_code: awb ?? null,
      courier_name: courierName ?? null,
      service,
      status: created?.status ?? "created",
      created_at: new Date().toISOString(),
    };

    return {
      data: providerData,
      labels: [
        {
          tracking_number: String(awb || ""),
          tracking_url: awb
            ? `https://shiprocket.co/tracking/${encodeURIComponent(String(awb))}`
            : "",
          label_url: String(created?.label_url || ""),
        },
      ],
    };
  }

  async cancelFulfillment(data: Record<string, unknown>): Promise<any> {
    const shiprocket = (data?.shiprocket as Record<string, unknown>) || {};
    const orderId = shiprocket.shiprocket_order_id ?? data?.shiprocket_order_id;
    const awb = shiprocket.awb_code ?? data?.awb_code;
    const shipmentId =
      shiprocket.shiprocket_shipment_id ?? data?.shiprocket_shipment_id;

    if (!orderId && !awb && !shipmentId) {
      // Nothing was ever sent to Shiprocket; cancelling is a no-op rather than
      // an error the admin cannot act on.
      return { ...data, canceled: false };
    }

    if (orderId) {
      await this.request("POST", `/orders/cancel/${encodeURIComponent(String(orderId))}`);
    }

    return { ...data, canceled: true, canceled_at: new Date().toISOString() };
  }

  async getFulfillmentDocuments(
    _data: Record<string, unknown>
  ): Promise<never[]> {
    // Labels are generated on demand in the Shiprocket dashboard.
    return [];
  }

  async getShipmentDocuments(_data: Record<string, unknown>): Promise<never[]> {
    return [];
  }

  // ── Webhooks ──────────────────────────────────────────────────────────

  /**
   * Shiprocket signs its callbacks with a shared token header rather than an
   * HMAC over the body, so the whole body cannot be verified — but a forged
   * request without the token is rejected here.
   */
  verifyWebhookToken(token: string | undefined): boolean {
    if (!this.webhookToken_) return false;
    if (!token) return false;
    const a = Buffer.from(this.webhookToken_);
    const b = Buffer.from(token);
    return a.length === b.length && a.equals(b);
  }

  // ── HTTP ──────────────────────────────────────────────────────────────

  /** Authenticate with Shiprocket and return a bearer token. */
  async authenticate(): Promise<string> {
    if (this.apiToken_) return this.apiToken_;
    if (this.cachedToken_) return this.cachedToken_;

    const response = await fetch(`${this.baseUrl_}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: this.email_, password: this.password_ }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(
        `Shiprocket authentication failed: ${response.status} ${errorBody}`
      );
    }

    const data = (await response.json()) as { token?: string };
    if (!data?.token) {
      throw new Error("Shiprocket authentication returned no token");
    }
    this.cachedToken_ = data.token;
    return data.token;
  }

  protected async request<T = any>(
    method: string,
    path: string,
    body?: Record<string, unknown>,
    retries: number = 2
  ): Promise<T> {
    const token = await this.authenticate();
    const response = await fetch(`${this.baseUrl_}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    // An expired token is the one failure worth retrying; anything else is
    // reported as-is so the admin sees Shiprocket's own message.
    if (response.status === 401 && retries > 0) {
      this.cachedToken_ = null;
      return this.request<T>(method, path, body, retries - 1);
    }

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(
        `Shiprocket API error: ${method} ${path} ${response.status} ${errorBody}`
      );
    }

    return (await response.json()) as T;
  }

  /** Serviceability + rate quote for a delivery PIN. */
  async quote(options: {
    pickup_postcode: string;
    delivery_postcode: string;
    weight: number;
    cod: boolean;
  }): Promise<any> {
    const params = new URLSearchParams({
      pickup_postcode: options.pickup_postcode,
      delivery_postcode: options.delivery_postcode,
      weight: String(options.weight),
      cod: options.cod ? "1" : "0",
    });
    return this.request("GET", `/courier/serviceability/?${params.toString()}`);
  }

  /** Tracking for an AWB, used by the track-order page and the admin. */
  async track(awb: string): Promise<any> {
    return this.request(
      "GET",
      `/courier/track?awb_code=${encodeURIComponent(awb)}`
    );
  }
}

function first(...values: (string | null | undefined)[]): string {
  const found = values.find((v) => Boolean(v));
  return String(found || "Customer");
}

export default ShiprocketFulfilmentProvider;
