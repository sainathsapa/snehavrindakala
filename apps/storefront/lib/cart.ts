import { cookies } from "next/headers";
import { medusa, type MedusaCart } from "./medusa";
import { getPreferredCurrency } from "./currency";

export const CART_COOKIE = "svk_cart_id";
const CART_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

export async function getCart(): Promise<MedusaCart | null> {
  const cartId = (await cookies()).get(CART_COOKIE)?.value;
  if (!cartId) return null;

  try {
    return await medusa.getCart(cartId);
  } catch {
    // Cart was completed or removed; treat it as empty.
    return null;
  }
}

/**
 * Get the current cart or create a new one. Must only be called from a
 * Server Action or Route Handler because it writes a cookie.
 */
export async function ensureCart(): Promise<MedusaCart> {
  const existing = await getCart();
  if (existing) return existing;

  // Create the cart in the region the visitor is browsing in. A cart created in
  // the default region would keep quoting rupees even after they picked another
  // currency, and Medusa cannot switch a live cart's region afterwards.
  const currency = await getPreferredCurrency();
  const regionId = await medusa.regionIdForCurrency(currency);
  const cart = await medusa.createCart(regionId);
  (await cookies()).set(CART_COOKIE, cart.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: CART_COOKIE_MAX_AGE,
  });
  return cart;
}
