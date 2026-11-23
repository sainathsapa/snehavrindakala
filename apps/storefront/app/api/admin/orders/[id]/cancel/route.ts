/**
 * POST /api/admin/orders/[id]/cancel - Cancel an order
 */

import { NextResponse } from "next/server";
import { getAdminIdentity, requireAdmin, requirePermission } from "@/app/admin/actions";
import { getSystemAdminToken } from "@/lib/admin";
import { restoreSoldForOrder } from "@/lib/inventory";
import { recordAdminAction } from "@/lib/audit";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await requirePermission("orders:write"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const { id } = await params;
    const BACKEND_URL =
      process.env.MEDUSA_BACKEND_URL ||
      process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ||
      "http://localhost:9000";
    const PUBLISHABLE_KEY =
      process.env.MEDUSA_PUBLISHABLE_KEY ||
      process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY ||
      "";

    const token = await getSystemAdminToken();
    const headers = new Headers();
    headers.set("x-publishable-api-key", PUBLISHABLE_KEY);
    headers.set("Content-Type", "application/json");
    if (token) headers.set("Authorization", `Bearer ${token}`);

    const res = await fetch(`${BACKEND_URL}/admin/orders/${id}/cancel`, {
      method: "POST",
      headers,
      body: JSON.stringify({}),
    });

    const text = await res.text();
    if (!res.ok) {
      return NextResponse.json(
        { error: text || "Failed to cancel order" },
        { status: res.status }
      );
    }

    // Put a tracked work back into stock when its order is cancelled.
    await restoreSoldForOrder(id).catch((err) =>
      console.error("Could not restore stock for cancelled order", id, err)
    );
    const actor = await getAdminIdentity();
    if (actor) {
      await recordAdminAction({
        actorEmail: actor.email,
        actorRole: actor.role,
        action: "order.cancel",
        entityType: "order",
        entityId: id,
      });
    }

    return NextResponse.json(text ? JSON.parse(text) : {});
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
