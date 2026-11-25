/**
 * Verified physical data (weight + package dimensions) per product.
 *
 * WHY
 *
 * `createShipmentForOrder` used to size every parcel the same way:
 *
 *   weight = Math.max(totalItems * 0.5, 0.5)   // 0.5 kg per item
 *   length = 10, breadth = 10, height = 5      // cm
 *
 * Those are guesses, and they were sent to Shiprocket as facts. A guessed weight
 * produces a wrong courier rate (the shop under- or over-pays), and a guessed
 * dimension cannot be reconciled with the parcel actually handed to the courier,
 * so a damage or lost-parcel claim has no evidence behind it.
 *
 * `lib/shipping/verify.ts` already refuses to build a shipment without real
 * physical data, but the production path never called it. This module supplies
 * the real data and closes that gap: if a product has no verified measurement,
 * the shipment is refused and the reason is recorded. Nothing is invented.
 *
 * MEASUREMENTS COME FROM THE OWNER
 *
 * `product_shipping_data` is written by an admin through an authenticated route
 * (see app/api/admin/products/[id]/shipping-data/route.ts). Until a row exists,
 * the product simply cannot be shipped — which is the honest state.
 */

import { query as dbQuery } from "@/lib/db";

export interface ProductPhysicalData {
  product_id: string;
  weight_grams: number;
  length_cm: number | string;
  breadth_cm: number | string;
  height_cm: number | string;
  source: "owner" | "import" | "measured";
  verified_by: string;
  verified_at: string;
}

export interface PackageDimensions {
  length: number;
  breadth: number;
  height: number;
}

export type PhysicalResolution =
  | {
      ok: true;
      weightKg: number;
      dimensionsCm: PackageDimensions;
      /** Products that contributed a measurement, for the audit trail. */
      measuredProductIds: string[];
    }
  | {
      ok: false;
      reason: "missing_product_data";
      /** Product ids with no verified measurement. Owner input is required. */
      missingProductIds: string[];
    };

/** Raised when a shipment cannot be priced without inventing physical data. */
export class MissingPhysicalDataError extends Error {
  readonly missingProductIds: string[];
  constructor(missingProductIds: string[]) {
    super(
      missingProductIds.length
        ? `Shipment cannot be created: no verified weight and dimensions for product(s) ${missingProductIds.join(", ")}. ` +
            `Record the measured weight and package dimensions for each product before shipping.`
        : "Shipment cannot be created: the order has no shippable items with verified physical data."
    );
    this.name = "MissingPhysicalDataError";
    this.missingProductIds = missingProductIds;
  }
}

const toNumber = (value: unknown): number | null => {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
};

const toGrams = (row: ProductPhysicalData): number | null => {
  const n = toNumber((row as any).weight_grams);
  return n && n > 0 ? n : null;
};

const toDim = (value: unknown): number | null => {
  const n = toNumber(value);
  return n && n > 0 ? n : null;
};

export interface OrderLine {
  /** Medusa product id — the stable id shared with partner_product. */
  productId: string | null;
  quantity: number;
}

/**
 * Combine per-product measurements into one parcel.
 *
 * Rules, deliberately conservative and documented because they affect money:
 *   • weight is summed (grams × quantity) — under-declaring weight risks the
 *     courier charging the shop on delivery;
 *   • each dimension is the MAXIMUM across items. This assumes the items ship in
 *     one box rather than side by side, which under-estimates the footprint for
 *     wide items. Per-order packaging overrides are an owner decision and are
 *     not guessed here.
 */
export function resolvePackagePhysicalData(
  lines: OrderLine[],
  rows: Map<string, ProductPhysicalData>
): PhysicalResolution {
  const missing = new Set<string>();
  let weightGrams = 0;
  const dims: PackageDimensions = { length: 0, breadth: 0, height: 0 };
  const measured = new Set<string>();

  const shippable = lines.filter((l) => {
    const qty = Number(l.quantity);
    return l.productId && Number.isFinite(qty) && qty > 0;
  });

  for (const line of shippable) {
    const productId = line.productId as string;
    const row = rows.get(productId);
    if (!row) {
      missing.add(productId);
      continue;
    }
    const grams = toGrams(row);
    const length = toDim(row.length_cm);
    const breadth = toDim(row.breadth_cm);
    const height = toDim(row.height_cm);
    if (!grams || !length || !breadth || !height) {
      missing.add(productId);
      continue;
    }
    const qty = Number(line.quantity);
    weightGrams += grams * qty;
    dims.length = Math.max(dims.length, length);
    dims.breadth = Math.max(dims.breadth, breadth);
    dims.height = Math.max(dims.height, height);
    measured.add(productId);
  }

  if (missing.size > 0) {
    return {
      ok: false,
      reason: "missing_product_data",
      missingProductIds: [...missing].sort(),
    };
  }
  if (weightGrams <= 0) {
    return {
      ok: false,
      reason: "missing_product_data",
      missingProductIds: [...measured].sort(),
    };
  }

  // Shiprocket expects kg with at most 3 decimals; round UP so we never
  // under-declare by rounding.
  const weightKg = Math.ceil(weightGrams / 10) / 100;

  return {
    ok: true,
    weightKg,
    dimensionsCm: {
      length: Math.ceil(dims.length),
      breadth: Math.ceil(dims.breadth),
      height: Math.ceil(dims.height),
    },
    measuredProductIds: [...measured].sort(),
  };
}

export type Executor = (sql: string, params?: any[]) => Promise<any[]>;

/** Verified measurements for the given product ids (missing ids simply absent). */
export async function loadProductPhysicalData(
  productIds: string[],
  exec: Executor = dbQuery as unknown as Executor
): Promise<Map<string, ProductPhysicalData>> {
  const ids = [...new Set(productIds.filter((id): id is string => Boolean(id)))];
  const out = new Map<string, ProductPhysicalData>();
  // Chunked so a large order cannot build an unbounded parameter list.
  const CHUNK = 500;
  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK);
    const rows = await exec(
      `SELECT product_id, weight_grams, length_cm, breadth_cm, height_cm,
              source, verified_by, verified_at
         FROM product_shipping_data
        WHERE product_id = ANY($1::text[])`,
      [chunk]
    );
    for (const row of rows ?? []) {
      out.set((row as ProductPhysicalData).product_id, row as ProductPhysicalData);
    }
  }
  return out;
}
