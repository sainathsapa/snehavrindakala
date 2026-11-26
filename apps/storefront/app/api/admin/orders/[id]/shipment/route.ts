/**
 * GET  /api/admin/orders/[id]/shipment - Read the stored shipment
 * POST /api/admin/orders/[id]/shipment - Create (or retry) the shipment
 */

import { NextResponse } from "next/server";
import { requireAdmin } from "@/app/admin/actions";
import { getAdminOrder } from "@/lib/admin";
import { getOrderShipment, saveOrderShipment } from "@/lib/shipping/store";
import { createShipmentForOrder } from "@/lib/shipping/create-order-shipment";
import { sendShipmentEmail } from "@/lib/shipping/notify";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const { id } = await params;
    const shipment = await getOrderShipment(id);
    return NextResponse.json({ shipment });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const { id } = await params;

    const existing = await getOrderShipment(id);
    if (existing) {
      return NextResponse.json({ shipment: existing, existing: true });
    }

    // ── Manual shipment ─────────────────────────────────────────────────
    // Shiprocket is one way a parcel leaves the studio, not the only one. When
    // the courier is booked outside the panel — by phone, by a local agency, by
    // handing it to someone — the order still has to be marked shipped and the
    // buyer still has to receive a tracking number. Without this, the only path
    // to "shipped" ran through an integration that can be down, unconfigured or
    // (as it was for a week) locked out.
    const body = await req.json().catch(() => ({}));
    if (body?.manual === true || body?.awb) {
      const awb = String(body.awb ?? "").trim();
      if (!awb) {
        return NextResponse.json(
          { error: "Enter the tracking number from the courier." },
          { status: 400 }
        );
      }
      const shipment = await saveOrderShipment(id, {
        awb_code: awb,
        courier_name: String(body.courier ?? "").trim() || null,
        tracking_url: String(body.trackingUrl ?? "").trim() || null,
        status: "manual",
        raw: { source: "manual", entered_by: "admin" },
      });

      let notified = false;
      try {
        const { order } = await getAdminOrder(id);
        const record = order as unknown as Record<string, any>;
        notified = await sendShipmentEmail({
          email: record.email ?? record.customer?.email ?? null,
          orderId: String(record.id),
          displayId: record.display_id ?? null,
          awb,
          courier: null,
          trackingUrl: String(body.trackingUrl ?? "").trim() || null,
          etd: null,
        });
      } catch (err) {
        console.error("[shipment] could not email the buyer", err);
      }

      return NextResponse.json({ shipment, notified, manual: true });
    }

    const { order } = await getAdminOrder(id);
    const shipment = await createShipmentForOrder(order);

    // Tell the customer it is on its way. Without this, a label booked from the
    // admin panel left the buyer with a confirmed order and no tracking until
    // the backend's `order.fulfilled` event fired — which it does not when the
    // shipment is created here. Never fatal: the label already exists.
    let notified = false;
    try {
      const record = order as unknown as Record<string, any>;
      const label = shipment as unknown as Record<string, any>;
      notified = await sendShipmentEmail({
        email: record.email ?? record.customer?.email ?? null,
        orderId: String(record.id),
        displayId: record.display_id ?? null,
        awb: label?.awb_code ?? null,
        courier: label?.courier_name ?? null,
        trackingUrl: label?.tracking_url ?? null,
        etd: label?.expected_delivery ?? label?.etd ?? null,
      });
    } catch (err) {
      console.error("[shipment] tracking email failed", err);
    }

    return NextResponse.json({ shipment, notified }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json(
      {
        error:
          err?.message ||
          "Failed to create shipment. Check the Shiprocket pickup location.",
      },
      { status: 500 }
    );
  }
}
