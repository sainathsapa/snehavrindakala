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
import { getAuthToken } from "@/lib/auth";
import { cancelCustomerOrder } from "@/lib/order-cancel";

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
