/**
 * Medusa Admin API client for the SnehaVrinda Kala storefront admin panel.
 *
 * Authenticates as a Medusa system user (ADMIN_EMAIL / ADMIN_PASSWORD from .env)
 * so the storefront admin can manage orders, products, categories, and artists
 * through the Medusa backend admin APIs.
 */

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const BACKEND_URL = (
  process.env.MEDUSA_BACKEND_URL ||
  process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ||
  "http://localhost:9000"
).replace(/\/+$/, "");

// Never fall back to hard-coded credentials: a missing value must fail noisily
// in the admin UI instead of silently authenticating as a fixed account.
const ADMIN_EMAIL =
  process.env.MEDUSA_ADMIN_EMAIL || process.env.ADMIN_EMAIL || "";
const ADMIN_PASSWORD =
  process.env.MEDUSA_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || "";
const PUBLISHABLE_KEY =
  process.env.MEDUSA_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY ||
  "";

/**
 * Cached system admin token. Fetched once per request.
 */
let adminToken: string | null = null;
let adminTokenPromise: Promise<string | null> | null = null;

async function authenticateSystemAdmin(): Promise<string | null> {
  if (adminToken) return adminToken;
  if (adminTokenPromise) return adminTokenPromise;

  adminTokenPromise = (async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/auth/user/emailpass`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-publishable-api-key": PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
      });
      if (!res.ok) {
        console.error("System admin auth failed:", await res.text());
        return null;
      }
      const data = await res.json();
      adminToken = data?.token ?? data?.session?.token ?? null;
      return adminToken;
    } catch (err) {
      console.error("System admin auth error:", err);
      return null;
    }
  })();

  return adminTokenPromise;
}

export async function getSystemAdminToken(): Promise<string | null> {
  return authenticateSystemAdmin();
}

async function adminRequest(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  let token = await authenticateSystemAdmin();
  if (!token) {
    throw new Error("System admin authentication failed. Check ADMIN_EMAIL/ADMIN_PASSWORD.");
  }

  const perform = (authToken: string) => {
    const headers = new Headers(options.headers);
    headers.set("Authorization", `Bearer ${authToken}`);
    headers.set("x-publishable-api-key", PUBLISHABLE_KEY);
    headers.set("Accept", "application/json");
    if (options.body && !(options.body instanceof FormData)) {
      headers.set("Content-Type", "application/json");
    }

    return fetch(`${BACKEND_URL}${path}`, {
      ...options,
      headers,
      cache: "no-store",
    });
  };

  let res = await perform(token);

  // A cached token may have expired - refresh once and retry.
  if (res.status === 401) {
    adminToken = null;
    adminTokenPromise = null;
    token = await authenticateSystemAdmin();
    if (token) {
      res = await perform(token);
    }
  }

  return res;
}

/** ── Types ───────────────────────────────────────────────────────────── */

export interface AdminOrder {
  id: string;
  status: string;
  fulfillment_status: string;
  payment_status: string;
  total: number;
  currency_code: string;
  customer?: { id: string; email: string; first_name: string; last_name: string };
  created_at: string;
  updated_at: string;
  items?: any[];
}

export interface AdminProduct {
  id: string;
  title: string;
  handle: string;
  description: string;
  status: string;
  category?: { id: string; name: string; handle?: string } | null;
  category_id?: string;
  categories?: Array<{ id: string; name: string; handle?: string }>;
  variants?: any[];
  images?: any[];
  created_at: string;
  updated_at: string;
}

/**
 * Medusa returns category links as `categories`. The admin UI expects a
 * single `category` object plus a `category_id` string, so normalise both.
 */
function normalizeAdminProduct(product: any): AdminProduct {
  const categories = Array.isArray(product?.categories)
    ? product.categories
    : [];
  const category = product?.category || categories[0] || null;
  return {
    ...product,
    category: category
      ? { id: category.id, name: category.name, handle: category.handle }
      : null,
    category_id: category?.id || "",
    categories,
  };
}

export interface AdminCategory {
  id: string;
  name: string;
  handle: string;
  description: string;
  is_internal: boolean;
  created_at: string;
  updated_at: string;
}

export interface AdminArtist {
  id: string;
  display_name: string;
  slug: string;
  bio?: string;
  disciplines?: string[];
  techniques?: string[];
  commission_available: boolean;
  is_verified: boolean;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface AdminCustomer {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
  has_account: boolean;
  created_at: string;
  updated_at: string;
}

/** ── Orders ──────────────────────────────────────────────────────────── */

export async function listAdminOrders(params?: {
  limit?: number;
  offset?: number;
  status?: string;
}): Promise<{ orders: AdminOrder[]; count: number }> {
  const searchParams = new URLSearchParams();
  searchParams.set("limit", String(params?.limit ?? 50));
  searchParams.set("offset", String(params?.offset ?? 0));
  if (params?.status) searchParams.set("status", params.status);

  const res = await adminRequest(`/admin/orders?${searchParams.toString()}`);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Failed to fetch orders: ${res.status} ${body}`);
  }
  return res.json();
}

export async function getAdminOrder(orderId: string): Promise<{ order: AdminOrder }> {
  // Expand the relations needed by the confirmation page, invoice, and
  // Shiprocket shipment payload (address, items, customer).
  const fields =
    "id,display_id,status,email,currency_code,subtotal,tax_total,shipping_total,discount_total,total,created_at,updated_at,customer_id,*customer,*shipping_address,*billing_address,*items,*payment_collections,*fulfillments,*shipping_methods";
  const res = await adminRequest(
    `/admin/orders/${encodeURIComponent(orderId)}?fields=${encodeURIComponent(fields)}`
  );
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Failed to fetch order: ${res.status} ${body}`);
  }
  return res.json();
}

export async function updateAdminOrder(
  orderId: string,
  data: Record<string, unknown>
): Promise<{ order: AdminOrder }> {
  const res = await adminRequest(`/admin/orders/${encodeURIComponent(orderId)}`, {
    method: "POST",
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Failed to update order: ${res.status} ${body}`);
  }
  return res.json();
}

/** ── Products ────────────────────────────────────────────────────────── */

export async function listAdminProducts(params?: {
  limit?: number;
  offset?: number;
  q?: string;
  category?: string;
  status?: string;
}): Promise<{ products: AdminProduct[]; count: number }> {
  const searchParams = new URLSearchParams();
  searchParams.set("limit", String(params?.limit ?? 50));
  searchParams.set("offset", String(params?.offset ?? 0));
  // `*categories` expands the relation while keeping the default fields.
  searchParams.set("fields", "*categories");
  if (params?.q) searchParams.set("q", params.q);
  if (params?.category) searchParams.set("category_id", params.category);
  // Medusa expects array filters, e.g. `status[]=published`.
  if (params?.status) searchParams.append("status[]", params.status);

  const res = await adminRequest(`/admin/products?${searchParams.toString()}`);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Failed to fetch products: ${res.status} ${body}`);
  }
  const data = await res.json();
  return {
    ...data,
    products: (data.products || []).map(normalizeAdminProduct),
  };
}

export async function getAdminProduct(productId: string): Promise<{ product: AdminProduct }> {
  const res = await adminRequest(
    `/admin/products/${encodeURIComponent(productId)}?fields=*categories`
  );
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Failed to fetch product: ${res.status} ${body}`);
  }
  const data = await res.json();
  return { ...data, product: normalizeAdminProduct(data.product) };
}

/**
 * Resolve `prefix:value` tags to real Medusa tag ids, creating any that are
 * missing.
 *
 * A product update will not accept inline tag values: sending `{value}` is
 * rejected with "Field 'tags, 0, id' is required", and sending `{id}` for a tag
 * that does not exist yet fails the same way. The tag has to exist as its own
 * record first, then be referenced by id.
 */
export async function resolveProductTagIds(
  values: string[]
): Promise<{ id: string }[]> {
  if (values.length === 0) return [];

  const listRes = await adminRequest("/admin/product-tags?limit=200");
  const existing: { id: string; value: string }[] = listRes.ok
    ? ((await listRes.json()).product_tags ?? [])
    : [];
  const byValue = new Map(existing.map((t) => [t.value, t.id]));

  const out: { id: string }[] = [];
  for (const value of values) {
    const known = byValue.get(value);
    if (known) {
      out.push({ id: known });
      continue;
    }
    const created = await adminRequest("/admin/product-tags", {
      method: "POST",
      body: JSON.stringify({ value }),
    });
    if (created.ok) {
      const tag = (await created.json()).product_tag;
      if (tag?.id) out.push({ id: tag.id });
    }
  }
  return out;
}

export async function createAdminProduct(data: Record<string, unknown>): Promise<{ product: AdminProduct }> {
  const res = await adminRequest("/admin/products", {
    method: "POST",
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Failed to create product: ${res.status} ${body}`);
  }
  return res.json();
}

export async function updateAdminProduct(
  productId: string,
  data: Record<string, unknown>
): Promise<{ product: AdminProduct }> {
  const res = await adminRequest(`/admin/products/${encodeURIComponent(productId)}`, {
    method: "POST",
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Failed to update product: ${res.status} ${body}`);
  }
  return res.json();
}

export async function deleteAdminProduct(productId: string): Promise<void> {
  const res = await adminRequest(`/admin/products/${encodeURIComponent(productId)}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Failed to delete product: ${res.status} ${body}`);
  }
}

/** ── Categories ──────────────────────────────────────────────────────── */

export async function listAdminCategories(params?: {
  limit?: number;
  offset?: number;
  q?: string;
  status?: string;
}): Promise<{ categories: AdminCategory[]; count: number }> {
  const searchParams = new URLSearchParams();
  searchParams.set("limit", String(params?.limit ?? 50));
  searchParams.set("offset", String(params?.offset ?? 0));
  if (params?.q) searchParams.set("q", params.q);
  // Product categories use `is_active`, not a `status` field.
  if (params?.status === "active") searchParams.set("is_active", "true");
  else if (params?.status === "draft") searchParams.set("is_active", "false");

  const res = await adminRequest(`/admin/product-categories?${searchParams.toString()}`);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Failed to fetch categories: ${res.status} ${body}`);
  }
  const data = await res.json();
  const categories =
    data.product_categories ?? data.categories ?? [];
  return { categories, count: data.count ?? categories.length };
}

export async function createAdminCategory(data: Record<string, unknown>): Promise<{ product_category: AdminCategory }> {
  const res = await adminRequest("/admin/product-categories", {
    method: "POST",
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Failed to create category: ${res.status} ${body}`);
  }
  return res.json();
}

export async function updateAdminCategory(
  categoryId: string,
  data: Record<string, unknown>
): Promise<{ product_category: AdminCategory }> {
  const res = await adminRequest(`/admin/product-categories/${encodeURIComponent(categoryId)}`, {
    method: "POST",
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Failed to update category: ${res.status} ${body}`);
  }
  return res.json();
}

export async function deleteAdminCategory(categoryId: string): Promise<void> {
  const res = await adminRequest(`/admin/product-categories/${encodeURIComponent(categoryId)}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Failed to delete category: ${res.status} ${body}`);
  }
}

/** ── Artists / Partners ──────────────────────────────────────────────── */

export async function listAdminArtists(params?: {
  limit?: number;
  offset?: number;
  q?: string;
}): Promise<{ artists: AdminArtist[]; count: number }> {
  const searchParams = new URLSearchParams();
  searchParams.set("limit", String(params?.limit ?? 50));
  searchParams.set("offset", String(params?.offset ?? 0));
  if (params?.q) searchParams.set("q", params.q);

  const res = await adminRequest(`/admin/artists?${searchParams.toString()}`);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Failed to fetch artists: ${res.status} ${body}`);
  }
  return res.json();
}

export async function createAdminArtist(data: Record<string, unknown>): Promise<{ artist: AdminArtist }> {
  const res = await adminRequest("/admin/artists", {
    method: "POST",
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Failed to create artist: ${res.status} ${body}`);
  }
  return res.json();
}

export async function updateAdminArtist(
  artistId: string,
  data: Record<string, unknown>
): Promise<{ artist: AdminArtist }> {
  const res = await adminRequest(`/admin/artists/${encodeURIComponent(artistId)}`, {
    method: "POST",
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Failed to update artist: ${res.status} ${body}`);
  }
  return res.json();
}

export async function deleteAdminArtist(artistId: string): Promise<void> {
  const res = await adminRequest(`/admin/artists/${encodeURIComponent(artistId)}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Failed to delete artist: ${res.status} ${body}`);
  }
}

export async function toggleAdminArtistStatus(
  artistId: string,
  enabled: boolean
): Promise<{ artist: AdminArtist; enabled: boolean }> {
  const res = await adminRequest(`/admin/artists/${encodeURIComponent(artistId)}/toggle-status`, {
    method: "PATCH",
    body: JSON.stringify({ enabled }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Failed to toggle artist: ${res.status} ${body}`);
  }
  return res.json();
}

/** ── Customers ───────────────────────────────────────────────────────── */

export async function listAdminCustomers(params?: {
  limit?: number;
  offset?: number;
  q?: string;
}): Promise<{ customers: AdminCustomer[]; count: number }> {
  const searchParams = new URLSearchParams();
  searchParams.set("limit", String(params?.limit ?? 50));
  searchParams.set("offset", String(params?.offset ?? 0));
  if (params?.q) searchParams.set("q", params.q);

  const res = await adminRequest(`/admin/customers?${searchParams.toString()}`);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Failed to fetch customers: ${res.status} ${body}`);
  }
  return res.json();
}

/** ── Dashboard Stats ─────────────────────────────────────────────────── */

export async function getAdminDashboardStats(): Promise<{
  totalOrders: number;
  totalProducts: number;
  totalArtists: number;
  totalCustomers: number;
  recentOrders: AdminOrder[];
}> {
  const [ordersRes, productsRes, artistsRes, customersRes] = await Promise.all([
    listAdminOrders({ limit: 1 }),
    listAdminProducts({ limit: 1 }),
    listAdminArtists({ limit: 1 }),
    listAdminCustomers({ limit: 1 }),
  ]);

  const recentOrdersRes = await listAdminOrders({ limit: 5 });

  return {
    totalOrders: ordersRes.count,
    totalProducts: productsRes.count,
    totalArtists: artistsRes.count,
    totalCustomers: customersRes.count,
    recentOrders: recentOrdersRes.orders,
  };
}
