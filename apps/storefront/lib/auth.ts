import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { medusa } from "@/lib/medusa";

export const AUTH_COOKIE = "medusa_auth_token";

export async function getAuthToken(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(AUTH_COOKIE)?.value;
}

export async function authHeaders(): Promise<Record<string, string>> {
  const token = await getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function getCurrentCustomer(): Promise<any | null> {
  const token = await getAuthToken();
  if (!token) return null;
  try {
    const { customer } = await medusa.getCurrentCustomer(token);
    return customer ?? null;
  } catch {
    return null;
  }
}

export async function requireCustomer() {
  const customer = await getCurrentCustomer();
  if (!customer) {
    redirect("/account/login");
  }
  return customer;
}
