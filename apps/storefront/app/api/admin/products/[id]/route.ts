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
    images,
      artist,
      stock_type,
      description,
      specs,
      measured,
    } = body;
    const validStatuses = ["draft", "published", "proposed", "rejected"];
    const amountOverride = Number(total) || 0;

    const update: Record<string, unknown> = {};
    if (title !== undefined) update.title = title;
    if (slug !== undefined) update.handle = slug;
    if (validStatuses.includes(status)) update.status = status;

    // Same rule as create: publishing needs a size. Checked against the incoming
    // specs when they are sent, and against the stored tags when they are not —
    // otherwise a PATCH that only flips the status would slip past the guard.
    if (update.status === "published") {
      const incoming = specs && typeof specs === "object" ? String(specs.dimensions || "").trim() : "";
      let size = incoming;
      if (!size) {
        const { product: current } = await getAdminProduct(id);
        size = ((current as any)?.tags ?? [])
          .map((t: any) => (typeof t === "string" ? t : t?.value) ?? "")
          .find((value: string) => value.startsWith("dimensions:"))
          ?.slice("dimensions:".length) ?? "";
      }
      if (!size) {
        return NextResponse.json(
          { error: "A published work needs its dimensions. Save it as a draft until they are measured." },
          { status: 400 }
        );
      }
    }
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
    // Photographs on an existing product. The list is authoritative: the first
    // entry is the card image. `image` remains accepted for callers that send a
    // single URL, and `images: []` is a deliberate clear, not a no-op.
    const gallery = Array.isArray(images)
      ? images.map((url: unknown) => String(url ?? "").trim()).filter(Boolean)
      : null;
    if (gallery) {
      update.thumbnail = gallery[0] ?? "";
      update.images = gallery.map((url) => ({ url }));
    } else if (typeof image === "string") {
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

    // Prices. Two shapes arrive here:
    //
    //  - `variants: [{ id, amount }]` from the edit form, one row per size;
    //  - `total` from anything older, applied only when there is a single variant.
    //
    // Medusa treats the variants array as the product's complete variant set: any
    // variant it lists without being named and priced in the update is deleted.
    // Sending only the rows that changed therefore removed the other sizes — the
    // probe that found this left one variant where two had been. So the update
    // always carries every variant, each with its current price unless the form
    // supplied a new one.
    const { product: existing } = await getAdminProduct(id);
    const existingVariants = ((existing as any).variants ?? []) as Array<{
      id: string;
      title?: string;
      prices?: Array<{ amount?: number | string | null; currency_code?: string | null }>;
      calculated_price?: { calculated_amount?: number | null } | null;
    }>;

    const currentAmount = (variant: (typeof existingVariants)[number]): number => {
      const calculated = variant.calculated_price?.calculated_amount;
      if (typeof calculated === "number") return calculated;
      const stored = variant.prices?.[0]?.amount;
      const num = Number(stored ?? 0);
      return Number.isFinite(num) ? Math.trunc(num) : 0;
    };

    const incoming = Array.isArray(body?.variants) ? body.variants : null;
    const wanted = new Map<string, number>();
    for (const row of incoming ?? []) {
      const variantId = String((row as any)?.id ?? "").trim();
      const rowAmount = Math.trunc(Number((row as any)?.amount ?? 0));
      if (variantId && rowAmount > 0) wanted.set(variantId, rowAmount);
    }

    if (existingVariants.length > 1) {
      // Every variant, priced: changed where asked, otherwise unchanged.
      update.variants = existingVariants
        .filter((variant) => variant?.id)
        .map((variant) => ({
          id: variant.id,
          prices: [
            {
              amount: wanted.get(variant.id) ?? currentAmount(variant),
              currency_code:
                variant.prices?.[0]?.currency_code || currency_code || "inr",
            },
          ],
        }))
        .filter((variant) => (variant.prices[0]?.amount ?? 0) > 0);
    } else if (existingVariants.length === 1 && existingVariants[0]?.id) {
      const only = existingVariants[0];
      const amount = wanted.get(only.id) ?? (amountOverride > 0 ? amountOverride : 0);
      if (amount > 0) {
        update.variants = [
          {
            id: only.id,
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
