/**
 * POST/GET /api/admin/products/[id]/shipping-data
 *
 * Records the MEASURED weight and package dimensions a shipment is priced from.
 *
 * WHY THIS IS ADMIN-ONLY AND EXPLICIT
 *
 * Shiprocket rates, and any damage/lost-parcel claim, depend on this data being
 * real. There is deliberately no default, no derivation from category, and no
 * "estimate" fallback: if a product has no row here, `createShipmentForOrder`
 * refuses to book and reports which products are missing. An admin records the
 * measurement after weighing the actual packed item.
 *
 * Requires `products:write`. The actor is taken from the admin session so the
 * measurement is attributable (`verified_by`/`verified_at`).
 */

import { NextResponse } from "next/server";
import { getAdminIdentity, requirePermission } from "@/app/admin/actions";
import { query as dbQuery } from "@/lib/db";

const positive = (value: unknown): number | null => {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await requirePermission("products:read"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const rows = await dbQuery<any>(
    "SELECT * FROM product_shipping_data WHERE product_id = $1 LIMIT 1",
    [id]
  );
  return NextResponse.json(
    { shippingData: rows[0] ?? null, complete: Boolean(rows[0]) },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await requirePermission("products:write"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const identity = await getAdminIdentity();
  if (!identity) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { weightGrams, weightKg, lengthCm, breadthCm, heightCm, source, notes } =
    body as Record<string, unknown>;

  // Accept kg for convenience but store integer grams, so nothing is lost to
  // floating point rounding on the way in.
  const grams =
    positive(weightGrams) ??
    (positive(weightKg) != null ? Math.round(positive(weightKg)! * 1000) : null);
  const length = positive(lengthCm);
  const breadth = positive(breadthCm);
  const height = positive(heightCm);

  const missing: string[] = [];
  if (!grams) missing.push("weightGrams (or weightKg)");
  if (!length) missing.push("lengthCm");
  if (!breadth) missing.push("breadthCm");
  if (!height) missing.push("heightCm");
  if (missing.length) {
    return NextResponse.json(
      {
        error: `Measured physical data is required: ${missing.join(", ")}. Values must be positive numbers — there is no default.`,
      },
      { status: 400 }
    );
  }

  const sourceValue =
    source === "import" || source === "measured" || source === "owner"
      ? source
      : "measured";

  try {
    const rows = await dbQuery<any>(
      `INSERT INTO product_shipping_data
         (product_id, weight_grams, length_cm, breadth_cm, height_cm, source, verified_by, verified_at, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7, now(), $8)
       ON CONFLICT (product_id) DO UPDATE SET
         weight_grams = EXCLUDED.weight_grams,
         length_cm    = EXCLUDED.length_cm,
         breadth_cm   = EXCLUDED.breadth_cm,
         height_cm    = EXCLUDED.height_cm,
         source       = EXCLUDED.source,
         verified_by  = EXCLUDED.verified_by,
         verified_at  = now(),
         notes        = EXCLUDED.notes,
         updated_at   = now()
       RETURNING *`,
      [
        id,
        Math.round(grams!),
        length,
        breadth,
        height,
        sourceValue,
        identity.email,
        typeof notes === "string" ? notes.slice(0, 1000) : null,
      ]
    );
    return NextResponse.json(
      { shippingData: rows[0] },
      { status: 201, headers: { "Cache-Control": "no-store" } }
    );
  } catch (err: any) {
    console.error("Failed to record product shipping data", err);
    return NextResponse.json(
      { error: "Failed to record shipping data." },
      { status: 500 }
    );
  }
}
