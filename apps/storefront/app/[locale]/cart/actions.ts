"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
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

export async function saveCheckoutDetailsAction(
  formData: FormData
): Promise<void> {
  const cart = await getCart();
  if (!cart) {
    redirect("/cart");
  }

  const fullName = String(formData.get("full_name") || "").trim();
  const email = String(formData.get("email") || "").trim();
  const phone = String(formData.get("phone") || "").trim();
  const address = String(formData.get("address") || "").trim();
  const city = String(formData.get("city") || "").trim();
  const state = String(formData.get("state") || "").trim();
  const postalCode = String(formData.get("postal_code") || "").trim();
  // Shipping is no longer India-only. The country drives both the Medusa address
  // and which currencies are offered at checkout.
  const countryCode = String(formData.get("country_code") || "in")
    .trim()
    .toLowerCase();

  if (
    !fullName ||
    !email ||
    !phone ||
    !address ||
    !city ||
    !state ||
    !postalCode
  ) {
    redirect("/checkout?error=missing");
  }

  const [firstName, ...rest] = fullName.split(/\s+/);
  const shippingAddress = {
    first_name: firstName,
    last_name: rest.join(" ") || firstName,
    address_1: address,
    city,
    province: state,
    postal_code: postalCode,
    country_code: countryCode,
    phone,
  };

  // Billing is often not the delivery address — an office card paying for a
  // gift sent home, a company account, a relative's house. Copying the shipping
  // address into billing declared the wrong country to the payment processor
  // and to customs, so the two are now collected separately. The form leaves
  // billing blank, and only fills it when the buyer says it differs.
  const billingDiffers = String(formData.get("billing_differs") || "") === "on";
  const billingName = String(formData.get("billing_name") || "").trim();
  const billingAddress1 = String(formData.get("billing_address") || "").trim();
  const billingCity = String(formData.get("billing_city") || "").trim();
  const billingState = String(formData.get("billing_state") || "").trim();
  const billingPostal = String(formData.get("billing_postal_code") || "").trim();
  const billingCountry = String(formData.get("billing_country_code") || "")
    .trim()
    .toLowerCase();

  let billingAddress = shippingAddress;
  if (billingDiffers) {
    if (
      !billingName ||
      !billingAddress1 ||
      !billingCity ||
      !billingState ||
      !billingPostal ||
      !billingCountry
    ) {
      redirect("/checkout?error=billing");
    }
    const [billingFirst, ...billingRest] = billingName.split(/\s+/);
    billingAddress = {
      first_name: billingFirst,
      last_name: billingRest.join(" ") || billingFirst,
      address_1: billingAddress1,
      city: billingCity,
      province: billingState,
      postal_code: billingPostal,
      country_code: billingCountry,
      phone,
    };
  }

  try {
    await medusa.updateCart(cart.id, {
      email,
      shipping_address: shippingAddress,
      billing_address: billingAddress,
    });
  } catch (error) {
    console.error("Failed to save checkout details", error);
    redirect("/checkout?error=save");
  }

  redirect("/checkout?saved=1");
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
    // Medusa's message is the useful part; fall back to ours only when it is
    // not an Error (a network fault says nothing about the code itself).
    const message =
      error instanceof Error && error.message
        ? error.message.replace(/^The promotion code /, "Code ").replace(/ is invalid$/, " is not valid.")
        : "We could not apply that code. Please try again.";
    return { ok: false, message };
  }

  revalidatePath("/cart");
  revalidatePath("/checkout");
  return { ok: true, message: `Code ${code} applied.` };
}
