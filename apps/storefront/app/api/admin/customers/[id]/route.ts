/**
 * GET /api/admin/customers/[id] - Get single customer
 * POST /api/admin/customers/[id] - Update customer
 * DELETE /api/admin/customers/[id] - Delete customer
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

function backendConfig() {
  return {
    BACKEND_URL:
      process.env.MEDUSA_BACKEND_URL ||
      process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ||
      "http://localhost:9000",
    PUBLISHABLE_KEY:
      process.env.MEDUSA_PUBLISHABLE_KEY ||
      process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY ||
      "",
  };
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
    const { BACKEND_URL, PUBLISHABLE_KEY } = backendConfig();

    const res = await adminFetch(
      BACKEND_URL,
      PUBLISHABLE_KEY,
      `/admin/customers/${id}`
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
    const { email, first_name, last_name, phone, company_name, metadata } =
      body || {};

    const updates: Record<string, any> = {};
    if (email !== undefined) updates.email = email;
    if (first_name !== undefined) updates.first_name = first_name;
    if (last_name !== undefined) updates.last_name = last_name;
    if (phone !== undefined) updates.phone = phone;
    if (company_name !== undefined) updates.company_name = company_name;
    if (metadata !== undefined) updates.metadata = metadata;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const { BACKEND_URL, PUBLISHABLE_KEY } = backendConfig();
    const res = await adminFetch(
      BACKEND_URL,
      PUBLISHABLE_KEY,
      `/admin/customers/${id}`,
      { method: "POST", body: JSON.stringify(updates) }
    );

    const text = await res.text();
    if (!res.ok) {
      return NextResponse.json(
        { error: text || "Failed to update customer" },
        { status: res.status }
      );
    }

    return NextResponse.json(text ? JSON.parse(text) : {});
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
    const { BACKEND_URL, PUBLISHABLE_KEY } = backendConfig();

    const res = await adminFetch(
      BACKEND_URL,
      PUBLISHABLE_KEY,
      `/admin/customers/${id}`,
      { method: "DELETE" }
    );

    const text = await res.text();
    if (!res.ok) {
      return NextResponse.json(
        { error: text || "Failed to delete customer" },
        { status: res.status }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
