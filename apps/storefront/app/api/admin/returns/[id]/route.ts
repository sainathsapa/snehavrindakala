/**
 * PATCH /api/admin/returns/[id] - Update return request status
 * DELETE /api/admin/returns/[id] - Delete a return request
 */

import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireAdmin } from "@/app/admin/actions";



export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const { id } = await params;
    const body = await req.json();
    const { status } = body;

    const allowed = ["pending", "approved", "rejected", "completed"];
    if (!status || !allowed.includes(status)) {
      return NextResponse.json(
        { error: `status must be one of: ${allowed.join(", ")}` },
        { status: 400 }
      );
    }

    const rows = await query(
      `UPDATE return_requests
       SET status = $1, updated_at = now()
       WHERE id = $2
       RETURNING *`,
      [status, id]
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: "Return request not found" }, { status: 404 });
    }

    // Approving a return is the moment the parcel has to come back, so the
    // reverse pickup is booked here instead of being left for someone to arrange
    // by hand. A courier failure does not fail the approval — the decision
    // stands and the response says plainly that the pickup still needs booking.
    let reverse: { booked: boolean; awb?: string | null; error?: string } | null = null;
    const record = rows[0] as Record<string, any>;

    if (status === "approved" && record.order_id) {
      try {
        const { getAdminOrder } = await import("@/lib/admin");
        const { bookReversePickup } = await import("@/lib/shipping/reverse");
        const { order } = await getAdminOrder(String(record.order_id));
        const anyOrder = order as unknown as Record<string, any>;
        const address = anyOrder.shipping_address ?? {};
        const firstItem = (anyOrder.items ?? [])[0] ?? {};

        const result = await bookReversePickup({
          orderId: String(record.order_id),
          displayId: anyOrder.display_id ?? null,
          customer: {
            name:
              [address.first_name, address.last_name].filter(Boolean).join(" ") ||
              "Customer",
            email: String(anyOrder.email ?? record.customer_email ?? ""),
            phone: String(address.phone ?? ""),
          },
          address: {
            line1: String(address.address_1 ?? ""),
            line2: String(address.address_2 ?? ""),
            city: String(address.city ?? ""),
            state: String(address.province ?? ""),
            pincode: String(address.postal_code ?? ""),
            country: "India",
          },
          item: {
            name: String(firstItem.title ?? firstItem.product_title ?? "Returned work"),
            sku: String(firstItem.variant_sku ?? firstItem.variant?.sku ?? "RETURN"),
            units: Number(firstItem.quantity ?? 1),
          },
          reason: record.reason ?? null,
        });

        reverse = { booked: result.ok, awb: result.awb ?? null, error: result.error };
      } catch (error) {
        reverse = {
          booked: false,
          error: `The return is approved, but the pickup could not be booked: ${(error as Error).message.slice(0, 120)}`,
        };
      }
    }

    return NextResponse.json({ return: rows[0], reverse });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const { id } = await params;

    const rows = await query(
      `DELETE FROM return_requests WHERE id = $1 RETURNING *`,
      [id]
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: "Return request not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
