/**
 * GET /api/admin/orders - List orders with pagination
 */

import { NextResponse } from "next/server";
import { requireAdmin } from "@/app/admin/actions";
import { getSystemAdminToken } from "@/lib/admin";

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

export async function GET(req: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const { searchParams } = new URL(req.url);
    const limit = searchParams.get("limit") || "20";
    const offset = searchParams.get("offset") || "0";
    const status = searchParams.get("status") || "";
    const q = searchParams.get("q") || "";

    const BACKEND_URL =
      process.env.MEDUSA_BACKEND_URL ||
      process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ||
      "http://localhost:9000";
    const PUBLISHABLE_KEY =
      process.env.MEDUSA_PUBLISHABLE_KEY ||
      process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY ||
      "";

    const fields =
      "id,display_id,status,total,currency_code,created_at,*customer,*shipping_address";

    // Most support starts with a phone number: "my order, 98…". Medusa's free-text
    // search covers email and order number but not the address, so a digits-only
    // query is answered by reading recent orders and matching the phone here.
    // A studio sells a few works a week; a hundred recent orders is a phone book,
    // and unlike a schema-level guess it cannot silently miss.
    if (/[0-9]{6,}/.test(q) && /^[\d\s+()\-]+$/.test(q.trim())) {
      const digitsWanted = q.replace(/\D/g, "").slice(-10);
      const url = `/admin/orders?limit=100&fields=${encodeURIComponent(fields)}`;
      const res = await adminFetch(BACKEND_URL, PUBLISHABLE_KEY, url);
      if (!res.ok) {
        return NextResponse.json({ error: await res.text() }, { status: res.status });
      }
      const data = await res.json();
      const all: any[] = data.orders ?? [];
      const matches = all.filter((order) => {
        const phone = String(order.shipping_address?.phone || order.customer?.phone || "")
          .replace(/\D/g, "")
          .slice(-10);
        return phone.length >= 6 && phone.includes(digitsWanted);
      });
      return NextResponse.json({ orders: matches, count: matches.length });
    }

    let url = `/admin/orders?limit=${limit}&offset=${offset}&fields=${encodeURIComponent(
      fields
    )}`;
    if (status) url += `&status[]=${encodeURIComponent(status)}`;
    if (q) url += `&q=${encodeURIComponent(q)}`;

    const res = await adminFetch(BACKEND_URL, PUBLISHABLE_KEY, url);

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
