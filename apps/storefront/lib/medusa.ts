/**
 * Server-side Medusa v2 Store API client.
 *
 * The publishable API key and backend URL are read from server-only
 * environment variables so credentials are never shipped to the browser.
 */

const BACKEND_URL = (
  process.env.MEDUSA_BACKEND_URL ||
  process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ||
  "http://localhost:9000"
).replace(/\/+$/, "");

const PUBLISHABLE_KEY =
  process.env.MEDUSA_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY ||
  "";

const DEFAULT_CURRENCY =
  process.env.MEDUSA_CURRENCY_CODE?.toLowerCase() || "inr";

const REGION_ID = process.env.MEDUSA_REGION_ID || undefined;

const REQUEST_TIMEOUT_MS = Number(
  process.env.MEDUSA_REQUEST_TIMEOUT_MS || 10_000
);

export interface MedusaMoney {
  amount: number;
  currency_code?: string;
}

export interface MedusaCalculatedPrice {
  calculated_amount: number;
  original_amount?: number;
  currency_code?: string;
}

export interface MedusaVariant {
  id: string;
  title?: string;
  sku?: string | null;
  inventory_quantity?: number;
  calculated_price?: MedusaCalculatedPrice | null;
  prices?: MedusaMoney[];
  options?: Array<{ option_id?: string; value: string }>;
  metadata?: Record<string, unknown> | null;
}

export interface MedusaProductImage {
  id?: string;
  url: string;
  rank?: number;
}

export interface MedusaProduct {
  id: string;
  title: string;
  subtitle?: string | null;
  description?: string | null;
  handle: string;
  status: string;
  thumbnail?: string | null;
  is_new?: boolean;
  options?: Array<{ id?: string; title: string; values?: Array<{ value: string }> }>;
  variants?: MedusaVariant[];
  images?: MedusaProductImage[];
  category?: { id: string; name: string; handle?: string } | null;
  collection?: { id: string; title: string } | null;
  material?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface MedusaCartLineItem {
  id: string;
  title?: string;
  product_title?: string;
  variant_title?: string | null;
  quantity: number;
  unit_price: number;
  total?: number;
  thumbnail?: string | null;
}

export interface MedusaCart {
  id: string;
  status: string;
  items: MedusaCartLineItem[];
  subtotal: number;
  total: number;
  currency_code: string;
  email?: string | null;
  created_at: string;
  updated_at: string;
}

export interface MedusaOrder {
  id: string;
  status: string;
  fulfillment_status: string;
  payment_status: string;
  total: number;
  currency_code: string;
  items: MedusaCartLineItem[];
  created_at: string;
  updated_at: string;
}

export interface MedusaArtist {
  id: string;
  display_name: string;
  slug: string;
  bio?: string | null;
  disciplines?: string[] | null;
  techniques?: string[] | null;
  portrait_media_id?: string | null;
  commission_available: boolean;
  is_verified: boolean;
}

export interface MedusaCommissionRequest {
  reference_id: string;
  status: string;
  art_form: string;
  brief: string;
  target_date?: string | null;
  delivery_region?: string | null;
  delivery_pin?: string | null;
  assigned_artist_id?: string | null;
  created_at: string;
  updated_at: string;
}

export class MedusaApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: string
  ) {
    super(message);
    this.name = "MedusaApiError";
  }
}

export class MedusaNotConfiguredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MedusaNotConfiguredError";
  }
}

class MedusaClient {
  private readonly baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    if (!PUBLISHABLE_KEY) {
      throw new MedusaNotConfiguredError(
        "MEDUSA_PUBLISHABLE_KEY is not set. Create a publishable API key in the Medusa admin and add it to the storefront environment."
      );
    }

    const headers = new Headers(options.headers);
    headers.set("Accept", "application/json");
    headers.set("x-publishable-api-key", PUBLISHABLE_KEY);
    if (options.body) {
      headers.set("Content-Type", "application/json");
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers,
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new MedusaApiError(
        `Medusa API request failed: ${response.status} ${path}`,
        response.status,
        body
      );
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return (await response.json()) as T;
  }

  private productQuery(params: {
    limit?: number;
    offset?: number;
    category?: string;
    q?: string;
    handle?: string;
    order?: string;
  }): string {
    const searchParams = new URLSearchParams();
    searchParams.set("limit", String(params.limit ?? 50));
    searchParams.set("offset", String(params.offset ?? 0));
    searchParams.set("order", params.order ?? "-created_at");
    if (REGION_ID) searchParams.set("region_id", REGION_ID);
    if (params.category) {
      searchParams.append("category_id[]", params.category);
    }
    if (params.q) searchParams.set("q", params.q);
    if (params.handle) searchParams.set("handle", params.handle);
    return searchParams.toString();
  }

  // Products
  async listProducts(params?: {
    limit?: number;
    offset?: number;
    category?: string;
    q?: string;
    handle?: string;
  }): Promise<{ products: MedusaProduct[]; count: number }> {
    return this.request<{
      products: MedusaProduct[];
      count: number;
      limit: number;
      offset: number;
    }>(`/store/products?${this.productQuery(params ?? {})}`);
  }

  async getProduct(handle: string): Promise<{ product: MedusaProduct }> {
    const { products } = await this.listProducts({ handle, limit: 1 });
    const product = products[0];
    if (!product) {
      throw new MedusaApiError(
        `Product "${handle}" was not found`,
        404,
        ""
      );
    }
    return { product };
  }

  async listProductCategories(params?: {
    limit?: number;
    offset?: number;
  }): Promise<{ product_categories: any[]; count: number }> {
    const searchParams = new URLSearchParams();
    searchParams.set("limit", String(params?.limit ?? 100));
    searchParams.set("offset", String(params?.offset ?? 0));
    return this.request<{ product_categories: any[]; count: number }>(
      `/store/product-categories?${searchParams.toString()}`
    );
  }

  // Regions / carts
  async listRegions(): Promise<{ regions: any[] }> {
    return this.request<{ regions: any[] }>("/store/regions");
  }

  async createCart(regionId?: string): Promise<MedusaCart> {
    const region = regionId || (await this.resolveRegionId());
    return this.request<{ cart: MedusaCart }>("/store/carts", {
      method: "POST",
      body: JSON.stringify({ region_id: region }),
    }).then((r) => r.cart);
  }

  async getCart(cartId: string): Promise<MedusaCart> {
    return this.request<{ cart: MedusaCart }>(
      `/store/carts/${encodeURIComponent(cartId)}`
    ).then((r) => r.cart);
  }

  async updateCart(
    cartId: string,
    data: {
      email?: string;
      shipping_address?: Record<string, unknown>;
      billing_address?: Record<string, unknown>;
    }
  ): Promise<MedusaCart> {
    return this.request<{ cart: MedusaCart }>(
      `/store/carts/${encodeURIComponent(cartId)}`,
      {
        method: "POST",
        body: JSON.stringify(data),
      }
    ).then((r) => r.cart);
  }

  async addToCart(
    cartId: string,
    item: { variant_id: string; quantity: number }
  ): Promise<MedusaCart> {
    return this.request<{ cart: MedusaCart }>(
      `/store/carts/${encodeURIComponent(cartId)}/line-items`,
      {
        method: "POST",
        body: JSON.stringify(item),
      }
    ).then((r) => r.cart);
  }

  async updateLineItem(
    cartId: string,
    lineItemId: string,
    quantity: number
  ): Promise<MedusaCart> {
    return this.request<{ cart: MedusaCart }>(
      `/store/carts/${encodeURIComponent(cartId)}/line-items/${encodeURIComponent(lineItemId)}`,
      {
        method: "POST",
        body: JSON.stringify({ quantity }),
      }
    ).then((r) => r.cart);
  }

  async removeLineItem(
    cartId: string,
    lineItemId: string
  ): Promise<MedusaCart> {
    return this.request<{ cart: MedusaCart }>(
      `/store/carts/${encodeURIComponent(cartId)}/line-items/${encodeURIComponent(lineItemId)}`,
      { method: "DELETE" }
    ).then((r) => r.cart);
  }

  private async resolveRegionId(): Promise<string> {
    if (REGION_ID) return REGION_ID;
    const { regions } = await this.listRegions();
    const region = regions.find(
      (r) =>
        String(r.currency_code || "").toLowerCase() === DEFAULT_CURRENCY
    );
    if (!region) {
      throw new MedusaApiError(
        `No Medusa region found for currency "${DEFAULT_CURRENCY}". Set MEDUSA_REGION_ID or create a region.`,
        404,
        ""
      );
    }
    return region.id;
  }

  // Orders
  async getOrder(orderId: string): Promise<MedusaOrder> {
    return this.request<{ order: MedusaOrder }>(
      `/store/orders/${encodeURIComponent(orderId)}`
    ).then((r) => r.order);
  }

  // Customers
  async getCustomer(customerId: string): Promise<any> {
    return this.request<{ customer: any }>(
      `/store/customers/${encodeURIComponent(customerId)}`
    ).then((r) => r.customer);
  }

  // Artists (custom module)
  async listArtists(params?: {
    limit?: number;
    offset?: number;
    q?: string;
  }): Promise<{ artists: MedusaArtist[]; count: number }> {
    const searchParams = new URLSearchParams();
    searchParams.set("limit", String(params?.limit ?? 100));
    searchParams.set("offset", String(params?.offset ?? 0));
    if (params?.q) searchParams.set("q", params.q);
    return this.request<{ artists: MedusaArtist[]; count: number }>(
      `/store/artists?${searchParams.toString()}`
    );
  }

  async getArtist(slug: string): Promise<{ artist: MedusaArtist }> {
    return this.request<{ artist: MedusaArtist }>(
      `/store/artists/${encodeURIComponent(slug)}`
    );
  }

  // Commissions (custom module)
  async createCommissionRequest(data: {
    customer_id?: string;
    art_form: string;
    brief: string;
    intended_use?: string;
    dimensions?: string;
    budget_range?: string;
    target_date?: string;
    delivery_region?: string;
    delivery_pin?: string;
  }): Promise<{
    commission_request: MedusaCommissionRequest;
    reference_id: string;
  }> {
    return this.request("/store/commissions", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async getCommissionRequest(referenceId: string): Promise<{
    commission_request: MedusaCommissionRequest;
  }> {
    return this.request(
      `/store/commissions/${encodeURIComponent(referenceId)}`
    );
  }
  // Customer auth
  async registerCustomer(email: string, password: string): Promise<{ token: string }> {
    return this.request<{ token: string }>("/auth/customer/emailpass/register", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  }

  async loginCustomer(email: string, password: string): Promise<{ token: string }> {
    return this.request<{ token: string }>("/auth/customer/emailpass", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  }

  async createCustomer(
    token: string,
    data: { email: string; first_name?: string; last_name?: string; phone?: string }
  ): Promise<{ customer: any }> {
    return this.request<{ customer: any }>("/store/customers", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(data),
    });
  }

  async getCurrentCustomer(token: string): Promise<{ customer: any }> {
    return this.request<{ customer: any }>("/store/customers/me", {
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  async updateCustomer(
    token: string,
    data: Record<string, unknown>
  ): Promise<{ customer: any }> {
    return this.request<{ customer: any }>("/store/customers/me", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(data),
    });
  }

  async listCustomerOrders(
    token: string,
    params?: { limit?: number; offset?: number }
  ): Promise<{ orders: any[]; count: number }> {
    const searchParams = new URLSearchParams();
    searchParams.set("limit", String(params?.limit ?? 20));
    searchParams.set("offset", String(params?.offset ?? 0));
    return this.request<{ orders: any[]; count: number }>(
      `/store/orders?${searchParams.toString()}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
  }
}

export const medusa = new MedusaClient(BACKEND_URL);

/**
 * Resolve a product's price in minor currency units. Medusa v2 exposes
 * calculated prices when a region/currency is supplied; fall back to the
 * variant price list for older responses.
 */
export function getVariantPrice(
  variant?: MedusaVariant | null
): number | null {
  if (!variant) return null;
  if (variant.calculated_price?.calculated_amount != null) {
    return variant.calculated_price.calculated_amount;
  }
  const price = variant.prices?.find(
    (p) =>
      (p.currency_code || "").toLowerCase() === DEFAULT_CURRENCY
  );
  return price?.amount ?? null;
}

export function getProductPrice(product?: MedusaProduct | null): number | null {
  for (const variant of product?.variants ?? []) {
    const price = getVariantPrice(variant);
    if (price != null) return price;
  }
  return null;
}

export function getStockType(product?: MedusaProduct | null): string {
  const metadataValue = product?.metadata?.stock_type;
  if (typeof metadataValue === "string" && metadataValue) {
    return metadataValue;
  }
  const option = product?.options?.find(
    (item) => item.title.toLowerCase() === "stock type"
  );
  return option?.values?.[0]?.value || "ready_to_ship";
}

export function formatPrice(
  amountInMinorUnits: number | null | undefined,
  currency = "INR"
): string {
  if (amountInMinorUnits == null) return "Price on request";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amountInMinorUnits / 100);
}
