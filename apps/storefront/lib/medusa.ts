/**
 * Medusa API client for the SnehaVrinda Kala storefront.
 *
 * Calls the Medusa v2 backend API directly via fetch. All commerce data
 * (products, carts, orders, customers) is sourced from Medusa.
 */

const BACKEND_URL =
  process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || "http://localhost:9000";

export interface MedusaProduct {
  id: string;
  title: string;
  subtitle?: string;
  description: string;
  handle: string;
  status: string;
  is_new?: boolean;
  price?: number;
  currency_code?: string;
  options?: any[];
  variants?: any[];
  images?: any[];
  category?: any;
  collection?: any;
  weight?: number;
  length?: number;
  height?: number;
  width?: number;
  hs_code?: string;
  origin_country?: string;
  mid_code?: string;
  material?: string;
  created_at: string;
  updated_at: string;
}

export interface MedusaCart {
  id: string;
  status: string;
  items: any[];
  subtotal: number;
  total: number;
  currency_code: string;
  email?: string;
  shipping_address?: any;
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
  items: any[];
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

class MedusaClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
      ...options,
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      throw new Error(
        `Medusa API error: ${response.status} ${errorBody}`
      );
    }

    return response.json();
  }

  // Products
  async listProducts(params?: {
    limit?: number;
    offset?: number;
    category?: string;
    q?: string;
  }): Promise<{ products: MedusaProduct[]; count: number }> {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.set("limit", String(params.limit));
    if (params?.offset) searchParams.set("offset", String(params.offset));
    if (params?.category) searchParams.set("category", params.category);
    if (params?.q) searchParams.set("q", params.q);

    return this.request<{
      products: MedusaProduct[];
      count: number;
      limit: number;
      offset: number;
    }>(`/store/products?${searchParams.toString()}`);
  }

  async getProduct(handle: string): Promise<{ product: MedusaProduct }> {
    return this.request<{ product: MedusaProduct }>(
      `/store/products/${handle}`
    );
  }

  async listProductCategories(params?: {
    limit?: number;
    offset?: number;
  }): Promise<{ categories: any[]; count: number }> {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.set("limit", String(params.limit));
    if (params?.offset) searchParams.set("offset", String(params.offset));
    return this.request<{
      categories: any[];
      count: number;
    }>(`/store/categories?${searchParams.toString()}`);
  }

  // Carts
  async createCart(): Promise<MedusaCart> {
    return this.request<{ cart: MedusaCart }>("/store/carts", {
      method: "POST",
      body: JSON.stringify({}),
    }).then((r) => r.cart);
  }

  async getCart(cartId: string): Promise<MedusaCart> {
    return this.request<{ cart: MedusaCart }>(
      `/store/carts/${cartId}`
    ).then((r) => r.cart);
  }

  async addToCart(cartId: string, item: {
    variant_id: string;
    quantity: number;
  }): Promise<MedusaCart> {
    return this.request<{ cart: MedusaCart }>(
      `/store/carts/${cartId}/line-items`,
      {
        method: "POST",
        body: JSON.stringify(item),
      }
    ).then((r) => r.cart);
  }

  async updateLineItem(cartId: string, lineItemId: string, quantity: number): Promise<MedusaCart> {
    return this.request<{ cart: MedusaCart }>(
      `/store/carts/${cartId}/line-items/${lineItemId}`,
      {
        method: "POST",
        body: JSON.stringify({ quantity }),
      }
    ).then((r) => r.cart);
  }

  async removeLineItem(cartId: string, lineItemId: string): Promise<MedusaCart> {
    return this.request<{ cart: MedusaCart }>(
      `/store/carts/${cartId}/line-items/${lineItemId}`,
      { method: "DELETE" }
    ).then((r) => r.cart);
  }

  // Orders
  async getOrder(orderId: string): Promise<MedusaOrder> {
    return this.request<{ order: MedusaOrder }>(
      `/store/orders/${orderId}`
    ).then((r) => r.order);
  }

  async listOrders(params?: {
    limit?: number;
    offset?: number;
  }): Promise<{ orders: MedusaOrder[]; count: number }> {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.set("limit", String(params.limit));
    if (params?.offset) searchParams.set("offset", String(params.offset));
    return this.request<{ orders: MedusaOrder[]; count: number }>(
      `/store/orders?${searchParams.toString()}`
    );
  }

  // Customers
  async getCustomer(customerId: string): Promise<any> {
    return this.request<{ customer: any }>(
      `/store/customers/${customerId}`
    ).then((r) => r.customer);
  }

  // Artists (custom module)
  async listArtists(params?: {
    limit?: number;
    offset?: number;
    q?: string;
  }): Promise<{ artists: MedusaArtist[]; count: number }> {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.set("limit", String(params.limit));
    if (params?.offset) searchParams.set("offset", String(params.offset));
    if (params?.q) searchParams.set("q", params.q);
    return this.request<{ artists: MedusaArtist[]; count: number }>(
      `/store/artists?${searchParams.toString()}`
    );
  }

  async getArtist(slug: string): Promise<{ artist: MedusaArtist }> {
    return this.request<{ artist: MedusaArtist }>(
      `/store/artists/${slug}`
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
  }): Promise<{ commission_request: MedusaCommissionRequest; reference_id: string }> {
    return this.request("/store/commissions", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async getCommissionRequest(referenceId: string): Promise<{
    commission_request: MedusaCommissionRequest;
  }> {
    return this.request(
      `/store/commissions/${referenceId}`
    );
  }
}

export const medusa = new MedusaClient(BACKEND_URL);
