/**
 * A buyer cancelling their own order.
 *
 * Until now only an admin could cancel, so a person who ordered the wrong thing
 * at midnight had to write an email and wait. That is a support ticket for
 * something the customer is allowed to decide.
 *
 * The rule is deliberately narrow and is enforced here, not in the UI:
 *
 *  - the order must belong to the signed-in customer (proved by reading it with
 *    their own token, not by trusting an id from the form);
 *  - nothing may have been dispatched — once a parcel has an AWB it belongs to a
 *    courier, and cancelling it in our database would be a lie;
 *  - a paid order is cancelled but not refunded automatically. Money moving back
 *    is the refund queue's job, where a second admin signs it off.
 */

import { medusa } from "@/lib/medusa";
import { getOrderShipment, saveOrderShipment } from "@/lib/shipping/store";

export type CancelRefusal =
  | "not_found"
  | "already_shipped"
  | "not_cancellable"
  | "failed";

export interface CancelResult {
  ok: boolean;
  /** Paid orders are cancelled but need a human to send the money back. */
  refundDue?: number;
  reason?: CancelRefusal;
}

const CANCELLABLE = new Set(["pending", "pending_payment", "draft", "awaiting"]);

/** Whether the UI should offer the button at all. */
export function customerCanCancel(
  order: { status?: string | null; payment_status?: string | null } | null,
  shipment: { awb_code?: string | null; status?: string | null } | null
): boolean {
  if (!order) return false;
  if (shipment?.awb_code) return false;
  if (shipment && /picked|transit|deliver|rto/i.test(String(shipment.status ?? ""))) return false;
  return CANCELLABLE.has(String(order.status ?? "").toLowerCase());
}

/**
 * Cancel an order on behalf of the customer who owns it.
 *
 * `orderId` comes from a form, so it is treated as untrusted: the read below is
 * made with the customer's own session and will simply fail for somebody else's
 * order. That is cheaper and safer than a lookup plus an ownership comparison.
 */
export async function cancelCustomerOrder(
  orderId: string,
  customerToken: string
): Promise<CancelResult> {
  let order: any = null;
  try {
    order = await medusa.getOrder(orderId, customerToken);
  } catch {
    return { ok: false, reason: "not_found" };
  }
  if (!order) return { ok: false, reason: "not_found" };

  let shipment: Awaited<ReturnType<typeof getOrderShipment>> = null;
  try {
    shipment = await getOrderShipment(orderId);
  } catch {
    // A missing shipment row is the normal case for an unshipped order.
  }

  if (!customerCanCancel(order as any, shipment)) {
    return { ok: false, reason: shipment?.awb_code ? "already_shipped" : "not_cancellable" };
  }

  try {
    // The customer API has no cancel endpoint, so the cancellation is made with
    // the system admin token after the ownership check above.
    const { getSystemAdminToken } = await import("@/lib/admin");
    const token = await getSystemAdminToken();
    const backend =
      process.env.MEDUSA_BACKEND_URL ||
      process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ||
      "http://localhost:9000";
    const res = await fetch(`${backend.replace(/\/+$/, "")}/admin/orders/${orderId}/cancel`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("[cancel] backend refused", res.status, text.slice(0, 200));
      return { ok: false, reason: "failed" };
    }
  } catch (error) {
    console.error("[cancel] could not reach the backend", error);
    return { ok: false, reason: "failed" };
  }

  // Record the cancellation in the shipment row as well, so the admin journey
  // shows "cancelled by the buyer" rather than nothing at all.
  try {
    await saveOrderShipment(orderId, {
      status: "cancelled",
      raw: { source: "customer", cancelled_by: "customer" },
    });
  } catch {
    // Cosmetic only; the order is already cancelled.
  }

  const paid = /paid|captured|authorized/i.test(String(order.payment_status ?? ""));
  return { ok: true, refundDue: paid ? Number(order.total ?? 0) : 0 };
}
