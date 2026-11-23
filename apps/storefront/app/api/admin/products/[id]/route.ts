/**
 * PATCH /api/admin/products/[id] - Update a product
 * DELETE /api/admin/products/[id] - Delete a product
 */

import { NextResponse } from "next/server";
import { requireAdmin, requirePermission } from "@/app/admin/actions";
import {
  getSystemAdminToken,
  getAdminProduct,
  resolveProductTagIds,
} from "@/lib/admin";
import { mergeTags, specsFromTags, tagValue } from "@/lib/admin-tags";

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
  if (!(await requirePermission("products:read"))) {
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
      // Prefill the specification fields. Without this the form would show empty
      // boxes over real values and the next save would erase them.
      specs: specsFromTags(anyProduct.tags ?? []),
      // Whether the studio has measured this work: drives the certificate gate.
      measured: tagValue(anyProduct.tags ?? [], "measured") === "yes",
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await requirePermission("products:write"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const { id } = await params;
    const body = await req.json();
    const {
      title,
      slug,
      status,
      total,
      currency_code,
      category_id,
      image,
      artist,
      stock_type,
      description,
      specs,
      measured,
    } = body;
    const validStatuses = ["draft", "published", "proposed", "rejected"];
    const amount = Number(total) || 0;

    const update: Record<string, unknown> = {};
    if (title !== undefined) update.title = title;
    if (slug !== undefined) update.handle = slug;
    if (validStatuses.includes(status)) update.status = status;
    if (typeof description === "string") update.description = description;

    // Tags carry the maker, availability and the artwork's specifications: the
    // store API exposes tags but not metadata, so writing metadata alone would
    // never reach the storefront.
    //
    // The merge rule lives in lib/admin-tags.ts so it can be tested directly:
    // a request replaces only the keys it submits, and an emptied field drops
    // its tag rather than storing a blank one.
    if (
      artist !== undefined ||
      stock_type !== undefined ||
      specs ||
      measured !== undefined
    ) {
      const { product: current } = await getAdminProduct(id);
      const currentValues: string[] = (((current as any)?.tags ?? []) as any[])
        .map((t) => (typeof t === "string" ? t : t?.value) ?? "")
        .filter(Boolean);

      update.tags = await resolveProductTagIds(
        mergeTags(currentValues, { artist, stock_type, specs, measured: measured === true })
      );
    }
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
  if (!(await requirePermission("products:delete"))) {
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
