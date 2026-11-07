/**
 * GET  /api/admin/orders/[id]/shipment - Read the stored shipment
 * POST /api/admin/orders/[id]/shipment - Create (or retry) the shipment
 */

import { NextResponse } from "next/server";
import { requireAdmin } from "@/app/admin/actions";
import { getAdminOrder } from "@/lib/admin";
import { getOrderShipment } from "@/lib/shipping/store";
import { createShipmentForOrder } from "@/lib/shipping/create-order-shipment";

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
    return NextResponse.json({ shipment }, { status: 201 });
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
