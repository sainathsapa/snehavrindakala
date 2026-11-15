import { cookies } from "next/headers";
import { localeRedirect } from "@/lib/locale-redirect";
import { getLocale } from "next-intl/server";
import { medusa } from "@/lib/medusa";

export const AUTH_COOKIE = "medusa_auth_token";

export async function getAuthToken(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(AUTH_COOKIE)?.value;
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
    localeRedirect("/account/login", await getLocale());
  }
  return customer;
}
