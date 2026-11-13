"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import {
  listAllHeroSlides,
  listAllArtForms,
  listAllFeaturedCategories,
  createHeroSlide,
  updateHeroSlide,
  deleteHeroSlide,
  createArtForm,
  updateArtForm,
  deleteArtForm,
  createFeaturedCategory,
  updateFeaturedCategory,
  deleteFeaturedCategory,
  reorder,
} from "@/lib/site-content";
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
import {
  ADMIN_SESSION_COOKIE,
  verifyAdminSession,
} from "@/lib/admin-session";

const ADMIN_EMAILS = (
  process.env.ADMIN_EMAILS || ""
)
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export async function getAdminIdentity(): Promise<{
  email: string;
  role: string;
} | null> {
  const cookieStore = await cookies();

  // Preferred: signed admin session cookie issued by /api/admin/login.
  const sessionToken = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  if (sessionToken) {
    const session = verifyAdminSession(sessionToken);
    if (session) {
      return { email: session.email, role: session.role };
    }
  }

  // Backwards compatible: a Medusa customer token for an ADMIN_EMAILS account.
  const token = cookieStore.get(AUTH_COOKIE)?.value;
  if (!token) return null;
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
    if (!res.ok) return null;
    const data = await res.json();
    const customer = data?.customer ?? data;
    const email = (customer?.email || "").toLowerCase();
    if (ADMIN_EMAILS.length > 0 && ADMIN_EMAILS.includes(email)) {
      return { email, role: "super_admin" };
    }
    return null;
  } catch {
    return null;
  }
}

export async function isAdmin(): Promise<boolean> {
  return (await getAdminIdentity()) !== null;
}

export async function requireAdmin(): Promise<boolean> {
  return isAdmin();
}

export async function adminLoginAction(formData: FormData): Promise<void> {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");

  if (!email || !password) {
    return;
  }

  if (!ADMIN_EMAILS.includes(email)) {
    return;
  }

  let token: string;
  try {
    const result = await medusa.loginCustomer(email, password);
    token = result.token;
  } catch (error) {
    console.error("Admin login failed", error);
    return;
  }

  const cookieStore = await cookies();
  cookieStore.set(AUTH_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function adminLogoutAction(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(AUTH_COOKIE);
}

export async function getDashboardStats() {
  const ok = await isAdmin();
  if (!ok) return { totalOrders: 0, totalProducts: 0, totalArtists: 0, totalCustomers: 0, recentOrders: [] };
  return getAdminDashboardStats();
}

export async function listOrders(params?: { limit?: number; offset?: number; status?: string }) {
  const ok = await isAdmin();
  if (!ok) return { orders: [], count: 0 };
  return listAdminOrders(params);
}

export async function getOrder(orderId: string) {
  const ok = await isAdmin();
  if (!ok) return null;
  return getAdminOrder(orderId);
}

export async function updateOrderStatus(orderId: string, data: Record<string, unknown>) {
  const ok = await isAdmin();
  if (!ok) return null;
  return updateAdminOrder(orderId, data);
}

export async function listProducts(params?: { limit?: number; offset?: number; q?: string; category?: string }) {
  const ok = await isAdmin();
  if (!ok) return { products: [], count: 0 };
  return listAdminProducts(params);
}

export async function getProduct(productId: string) {
  const ok = await isAdmin();
  if (!ok) return null;
  return getAdminProduct(productId);
}

export async function createProduct(data: Record<string, unknown>) {
  const ok = await isAdmin();
  if (!ok) return null;
  return createAdminProduct(data);
}

export async function updateProduct(productId: string, data: Record<string, unknown>) {
  const ok = await isAdmin();
  if (!ok) return null;
  return updateAdminProduct(productId, data);
}

export async function deleteProduct(productId: string) {
  const ok = await isAdmin();
  if (!ok) return null;
  return deleteAdminProduct(productId);
}

export async function listCategories(params?: { limit?: number; offset?: number }) {
  const ok = await isAdmin();
  if (!ok) return { categories: [], count: 0 };
  return listAdminCategories(params);
}

export async function createCategory(data: Record<string, unknown>) {
  const ok = await isAdmin();
  if (!ok) return null;
  return createAdminCategory(data);
}

export async function updateCategory(categoryId: string, data: Record<string, unknown>) {
  const ok = await isAdmin();
  if (!ok) return null;
  return updateAdminCategory(categoryId, data);
}

export async function deleteCategory(categoryId: string) {
  const ok = await isAdmin();
  if (!ok) return null;
  return deleteAdminCategory(categoryId);
}

export async function listArtists(params?: { limit?: number; offset?: number; q?: string }) {
  const ok = await isAdmin();
  if (!ok) return { artists: [], count: 0 };
  return listAdminArtists(params);
}

export async function createArtist(data: Record<string, unknown>) {
  const ok = await isAdmin();
  if (!ok) return null;
  return createAdminArtist(data);
}

export async function updateArtist(artistId: string, data: Record<string, unknown>) {
  const ok = await isAdmin();
  if (!ok) return null;
  return updateAdminArtist(artistId, data);
}

export async function deleteArtist(artistId: string) {
  const ok = await isAdmin();
  if (!ok) return null;
  return deleteAdminArtist(artistId);
}

export async function toggleArtistStatusAction(artistId: string, enabled: boolean) {
  const ok = await isAdmin();
  if (!ok) return { ok: false, message: "Not signed in." };
  return toggleAdminArtistStatus(artistId, enabled);
}

export async function listCustomers(params?: { limit?: number; offset?: number; q?: string }) {
  const ok = await isAdmin();
  if (!ok) return { customers: [], count: 0 };
  return listAdminCustomers(params);
}

export async function getPlatformMode() {
  const ok = await isAdmin();
  if (!ok) return "single-brand";
  return getPlatformModeFromEnv();
}

export async function setPlatformModeAction(mode: string): Promise<void> {
  const ok = await isAdmin();
  if (!ok) return;
  const validMode = mode === "platform" ? "platform" : "single-brand";
  await setPlatformMode(validMode);
}
/* ---------------------------- storefront content --------------------------- */

export async function listStorefrontContent() {
  if (!(await requireAdmin())) throw new Error("Not authorised.");
  const [slides, artForms, categories] = await Promise.all([
    listAllHeroSlides(),
    listAllArtForms(),
    listAllFeaturedCategories(),
  ]);
  return { slides, artForms, categories };
}

export async function saveHeroSlideAction(formData: FormData) {
  if (!(await requireAdmin())) throw new Error("Not authorised.");
  const id = Number(formData.get("id") || 0);
  const input = {
    eyebrow: String(formData.get("eyebrow") || ""),
    title: String(formData.get("title") || "").trim(),
    tagline: String(formData.get("tagline") || ""),
    cta_label: String(formData.get("cta_label") || ""),
    cta_href: String(formData.get("cta_href") || "/shop"),
    image: String(formData.get("image") || ""),
    published: formData.get("published") === "on",
  };
  if (!input.title) throw new Error("A slide needs a title.");

  if (id) await updateHeroSlide(id, input);
  else await createHeroSlide(input);
  revalidatePath("/");
  revalidatePath("/admin/content");
}

export async function deleteHeroSlideAction(formData: FormData) {
  if (!(await requireAdmin())) throw new Error("Not authorised.");
  await deleteHeroSlide(Number(formData.get("id")));
  revalidatePath("/");
  revalidatePath("/admin/content");
}

export async function saveArtFormAction(formData: FormData) {
  if (!(await requireAdmin())) throw new Error("Not authorised.");
  const id = Number(formData.get("id") || 0);
  const input = {
    slug: String(formData.get("slug") || "").trim().toLowerCase(),
    name: String(formData.get("name") || "").trim(),
    description: String(formData.get("description") || ""),
    image: String(formData.get("image") || ""),
    published: formData.get("published") === "on",
    // Editorial fields for /art-forms/[slug]. Plain text with `**bold**` spans;
    // deliberately not HTML so an admin cannot inject markup into a public page.
    story: String(formData.get("story") || ""),
    origin: String(formData.get("origin") || ""),
    materials: String(formData.get("materials") || ""),
    quote: String(formData.get("quote") || ""),
  };
  if (!input.slug || !input.name) throw new Error("An art form needs a name and slug.");

  if (id) await updateArtForm(id, input);
  else await createArtForm(input);
  revalidatePath("/");
  revalidatePath("/art-forms");
  revalidatePath(`/art-forms/${input.slug}`);
  revalidatePath("/admin/content");
}

export async function deleteArtFormAction(formData: FormData) {
  if (!(await requireAdmin())) throw new Error("Not authorised.");
  await deleteArtForm(Number(formData.get("id")));
  revalidatePath("/");
  revalidatePath("/art-forms");
  revalidatePath("/admin/content");
}

export async function saveFeaturedCategoryAction(formData: FormData) {
  if (!(await requireAdmin())) throw new Error("Not authorised.");
  const id = Number(formData.get("id") || 0);
  const input = {
    label: String(formData.get("label") || "").trim(),
    href: String(formData.get("href") || "").trim(),
    image: String(formData.get("image") || ""),
    published: formData.get("published") === "on",
  };
  if (!input.label || !input.href) throw new Error("A category needs a label and link.");

  if (id) await updateFeaturedCategory(id, input);
  else await createFeaturedCategory(input);
  revalidatePath("/");
  revalidatePath("/admin/content");
}

export async function deleteFeaturedCategoryAction(formData: FormData) {
  if (!(await requireAdmin())) throw new Error("Not authorised.");
  await deleteFeaturedCategory(Number(formData.get("id")));
  revalidatePath("/");
  revalidatePath("/admin/content");
}

export async function reorderContentAction(formData: FormData) {
  if (!(await requireAdmin())) throw new Error("Not authorised.");
  const table = String(formData.get("table")) as
    | "site_hero_slide"
    | "site_art_form"
    | "site_featured_category";
  const id = Number(formData.get("id"));
  const direction = String(formData.get("direction")) === "up" ? "up" : "down";
  if (!["site_hero_slide", "site_art_form", "site_featured_category"].includes(table)) {
    throw new Error("Unknown list.");
  }
  await reorder(table, id, direction);
  revalidatePath("/");
  revalidatePath("/art-forms");
  revalidatePath("/admin/content");
}
