"use server";

import { revalidatePath } from "next/cache";
import { ensureCart, getCart } from "@/lib/cart";
import { medusa } from "@/lib/medusa";

export interface CartActionResult {
  ok: boolean;
  message: string;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message.includes("publishable")) {
    return "The store is not connected to the catalogue yet.";
  }
  return "Something went wrong. Please try again.";
}

export async function addToCartAction(
  variantId: string,
  quantity = 1
): Promise<CartActionResult> {
  if (!variantId) {
    return { ok: false, message: "Select a product option first." };
  }

  try {
    const cart = await ensureCart();
    await medusa.addToCart(cart.id, { variant_id: variantId, quantity });
    revalidatePath("/cart");
    return { ok: true, message: "Added to cart." };
  } catch (error) {
    console.error("Failed to add item to cart", error);
    return { ok: false, message: errorMessage(error) };
  }
}

export async function updateCartItemAction(
  formData: FormData
): Promise<void> {
  const lineId = String(formData.get("line_id") || "");
  const quantity = Number(formData.get("quantity") || 1);
  if (!lineId || !Number.isFinite(quantity) || quantity < 1) return;

  const cart = await getCart();
  if (!cart) return;

  try {
    await medusa.updateLineItem(cart.id, lineId, quantity);
  } catch (error) {
    console.error("Failed to update cart item", error);
  }
  revalidatePath("/cart");
}

export async function removeCartItemAction(
  formData: FormData
): Promise<void> {
  const lineId = String(formData.get("line_id") || "");
  if (!lineId) return;

  const cart = await getCart();
  if (!cart) return;

  try {
    await medusa.removeLineItem(cart.id, lineId);
  } catch (error) {
    console.error("Failed to remove cart item", error);
  }
  revalidatePath("/cart");
}

/**
 * Apply a promotion code to the basket.
 *
 * Returns Medusa's own error text when the code is rejected. The reasons differ
 * meaningfully — expired, minimum spend not reached, already used — and a
 * generic "invalid code" would leave the buyer guessing which one applies.
 */
export async function applyPromoCodeAction(
  _previous: CartActionResult | null,
  formData: FormData
): Promise<CartActionResult> {
  const code = String(formData.get("code") ?? "").trim().toUpperCase();
  if (!code) {
    return { ok: false, message: "Enter a code first." };
  }

  const cart = await getCart();
  if (!cart) {
    return { ok: false, message: "Your cart is empty." };
  }

  try {
    await medusa.applyPromoCodes(cart.id, [code]);
  } catch (error) {
    return { ok: false, message: promoError(error, code) };
  }

  revalidatePath("/cart");
  revalidatePath("/checkout");
  return { ok: true, message: `Code ${code} applied.` };
}

/**
 * Turn a Medusa rejection into something a buyer can act on.
 *
 * Medusa embeds the raw request in its message ("Medusa API request failed:
 * 400 /store/carts/cart_.../promotions"). Showing that tells the customer
 * nothing and exposes an internal id, so the useful sentence is extracted and
 * anything unrecognised becomes a plain "not valid".
 */
function promoError(error: unknown, code: string): string {
  const raw = error instanceof Error ? error.message : "";

  // "The promotion code X is invalid" -> "Code X is not valid."
  const invalid = raw.match(/promotion code\s+(\S+)\s+is invalid/i);
  if (invalid) return `Code ${invalid[1].toUpperCase()} is not valid.`;

  if (/minimum|minimum_quantity|min_item/i.test(raw)) {
    return `Code ${code} needs a minimum order value.`;
  }
  if (/expired|date/i.test(raw)) {
    return `Code ${code} has expired.`;
  }
  if (/already|usage|limit/i.test(raw)) {
    return `Code ${code} has already been used.`;
  }
  if (/currency/i.test(raw)) {
    return `Code ${code} does not apply in this currency.`;
  }

  // Never surface the raw request path or status code.
  return `We could not apply ${code}. Please check it and try again.`;
}
