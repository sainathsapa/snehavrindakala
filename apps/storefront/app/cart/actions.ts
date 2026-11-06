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
    country_code: "in",
    phone,
  };

  try {
    await medusa.updateCart(cart.id, {
      email,
      shipping_address: shippingAddress,
      billing_address: shippingAddress,
    });
  } catch (error) {
    console.error("Failed to save checkout details", error);
    redirect("/checkout?error=save");
  }

  redirect("/checkout?saved=1");
}
