/**
 * Shipment notifications.
 *
 * One function, called from every place a shipment comes into existence, so the
 * customer learns about tracking from the same source whether the label was
 * booked in the admin panel, by the completion route, or by the backend
 * subscriber.
 *
 * Never throws: a label that exists but whose email failed is support work, not
 * a failed shipment.
 */

import { sendAccountEmail } from "@/lib/email/send";

export interface ShipmentNotification {
  email: string | null | undefined;
  orderId: string;
  displayId?: string | number | null;
  awb?: string | null;
  courier?: string | null;
  trackingUrl?: string | null;
  etd?: string | null;
}

/**
 * Resolve the best tracking URL we have.
 *
 * The courier's own page (from Shiprocket) beats our generic fallback, because
 * it is the page that will actually show scans.
 */
export function trackingLink(awb: string | null | undefined, provided?: string | null): string | null {
  if (provided) return provided;
  if (!awb) return null;
  return `https://shiprocket.co/tracking/${encodeURIComponent(String(awb))}`;
}

export async function sendShipmentEmail(shipment: ShipmentNotification): Promise<boolean> {
  const to = String(shipment.email || "").trim();
  if (!to) {
    console.warn(`[shipment] order ${shipment.orderId} has no email; tracking not sent`);
    return false;
  }

  return sendAccountEmail({
    to,
    template: "shipment_confirmed",
    // One email per order per AWB: re-booking a label is a new shipment.
    eventKey: `shipment_confirmed:${shipment.orderId}:${shipment.awb ?? "no-awb"}`,
    data: {
      order_id: shipment.orderId,
      display_id: shipment.displayId ?? null,
      awb_code: shipment.awb ?? null,
      tracking_number: shipment.awb ?? null,
      courier_name: shipment.courier ?? null,
      tracking_url: trackingLink(shipment.awb, shipment.trackingUrl),
      expected_delivery: shipment.etd ?? null,
    },
  });
}
