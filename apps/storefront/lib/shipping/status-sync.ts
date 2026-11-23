/**
 * Shiprocket webhook → local shipment status sync (SHIP-01).
 *
 * Shiprocket signs callbacks with a shared token header rather than a body HMAC,
 * so the token is the whole control. It is compared in constant time and the
 * endpoint refuses to run when the token is not configured.
 *
 * The status mapping is pure and tested. A live delivery-status sync needs the
 * owner's Shiprocket webhook token and a real callback — until then this is
 * correct by unit test only, and the admin can still update shipments manually.
 */

export const LOCAL_STATUSES = [
  "created",
  "processing",
  "shipped",
  "in_transit",
  "out_for_delivery",
  "delivered",
  "cancelled",
  "failed",
  "returned",
] as const;

export type LocalShipmentStatus = (typeof LOCAL_STATUSES)[number];

/** Shiprocket's human status strings, mapped to the shop's lifecycle states. */
const STATUS_MAP: Record<string, LocalShipmentStatus> = {
  created: "created",
  new: "created",
  pending: "processing",
  processing: "processing",
  "ready for pickup": "processing",
  pickedup: "shipped",
  "picked up": "shipped",
  picked_up: "shipped",
  shipped: "shipped",
  intransit: "in_transit",
  "in transit": "in_transit",
  in_transit: "in_transit",
  "out for delivery": "out_for_delivery",
  outfordelivery: "out_for_delivery",
  out_for_delivery: "out_for_delivery",
  delivered: "delivered",
  delivered_to_consumer: "delivered",
  cancelled: "cancelled",
  canceled: "cancelled",
  failed: "failed",
  undelivered: "failed",
  returned: "returned",
  rto: "returned",
};

export function mapShiprocketStatus(raw: unknown): LocalShipmentStatus | null {
  if (typeof raw !== "string") return null;
  const key = raw.trim().toLowerCase().replace(/[\s-]+/g, " ");
  return STATUS_MAP[key] ?? STATUS_MAP[key.replace(/ /g, "_")] ?? null;
}

/** Constant-time compare for the shared token. */
export function webhookTokenMatches(candidate: string | undefined | null, expected: string | undefined | null): boolean {
  const a = (candidate ?? "").trim();
  const b = (expected ?? "").trim();
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export interface ShipmentUpdate {
  orderId: string | null;
  awb: string | null;
  courier: string | null;
  status: LocalShipmentStatus | null;
}

/** Extract the useful fields from Shiprocket's varying callback shapes. */
export function extractShipmentUpdate(payload: unknown): ShipmentUpdate {
  const p = (payload && typeof payload === "object" ? payload : {}) as Record<string, any>;
  const body = (p.payload && typeof p.payload === "object" ? p.payload : p) as Record<string, any>;
  const str = (v: unknown) => (typeof v === "string" || typeof v === "number" ? String(v).trim() || null : null);

  const rawStatus = body.current_status ?? body.status ?? body.shipment_status ?? body.currentStatus;
  return {
    orderId: str(body.order_id ?? body.orderId ?? p.order_id),
    awb: str(body.awb_code ?? body.awb ?? body.tracking_number ?? p.awb_code),
    courier: str(body.courier_name ?? body.courier ?? p.courier_name),
    status: mapShiprocketStatus(rawStatus),
  };
}
