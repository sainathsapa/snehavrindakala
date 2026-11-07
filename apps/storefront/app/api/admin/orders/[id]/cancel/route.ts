/**
 * POST /api/admin/orders/[id]/cancel - Cancel an order
 */

import { NextResponse } from "next/server";
import { requireAdmin } from "@/app/admin/actions";
import { getSystemAdminToken } from "@/lib/admin";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await requireAdmin())) {
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

    return NextResponse.json(text ? JSON.parse(text) : {});
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
