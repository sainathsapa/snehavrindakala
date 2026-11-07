/**
 * PATCH /api/admin/products/[id] - Update a product
 * DELETE /api/admin/products/[id] - Delete a product
 */

import { NextResponse } from "next/server";
import { requireAdmin } from "@/app/admin/actions";
import { getSystemAdminToken, getAdminProduct } from "@/lib/admin";

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
    const { product } = await getAdminProduct(id);
    const anyProduct = product as any;
    const variant = anyProduct.variants?.[0];
    const price = variant?.prices?.[0]?.amount ?? anyProduct.total ?? 0;
    const currency =
      variant?.prices?.[0]?.currency_code || anyProduct.currency_code || "inr";
    return NextResponse.json({
      ...anyProduct,
      slug: anyProduct.handle || anyProduct.slug || "",
      total: price,
      currency_code: currency,
      category: anyProduct.category
        ? { id: anyProduct.category.id, name: anyProduct.category.name }
        : null,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

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
    const { title, slug, status, total, currency_code, category_id } = body;
    const validStatuses = ["draft", "published", "proposed", "rejected"];
    const amount = Number(total) || 0;

    const update: Record<string, unknown> = {};
    if (title !== undefined) update.title = title;
    if (slug !== undefined) update.handle = slug;
    if (validStatuses.includes(status)) update.status = status;
    if (category_id !== undefined) update.category_id = [category_id];

    if (amount > 0) {
      const { product } = await getAdminProduct(id);
      const variant = (product as any).variants?.[0];
      if (variant?.id) {
        update.variants = [
          {
            id: variant.id,
            prices: [{ amount, currency_code: currency_code || "inr" }],
          },
        ];
      }
    }

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
      `/admin/products/${id}`,
      {
        method: "POST",
        body: JSON.stringify(update),
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

export async function DELETE(
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

    const res = await adminFetch(
      BACKEND_URL,
      PUBLISHABLE_KEY,
      `/admin/products/${id}`,
      { method: "DELETE" }
    );

    if (!res.ok) {
      const error = await res.text();
      return NextResponse.json({ error: error }, { status: res.status });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
