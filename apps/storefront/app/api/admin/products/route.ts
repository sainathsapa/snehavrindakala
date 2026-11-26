/**
 * POST /api/admin/products - Create a product
 */

import { NextResponse } from "next/server";
import { requireAdmin, requirePermission } from "@/app/admin/actions";
import { getSystemAdminToken, listAdminProducts, resolveProductTagIds } from "@/lib/admin";
import { mergeTags } from "@/lib/admin-tags";
import { soldHandles } from "@/lib/sold-works";
import { isStandInImage } from "@/lib/product-media";

async function adminAuthHeader(): Promise<Record<string, string>> {
  const token = await getSystemAdminToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function GET(req: Request) {
  if (!(await requirePermission("products:read"))) {
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

    // Which of these have already been paid for. Derived from the same order
    // line items the storefront uses, so the studio sees what the shop sees —
    // otherwise the list quietly offers an add button for a work that is gone.
    let sold: Set<string> = new Set();
    try {
      sold = await soldHandles();
    } catch (error) {
      console.error("[admin/products] could not read sold works", error);
    }

    const products = (data.products ?? []).map((product: any) => {
      // `measured:yes` is written by the studio after putting a tape on the
      // work; only then may its size be certified. The list shows which works
      // still need that five minutes, because otherwise nobody ever does it.
      const tags: any[] = product?.tags ?? [];
      const measured = tags.some((tag) => {
        const value = typeof tag === "string" ? tag : tag?.value;
        return value === "measured:yes";
      });
      const hasDimensions = tags.some((tag) => {
        const value = typeof tag === "string" ? tag : tag?.value;
        return typeof value === "string" && value.startsWith("dimensions:") && value.length > "dimensions:".length;
      });
      return {
        ...product,
        sold: sold.has(product?.handle ?? ""),
        measured,
        // Only a work that states a size can be waiting to have it confirmed.
        needsMeasuring: hasDimensions && !measured,
        // Published with no size at all. These predate the rule that refuses to
        // publish without dimensions, so they are live and unmeasurable to a
        // buyer — the one class of product that is both on sale and incomplete.
        missingDimensions: product?.status === "published" && !hasDimensions,
        // A generated image in place of a photograph. The product page says so;
        // the studio needs to see which ones are still outstanding.
        standInPhoto: isStandInImage(product?.thumbnail),
      };
    });

    return NextResponse.json({ ...data, products });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  if (!(await requirePermission("products:write"))) {
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
    images,
      artist,
      stock_type,
      description,
      specs,
      measured,
    } = body;
    const validStatuses = ["draft", "published", "proposed", "rejected"];
    const productStatus = validStatuses.includes(status) ? status : "draft";
    const amount = Number(total) || 0;

    // Enforced here as well as in the form. The form guard is a courtesy; this
    // is the rule. A published work without a size is a work a buyer cannot
    // judge, and the product page has nowhere to say "unknown" that reads as
    // anything but an omission.
    if (productStatus === "published") {
      const size = specs && typeof specs === "object" ? String(specs.dimensions || "").trim() : "";
      if (!size) {
        return NextResponse.json(
          { error: "A published work needs its dimensions. Save it as a draft until they are measured." },
          { status: 400 }
        );
      }
    }

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
    // The artwork's specifications, entered on the create form. Same merge rule
    // as the edit route, so a new work can be created complete rather than
    // needing a second pass.
    if (specs && typeof specs === "object") {
      tagValues.push(
        ...mergeTags([], { specs: specs as Record<string, string> })
      );
    }
    // Somebody measured it, or nobody did. A certificate may only carry a size
    // the studio confirmed with a tape, so the flag is written with the product.
    if (measured === true) {
      tagValues.push("measured:yes");
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

    // Photographs. Medusa keeps `thumbnail` for the card and `images` for the
    // gallery; a work is usually several photographs — front, detail, the back
    // with the signature — so the whole list is stored and the first one is the
    // card. `image` is still accepted for older callers that send one.
    const gallery = Array.isArray(images)
      ? images.map((url: unknown) => String(url ?? "").trim()).filter(Boolean)
      : [];
    const single = typeof image === "string" ? image.trim() : "";
    const all = gallery.length ? gallery : single ? [single] : [];
    if (all.length) {
      payload.thumbnail = all[0];
      payload.images = all.map((url) => ({ url }));
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
