"use server";

/**
 * Guest order lookup.
 *
 * Two things have to be true before an order is shown to someone with no
 * session: the caller must know the order id, and they must supply the email
 * address that was used at checkout. One alone is not enough —
 *
 *   - an order id on its own is guessable enough to enumerate, and returns the
 *     buyer's name, address, phone and order value;
 *   - an email on its own is not unique (repeat customers) and is the thing an
 *     attacker is most likely to already have.
 *
 * Together they are a weak credential, which is the honest description: this is
 * the same trade every "track my order" form makes, and it is why the result
 * below is a deliberately narrow view of the order rather than the full record.
 *
 * The comparison happens here, on the server, and the address is never echoed
 * back in an error message — a mismatch must not confirm whether an order id
 * exists.
 */

import { getAdminOrder } from "@/lib/admin";
import { getOrderShipment, findShipmentByAwb } from "@/lib/shipping/store";

export interface TrackedOrder {
  displayId: string | number | null;
  status: string;
  paymentStatus: string;
  createdAt: string | null;
  total: number | null;
  currency: string;
  customerName: string | null;
  items: { title: string; quantity: number }[];
  shipment: {
    status: string | null;
    trackingNumber: string | null;
    trackingUrl: string | null;
    carrier: string | null;
  } | null;
}

export interface TrackResult {
  ok: boolean;
  /** A message safe to show verbatim; never names the address that was tried. */
  error?: string;
  order?: TrackedOrder;
}

/** Constant-time-ish compare so a wrong address does not leak by timing. */
function sameEmail(a: string, b: string): boolean {
  const left = a.trim().toLowerCase();
  const right = b.trim().toLowerCase();
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i += 1) {
    diff |= left.charCodeAt(i) ^ right.charCodeAt(i);
  }
  return diff === 0;
}

export async function trackOrder(
  _prev: TrackResult | null,
  formData: FormData
): Promise<TrackResult> {
  const rawId = String(formData.get("orderId") || "").trim();
  const email = String(formData.get("email") || "").trim();

  if (!rawId || !email) {
    return { ok: false, error: "Enter both your order number and email address." };
  }

  // Accept what the buyer actually has in front of them: the order id from the
  // URL (order_01J...) or the display id from the confirmation email (#1042),
  // and the AWB printed on the parcel. The AWB is the one people reach for —
  // it is what arrives on the slip and what a courier's app shows — so it is
  // tried when the id does not resolve rather than rejected outright.
  const id = rawId.replace(/^#/, "");

  let record: any = null;
  try {
    const result = await getAdminOrder(id);
    record = result.order;
  } catch {
    // Not an order id. It may still be a tracking number, so resolve that to
    // the order it belongs to before giving up.
    try {
      const shipment = await findShipmentByAwb(id);
      if (shipment?.order_id) {
        const result = await getAdminOrder(shipment.order_id);
        record = result.order;
      }
    } catch {
      // Fall through to the shared rejection below.
    }
  }

  if (!record) {
    // One message for "no such order", "no such AWB" and "wrong email".
    // Distinguishing them would tell an attacker which ids exist.
    return {
      ok: false,
      error:
        "We could not find an order matching those details. Check the number and the email used at checkout.",
    };
  }

  const orderEmail: string | undefined =
    record?.email ||
    record?.customer?.email ||
    record?.shipping_address?.email ||
    undefined;

  if (!orderEmail || !sameEmail(orderEmail, email)) {
    return {
      ok: false,
      error:
        "We could not find an order matching those details. Check the number and the email used at checkout.",
    };
  }

  let shipment: Awaited<ReturnType<typeof getOrderShipment>> = null;
  try {
    shipment = await getOrderShipment(record.id);
  } catch {
    // Tracking is a bonus; the order itself still shows.
  }

  const address = record.shipping_address || record.billing_address || {};

  return {
    ok: true,
    order: {
      displayId: record.display_id ?? null,
      status: String(record.status ?? "pending"),
      paymentStatus: String(record.payment_status ?? "awaiting"),
      createdAt: record.created_at ?? null,
      total: record.total ?? null,
      currency: String(record.currency_code ?? "inr").toUpperCase(),
      customerName: [address.first_name, address.last_name]
        .filter(Boolean)
        .join(" ") || null,
      items: (record.items ?? []).map((item: any) => ({
        title: String(item.title || item.product_title || "Item"),
        quantity: Number(item.quantity ?? 1),
      })),
      shipment: shipment
        ? {
            status: shipment.status ?? null,
            trackingNumber: shipment.awb_code ?? null,
            trackingUrl: shipment.tracking_url ?? null,
            carrier: shipment.courier_name ?? null,
          }
        : null,
    },
  };
}
