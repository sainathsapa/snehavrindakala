"use server";

/**
 * The buyer cancelling their own order.
 *
 * Kept as a server action rather than an API route because it is a form on a
 * page, not an integration point: the browser posts the order id, this checks
 * that the signed-in customer owns it, and refuses anything that has already
 * been dispatched.
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAuthToken } from "@/lib/auth";
import { cancelCustomerOrder } from "@/lib/order-cancel";
import { ensureCart } from "@/lib/cart";
import { medusa } from "@/lib/medusa";

export interface CancelOrderState {
  ok: boolean;
  message: string;
  /** Shown as an extra line: the studio still has to send the money back. */
  refundNote?: string;
}

export async function cancelOrderAction(
  _prev: CancelOrderState | null,
  formData: FormData
): Promise<CancelOrderState> {
  const orderId = String(formData.get("orderId") || "").trim();
  if (!orderId) {
    return { ok: false, message: "That order could not be identified." };
  }

  const token = await getAuthToken();
  if (!token) {
    return { ok: false, message: "Please sign in again to cancel an order." };
  }

  const result = await cancelCustomerOrder(orderId, token);

  if (!result.ok) {
    const message =
      result.reason === "already_shipped"
        ? "This order has already been handed to the courier, so it cannot be cancelled here. Write to the studio and we will help."
        : result.reason === "not_cancellable"
          ? "This order is past the point where it can be cancelled online. Write to the studio and we will look at it with you."
          : result.reason === "not_found"
            ? "We could not find that order on your account."
            : "The cancellation did not go through. Please try again, or write to the studio.";
    return { ok: false, message };
  }

  revalidatePath("/account/orders");
  revalidatePath("/account");

  return {
    ok: true,
    message: "Your order is cancelled.",
    refundNote:
      result.refundDue && result.refundDue > 0
        ? "You have been charged for this order. The studio will return the payment — refunds are signed off by a person, so allow a few working days."
        : undefined,
  };
}

export interface ReorderState {
  ok: boolean;
  added: number;
  skipped: number;
  message: string;
}

/**
 * Buy the same thing again.
 *
 * A gifting shop has repeat buyers, and asking one of them to hunt down a work
 * they already chose, one page at a time, loses the sale at the point of highest
 * intent. This rebuilds the basket from an order the customer owns — read with
 * their own token, so an id typed into a form cannot fill a basket from somebody
 * else's order.
 *
 * A work that has since sold cannot be added, and that is reported rather than
 * silently dropped: a basket that quietly arrives half-empty is the kind of
 * surprise that ends a purchase.
 */
export async function reorderAction(
  _prev: ReorderState | null,
  formData: FormData
): Promise<ReorderState> {
  const orderId = String(formData.get("orderId") || "").trim();
  const locale = String(formData.get("locale") || "en").trim() || "en";

  if (!orderId) {
    return { ok: false, added: 0, skipped: 0, message: "That order could not be identified." };
  }

  const token = await getAuthToken();
  if (!token) {
    return { ok: false, added: 0, skipped: 0, message: "Please sign in again." };
  }

  let order;
  try {
    order = await medusa.getOrder(orderId, token);
  } catch {
    return { ok: false, added: 0, skipped: 0, message: "That order is not on this account." };
  }

  const lines = ((order?.items ?? []) as any[])
    .map((item) => ({
      variant_id: String(item.variant_id || item.variant?.id || ""),
      quantity: Number(item.quantity || 1),
    }))
    .filter((line) => line.variant_id);

  if (lines.length === 0) {
    return {
      ok: false,
      added: 0,
      skipped: 0,
      message: "That order has nothing that can be re-ordered.",
    };
  }

  let cart;
  try {
    cart = await ensureCart();
  } catch {
    return {
      ok: false,
      added: 0,
      skipped: 0,
      message: "The basket could not be opened. Please try again.",
    };
  }

  let added = 0;
  let skipped = 0;
  for (const line of lines) {
    try {
      await medusa.addToCart(cart.id, line);
      added += 1;
    } catch {
      // Sold since, or withdrawn: the work is gone, not the order.
      skipped += 1;
    }
  }

  revalidatePath("/cart");

  if (added === 0) {
    return {
      ok: false,
      added: 0,
      skipped,
      message:
        "None of those works are available now — a one-of-one cannot be re-ordered once it has sold.",
    };
  }

  redirect(`/${locale}/cart`);
}
