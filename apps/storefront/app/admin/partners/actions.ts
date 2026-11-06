"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const ADMIN_EMAILS = (
  process.env.ADMIN_EMAILS || ""
)
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

const BACKEND_URL = (
  process.env.MEDUSA_BACKEND_URL ||
  process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ||
  "http://localhost:9000"
).replace(/\/+$/, "");

async function getAuthToken(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get("medusa_auth_token")?.value;
}

const PUBLISHABLE_KEY =
  process.env.MEDUSA_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY ||
  "";

async function adminHeaders(token: string): Promise<Record<string, string>> {
  return {
    Authorization: `Bearer ${token}`,
    "x-publishable-api-key": PUBLISHABLE_KEY,
    Accept: "application/json",
  };
}

export async function isAdmin(): Promise<boolean> {
  const token = await getAuthToken();
  if (!token) return false;
  try {
    const res = await fetch(`${BACKEND_URL}/store/customers/me`, {
      headers: await adminHeaders(token),
      cache: "no-store",
    });
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

interface ArtistRow {
  id: string;
  display_name: string;
  slug: string;
  status: string;
  commission_available: boolean;
  is_verified: boolean;
  created_at: string;
  disciplines?: string[] | null;
}

export async function listArtists(): Promise<ArtistRow[]> {
  const token = await getAuthToken();
  if (!token) return [];
  try {
    const res = await fetch(`${BACKEND_URL}/admin/artists?limit=100`, {
      headers: await adminHeaders(token),
      cache: "no-store",
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data?.artists ?? []).map((a: any) => ({
      id: a.id,
      display_name: a.display_name,
      slug: a.slug,
      status: a.status,
      commission_available: a.commission_available,
      is_verified: a.is_verified,
      created_at: a.created_at,
      disciplines: a.disciplines,
    }));
  } catch {
    return [];
  }
}

export async function toggleArtistStatus(
  id: string,
  enabled: boolean
): Promise<{ ok: boolean; message: string }> {
  const token = await getAuthToken();
  if (!token) {
    return { ok: false, message: "Not signed in." };
  }
  try {
    const res = await fetch(
      `${BACKEND_URL}/admin/artists/${encodeURIComponent(id)}/toggle-status`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ enabled }),
      }
    );
    const data = await res.json();
    if (!res.ok) {
      return { ok: false, message: data.error || "Failed to update status." };
    }
    return {
      ok: true,
      message: `Partner ${data.artist?.enabled ? "enabled" : "disabled"} successfully.`,
    };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Failed to update status.",
    };
  }
}
