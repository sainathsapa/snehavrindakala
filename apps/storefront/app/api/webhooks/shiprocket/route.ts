/**
 * POST /api/webhooks/shiprocket — shipment status callback.
 *
 * Refuses to run when SHIPROCKET_WEBHOOK_TOKEN is unset, and verifies the shared
 * token from either the header Shiprocket sends (x-api-key by default, configurable
 * in their dashboard as "Auth Token Type") or a query string (?token= / ?key=).
 *
 * Shiprocket refuses webhook URLs containing shiprocket, kartrocket, sr or kr, so
 * the URL they are given is /api/webhooks/courier (same handler, no banned word).
 * The lookup is by AWB first (the number buyers see) then by order id, and the
 * upsert is idempotent: a repeated callback updates the same shipment row.
 *
 * Live verification needs the owner's Shiprocket token and a real event.
 */

import { NextResponse } from "next/server";
import { findShipmentByAwb, getOrderShipment, saveOrderShipment } from "@/lib/shipping/store";
import { extractShipmentUpdate, webhookTokenMatches } from "@/lib/shipping/status-sync";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const expected = process.env.SHIPROCKET_WEBHOOK_TOKEN;
  if (!expected) {
    return NextResponse.json(
      { error: "Shiprocket webhook is not configured." },
      { status: 503 }
    );
  }

  const url = new URL(req.url);
  // Header names Shiprocket's "Auth Token Type" dropdown offers, plus our own.
  const candidate =
    req.headers.get("x-api-key") ||
    req.headers.get("x-webhook-token") ||
    req.headers.get("x-auth-token") ||
    url.searchParams.get("token") ||
    url.searchParams.get("key");
  if (!webhookTokenMatches(candidate, expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const update = extractShipmentUpdate(payload);
  if (!update.status || (!update.awb && !update.orderId)) {
    return NextResponse.json(
      { error: "Unrecognised shipment event" },
      { status: 422 }
    );
  }

  try {
    const found = update.awb
      ? await findShipmentByAwb(update.awb)
      : update.orderId
        ? await getOrderShipment(update.orderId)
        : null;

    if (!found) {
      // Unknown shipment: acknowledge so Shiprocket stops retrying, but do not
      // pretend it was applied. An operator can reconcile from the admin panel.
      return NextResponse.json({ applied: false, reason: "shipment_not_found" });
    }

    await saveOrderShipment(found.order_id, {
      shiprocket_order_id: found.shiprocket_order_id,
      shipment_id: found.shipment_id,
      awb_code: update.awb ?? found.awb_code,
      courier_name: update.courier ?? found.courier_name,
      courier_service: found.courier_service,
      tracking_url: found.tracking_url,
      label_url: found.label_url,
      pickup_location: found.pickup_location,
      status: update.status,
      raw: { ...(found.raw ?? {}), last_webhook_status: update.status, last_webhook_at: new Date().toISOString() },
    });

    // Delivered is the one status worth an email of its own, and only on the
    // transition: Shiprocket resends, and a buyer should not be asked twice.
    if (
      update.status === "delivered" &&
      String(found.status ?? "") !== "delivered"
    ) {
      try {
        const { getAdminOrder } = await import("@/lib/admin");
        const { sendAccountEmail } = await import("@/lib/email/send");
        const { order } = await getAdminOrder(found.order_id);
        const record = order as unknown as Record<string, any>;
        const items = (record.items ?? []).map((item: any) => ({
          title: item.title || item.product_title,
          url: item.product_handle
            ? `https://snehavrinda.in/products/${item.product_handle}#reviews`
            : undefined,
        }));
        if (record.email) {
          await sendAccountEmail({
            to: record.email,
            template: "review_request",
            eventKey: `review_request:${found.order_id}`,
            data: {
              order_id: found.order_id,
              display_id: record.display_id ?? null,
              items,
            },
          });
        }
      } catch (error) {
        // A delivered parcel must not be reported as failed because an email
        // could not be sent.
        console.error("[courier] review request not sent", error);
      }
    }

    return NextResponse.json({ applied: true, order_id: found.order_id, status: update.status });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
