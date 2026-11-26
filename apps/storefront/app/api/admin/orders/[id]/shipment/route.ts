/**
 * GET  /api/admin/orders/[id]/shipment - Read the stored shipment
 * POST /api/admin/orders/[id]/shipment - Create (or retry) the shipment
 */

import { NextResponse } from "next/server";
import { requireAdmin } from "@/app/admin/actions";
import { getAdminOrder } from "@/lib/admin";
import { getOrderShipment } from "@/lib/shipping/store";
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
