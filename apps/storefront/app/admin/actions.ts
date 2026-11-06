"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { medusa } from "@/lib/medusa";
import { AUTH_COOKIE } from "@/lib/auth";
import {
  listAdminOrders,
  getAdminOrder,
  updateAdminOrder,
  listAdminProducts,
  getAdminProduct,
  createAdminProduct,
  updateAdminProduct,
  deleteAdminProduct,
  listAdminCategories,
  createAdminCategory,
  updateAdminCategory,
  deleteAdminCategory,
  listAdminArtists,
  createAdminArtist,
  updateAdminArtist,
  deleteAdminArtist,
  toggleAdminArtistStatus,
  listAdminCustomers,
  getAdminDashboardStats,
} from "@/lib/admin";
import {
  getPlatformModeFromEnv,
  isPlatformMode,
  isSingleBrandMode,
  setPlatformMode,
} from "@/lib/settings";

const ADMIN_EMAILS = (
  process.env.ADMIN_EMAILS || ""
)
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

/** ── Auth ───────────────────────────────────────────────────────────── */

export async function isAdmin(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE)?.value;
  if (!token) return false;
  try {
    const res = await fetch(
      `${(
        process.env.MEDUSA_BACKEND_URL ||
        process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ||
        "http://localhost:9000"
      ).replace(/\/+$/, "")}/store/customers/me`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "x-publishable-api-key":
            process.env.MEDUSA_PUBLISHABLE_KEY ||
            process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY ||
            "",
          Accept: "application/json",
        },
        cache: "no-store",
      }
    );
    if (!res.ok) return false;
    const data = await res.json();
    const customer = data?.customer ?? data;
    const email = (customer?.email || "").toLowerCase();
    return ADMIN_EMAILS.length > 0 && ADMIN_EMAILS.includes(email);
  } catch {
    return false;
  }
}

export async function requireAdmin() {
  const ok = await isAdmin();
  if (!ok) {
    redirect("/admin/login");
  }
}

export async function adminLoginAction(formData: FormData): Promise<void> {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");

  if (!email || !password) {
    redirect("/admin/login?error=missing");
  }

  if (!ADMIN_EMAILS.includes(email)) {
    redirect("/admin/login?error=not_admin");
  }

  let token: string;
  try {
    const result = await medusa.loginCustomer(email, password);
    token = result.token;
  } catch (error) {
    console.error("Admin login failed", error);
    redirect("/admin/login?error=invalid");
  }

  const cookieStore = await cookies();
  cookieStore.set(AUTH_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  redirect("/admin");
}

export async function adminLogoutAction(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(AUTH_COOKIE);
  redirect("/");
}

/** ── Dashboard ───────────────────────────────────────────────────────── */

export async function getDashboardStats() {
  await requireAdmin();
  return getAdminDashboardStats();
}

/** ── Orders ──────────────────────────────────────────────────────────── */

export async function listOrders(params?: {
  limit?: number;
  offset?: number;
  status?: string;
}) {
  await requireAdmin();
  return listAdminOrders(params);
}

export async function getOrder(orderId: string) {
  await requireAdmin();
  return getAdminOrder(orderId);
}

export async function updateOrderStatus(
  orderId: string,
  data: Record<string, unknown>
) {
  await requireAdmin();
  return updateAdminOrder(orderId, data);
}

/** ── Products ────────────────────────────────────────────────────────── */

export async function listProducts(params?: {
  limit?: number;
  offset?: number;
  q?: string;
  category?: string;
}) {
  await requireAdmin();
  return listAdminProducts(params);
}

export async function getProduct(productId: string) {
  await requireAdmin();
  return getAdminProduct(productId);
}

export async function createProduct(data: Record<string, unknown>) {
  await requireAdmin();
  return createAdminProduct(data);
}

export async function updateProduct(
  productId: string,
  data: Record<string, unknown>
) {
  await requireAdmin();
  return updateAdminProduct(productId, data);
}

export async function deleteProduct(productId: string) {
  await requireAdmin();
  return deleteAdminProduct(productId);
}

/** ── Categories ──────────────────────────────────────────────────────── */

export async function listCategories(params?: { limit?: number; offset?: number }) {
  await requireAdmin();
  return listAdminCategories(params);
}

export async function createCategory(data: Record<string, unknown>) {
  await requireAdmin();
  return createAdminCategory(data);
}

export async function updateCategory(
  categoryId: string,
  data: Record<string, unknown>
) {
  await requireAdmin();
  return updateAdminCategory(categoryId, data);
}

export async function deleteCategory(categoryId: string) {
  await requireAdmin();
  return deleteAdminCategory(categoryId);
}

/** ── Artists / Partners ──────────────────────────────────────────────── */

export async function listArtists(params?: { limit?: number; offset?: number; q?: string }) {
  await requireAdmin();
  return listAdminArtists(params);
}

export async function createArtist(data: Record<string, unknown>) {
  await requireAdmin();
  return createAdminArtist(data);
}

export async function updateArtist(
  artistId: string,
  data: Record<string, unknown>
) {
  await requireAdmin();
  return updateAdminArtist(artistId, data);
}

export async function deleteArtist(artistId: string) {
  await requireAdmin();
  return deleteAdminArtist(artistId);
}

export async function toggleArtistStatusAction(
  artistId: string,
  enabled: boolean
) {
  await requireAdmin();
  return toggleAdminArtistStatus(artistId, enabled);
}

/** ── Customers ───────────────────────────────────────────────────────── */

export async function listCustomers(params?: {
  limit?: number;
  offset?: number;
  q?: string;
}) {
  await requireAdmin();
  return listAdminCustomers(params);
}

/** ── Settings ────────────────────────────────────────────────────────── */

export async function getPlatformMode() {
  await requireAdmin();
  return getPlatformModeFromEnv();
}

export async function setPlatformModeAction(mode: string): Promise<void> {
  await requireAdmin();
  const validMode = mode === "platform" ? "platform" : "single-brand";
  await setPlatformMode(validMode);
  redirect("/admin/settings?saved=1");
}
