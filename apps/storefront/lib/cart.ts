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

/**
 * Hand the current basket to the signed-in customer.
 *
 * This is what makes a cart follow someone between devices. The basket lives in
 * a cookie, so it is per-browser by nature: a buyer who adds a work on a phone
 * and opens the site on a laptop would otherwise start from an empty cart.
 * After a successful login the cookie cart is claimed by the account, and
 * Medusa returns the customer's existing cart when there is one.
 *
 * Called on login and registration only. It must never run on a guest visit:
 * claiming a cart for no customer would strip it from the browser it belongs to.
 *
 * Returns the cart id the browser should now use, or null when the visitor has
 * no cart and nothing to claim.
 */
export async function claimCartForCustomer(
  token: string
): Promise<string | null> {
  const cartId = (await cookies()).get(CART_COOKIE)?.value;
  if (!cartId) return null;

  try {
    const { cart } = await medusa.transferCart(token, cartId);
    const claimedId = cart?.id ?? cartId;
    (await cookies()).set(CART_COOKIE, claimedId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: CART_COOKIE_MAX_AGE,
    });
    return claimedId;
  } catch (error) {
    // A transfer failure must not block sign-in. The buyer keeps the basket in
    // this browser, which is the state they were already in.
    console.error("Claiming cart for customer failed", error);
    return cartId;
  }
}
