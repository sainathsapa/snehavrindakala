/**
 * GET /api/admin/orders/[id] - Get single order
 * POST /api/admin/orders/[id] - Update order
 */

import { NextResponse } from "next/server";
import { requireAdmin } from "@/app/admin/actions";
import { getSystemAdminToken } from "@/lib/admin";
import { getGiftForOrder } from "@/lib/gift";
import { orderRefIfAny } from "@/lib/order-ref";

async function adminFetch(
  backendUrl: string,
  publishableKey: string,
  path: string,
  options: RequestInit = {}
) {
  const token = await getSystemAdminToken();
  const headers = new Headers(options.headers);
  headers.set("x-publishable-api-key", publishableKey);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (options.body && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  return fetch(`${backendUrl}${path}`, { ...options, headers });
}

export async function GET(
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

    const fields =
      "id,display_id,status,email,currency_code,subtotal,tax_total,shipping_total,discount_total,total,created_at,*customer,*shipping_address,*billing_address,*items,*payment_collections,*fulfillments";
    const res = await adminFetch(
      BACKEND_URL,
      PUBLISHABLE_KEY,
      `/admin/orders/${id}?fields=${encodeURIComponent(fields)}`
    );

    if (!res.ok) {
      const error = await res.text();
      return NextResponse.json({ error: error }, { status: res.status });
    }

    const data = await res.json();
    const order = data.order ?? data;

    // The packing bench needs to know whether to wrap the work and what card to
    // put in the box. Non-fatal: a missing note must not stop the order page.
    let gift = null;
    try {
      gift = await getGiftForOrder(order?.id ?? id);
    } catch (err) {
      console.error("Could not read the gift note", err);
    }

    return NextResponse.json({ ...order, gift, trackRef: await orderRefIfAny(order?.id ?? id) });
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
    const body = await req.json();
    const BACKEND_URL =
      process.env.MEDUSA_BACKEND_URL ||
      process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ||
      "http://localhost:9000";
    const PUBLISHABLE_KEY =
      process.env.MEDUSA_PUBLISHABLE_KEY ||
      process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY ||
      "";

    const res = await adminFetch(
      BACKEND_URL,
      PUBLISHABLE_KEY,
      `/admin/orders/${id}`,
      {
        method: "POST",
        body: JSON.stringify(body),
      }
    );

    if (!res.ok) {
      const error = await res.text();
      return NextResponse.json({ error: error }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
