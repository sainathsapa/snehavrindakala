import { query } from "@/lib/db";

/**
 * Persistence for Shiprocket shipments.
 *
 * Medusa does not know about Shiprocket, so shipment ids, AWB numbers, and
 * tracking links are stored alongside the order id in Postgres.
 */

export interface OrderShipment {
  id: string;
  order_id: string;
  shiprocket_order_id: string | null;
  shipment_id: string | null;
  awb_code: string | null;
  courier_name: string | null;
  courier_service: string | null;
  tracking_url: string | null;
  label_url: string | null;
  pickup_location: string | null;
  status: string;
  raw: any;
  created_at: string;
  updated_at: string;
}


async function ensureTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS order_shipments (
      id TEXT PRIMARY KEY,
      order_id TEXT UNIQUE NOT NULL,
      shiprocket_order_id TEXT,
      shipment_id TEXT,
      awb_code TEXT,
      courier_name TEXT,
      courier_service TEXT,
      tracking_url TEXT,
      label_url TEXT,
      pickup_location TEXT,
      status TEXT NOT NULL DEFAULT 'created',
      raw JSONB,
      created_at TIMESTAMP NOT NULL DEFAULT now(),
      updated_at TIMESTAMP NOT NULL DEFAULT now()
    )
  `);
  // The track page looks shipments up by AWB, which is a guest-facing query on a
  // table that grows with every order, so it needs an index.
  //
  // Plain, not partial. A partial index on `awb_code <> ''` was tried first and
  // the planner ignored it: a partial index can only serve a query that repeats
  // its predicate, so the lookup fell back to a sequential scan while looking
  // indexed. The index is verified in the plan, not assumed from its existence.
  await query(`
    CREATE INDEX IF NOT EXISTS order_shipments_awb_code_idx
      ON order_shipments (upper(awb_code))
  `);
}

export async function saveOrderShipment(
  orderId: string,
  shipment: {
    shiprocket_order_id?: string | null;
    shipment_id?: string | number | null;
    awb_code?: string | null;
    courier_name?: string | null;
    courier_service?: string | null;
    tracking_url?: string | null;
    label_url?: string | null;
    pickup_location?: string | null;
    status?: string;
    raw?: any;
  }
): Promise<OrderShipment> {
  await ensureTable();
  const rows = await query(
    `INSERT INTO order_shipments
       (id, order_id, shiprocket_order_id, shipment_id, awb_code, courier_name,
        courier_service, tracking_url, label_url, pickup_location, status, raw,
        created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, now(), now())
     ON CONFLICT (order_id) DO UPDATE SET
       shiprocket_order_id = EXCLUDED.shiprocket_order_id,
       shipment_id = EXCLUDED.shipment_id,
       awb_code = EXCLUDED.awb_code,
       courier_name = EXCLUDED.courier_name,
       courier_service = EXCLUDED.courier_service,
       tracking_url = EXCLUDED.tracking_url,
       label_url = EXCLUDED.label_url,
       pickup_location = EXCLUDED.pickup_location,
       status = EXCLUDED.status,
       raw = EXCLUDED.raw,
       updated_at = now()
     RETURNING *`,
    [
      `shp_${orderId}`,
      orderId,
      shipment.shiprocket_order_id ?? null,
      shipment.shipment_id != null ? String(shipment.shipment_id) : null,
      shipment.awb_code ?? null,
      shipment.courier_name ?? null,
      shipment.courier_service ?? null,
      shipment.tracking_url ?? null,
      shipment.label_url ?? null,
      shipment.pickup_location ?? null,
      shipment.status ?? "created",
      JSON.stringify(shipment.raw ?? shipment),
    ]
  );
  return rows[0];
}

export async function getOrderShipment(
  orderId: string
): Promise<OrderShipment | null> {
  await ensureTable();
  const rows = await query(
    "SELECT * FROM order_shipments WHERE order_id = $1 LIMIT 1",
    [orderId]
  );
  return rows[0] ?? null;
}

/**
 * Find a shipment by the number the courier printed on the label.
 *
 * Buyers paste the AWB ("tracking number") far more often than the order id —
 * it is the number on the slip that arrives in the parcel, and the only one
 * they can read off a courier's app. Without this the track page told them
 * their order did not exist while it was in transit.
 *
 * Matched case-insensitively because carriers print AWB codes in upper case
 * and people type them however they like. The index in ensureTable() is what
 * keeps this from scanning every shipment on a guest-facing lookup.
 */
export async function findShipmentByAwb(
  awb: string
): Promise<OrderShipment | null> {
  const code = awb.trim();
  if (!code) return null;
  await ensureTable();
  const rows = await query(
    "SELECT * FROM order_shipments WHERE upper(awb_code) = upper($1) LIMIT 1",
    [code]
  );
  return rows[0] ?? null;
}
