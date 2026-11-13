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
    const category =
      anyProduct.category ||
      (Array.isArray(anyProduct.categories) && anyProduct.categories.length > 0
        ? anyProduct.categories[0]
        : null);
    return NextResponse.json({
      ...anyProduct,
      slug: anyProduct.handle || anyProduct.slug || "",
      total: price,
      currency_code: currency,
      category: category
        ? {
            id: category.id,
            name: category.name,
            handle: category.handle,
          }
        : null,
      category_id: category?.id || "",
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
    const { title, slug, status, total, currency_code, category_id, image } =
      body;
    const validStatuses = ["draft", "published", "proposed", "rejected"];
    const amount = Number(total) || 0;

    const update: Record<string, unknown> = {};
    if (title !== undefined) update.title = title;
    if (slug !== undefined) update.handle = slug;
    if (validStatuses.includes(status)) update.status = status;
    // Image attach on an existing product. `thumbnail` drives the card and the
    // first entry of `images` drives the detail gallery, so both are set from
    // the one upload to keep them from drifting apart.
    if (typeof image === "string") {
      update.thumbnail = image.trim();
      update.images = image.trim() ? [{ url: image.trim() }] : [];
    }
    if (category_id !== undefined) {
      // Medusa v2 uses `categories` for product↔category links. An empty
      // value clears the link instead of sending an invalid category id.
      const ids = (Array.isArray(category_id) ? category_id : [category_id])
        .map((value: any) =>
          typeof value === "string" ? value : value?.id
        )
        .filter(Boolean);
      update.categories = ids.map((id: string) => ({ id }));
    }

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
