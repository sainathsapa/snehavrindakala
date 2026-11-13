/**
 * POST /api/admin/products - Create a product
 */

import { NextResponse } from "next/server";
import { requireAdmin } from "@/app/admin/actions";
import { getSystemAdminToken, listAdminProducts, resolveProductTagIds } from "@/lib/admin";

async function adminAuthHeader(): Promise<Record<string, string>> {
  const token = await getSystemAdminToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function GET(req: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const { searchParams } = new URL(req.url);
    const data = await listAdminProducts({
      limit: parseInt(searchParams.get("limit") || "20"),
      offset: parseInt(searchParams.get("offset") || "0"),
      q: searchParams.get("q") || undefined,
      // The category detail page sends `category_id`; accept both spellings.
      category:
        searchParams.get("category") ||
        searchParams.get("category_id") ||
        undefined,
      status: searchParams.get("status") || undefined,
    });
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
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
    } = body;
    const validStatuses = ["draft", "published", "proposed", "rejected"];
    const productStatus = validStatuses.includes(status) ? status : "draft";
    const amount = Number(total) || 0;

    const payload: Record<string, unknown> = {
      title,
      handle: slug || undefined,
      status: productStatus,
    };

    // The store API exposes tags but not metadata, so the maker and availability
    // are written as tags — that is the only way the storefront can read them.
    // Tags must exist as their own records first; Medusa rejects inline values.
    const tagValues: string[] = [];
    if (typeof artist === "string" && artist.trim()) {
      tagValues.push(`artist:${artist.trim()}`);
    }
    if (typeof stock_type === "string" && stock_type.trim()) {
      tagValues.push(`stock:${stock_type.trim()}`);
    }
    if (tagValues.length > 0) {
      payload.tags = await resolveProductTagIds(tagValues);
    }
    if (typeof description === "string" && description.trim()) {
      payload.description = description.trim();
    }
    if (category_id) {
      // Medusa v2 links products to categories through `categories`, not
      // `category_id` (which is only a list-filter query param).
      payload.categories = [{ id: category_id }];
    }

    // The product image. Medusa keeps `thumbnail` for the card and `images` for
    // the gallery; setting only one leaves either the listing or the detail
    // page blank. The URL is whatever the admin uploader returned.
    if (typeof image === "string" && image.trim()) {
      payload.thumbnail = image.trim();
      payload.images = [{ url: image.trim() }];
    }
    if (amount > 0) {
      payload.options = [{ title: "Default", values: ["Default"] }];
      payload.variants = [
        {
          title: "Default",
          sku: slug || undefined,
          options: { Default: "Default" },
          prices: [{ amount, currency_code: currency_code || "inr" }],
        },
      ];
    }

    const BACKEND_URL =
      process.env.MEDUSA_BACKEND_URL ||
      process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ||
      "http://localhost:9000";
    const PUBLISHABLE_KEY =
      process.env.MEDUSA_PUBLISHABLE_KEY ||
      process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY ||
      "";

    // Attach the default sales channel so the product is visible on the
    // storefront (Medusa only exposes products in a sales channel).
    try {
      const scRes = await fetch(`${BACKEND_URL}/admin/sales-channels?limit=1`, {
        headers: {
          "x-publishable-api-key": PUBLISHABLE_KEY,
          ...(await adminAuthHeader()),
        },
      });
      if (scRes.ok) {
        const scData = await scRes.json();
        const channelId = scData.sales_channels?.[0]?.id;
        if (channelId) payload.sales_channels = [{ id: channelId }];
      }
    } catch {
      // Product will still be created; it can be assigned to a channel later.
    }

    const res = await fetch(`${BACKEND_URL}/admin/products`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-publishable-api-key": PUBLISHABLE_KEY,
        ...(await adminAuthHeader()),
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const error = await res.text();
      return NextResponse.json({ error: error }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
