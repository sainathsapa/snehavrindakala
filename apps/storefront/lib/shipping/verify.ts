/**
 * Shipping / fulfilment verification adapter (A61 — FINAL GO).
 *
 * Pure, side-effect-free helpers that harden the Shiprocket webhook and
 * shipment-creation lifecycle. This module is an *adapter*: it deliberately
 * does not rewire or replace the existing, working webhook route
 * (`app/api/webhooks/shiprocket/route.ts`) or `lib/shipping/status-sync.ts`.
 * It provides a canonical, tested vocabulary and guards that a caller can
 * adopt incrementally.
 *
 * Everything here is deterministic and depends only on its arguments, so it
 * can be exhaustively unit-tested with fixtures — no live Shiprocket account,
 * webhook token, or database required.
 */

import { createHash, timingSafeEqual } from "node:crypto";

/* ─────────────────────────────────────────────────────────────────────────
 * 1. Webhook token verification
 * ───────────────────────────────────────────────────────────────────────── */

/**
 * Constant-time comparison of the configured webhook token against the token
 * supplied by the carrier.
 *
 * Fails closed: when `expected` is unset/blank, `false` is returned for every
 * `provided` value (an unconfigured endpoint must never authenticate anyone).
 * Both inputs are trimmed, then hashed to fixed-length SHA-256 digests so the
 * final `timingSafeEqual` never leaks token length or content via early exit.
 */
export function verifyWebhookToken(
  expected: string | null | undefined,
  provided: string | null | undefined
): boolean {
  if (typeof expected !== "string" || expected.trim() === "") return false;
  if (typeof provided !== "string" || provided.trim() === "") return false;

  const a = createHash("sha256").update(expected.trim()).digest();
  const b = createHash("sha256").update(provided.trim()).digest();
  return timingSafeEqual(a, b);
}

/* ─────────────────────────────────────────────────────────────────────────
 * 2. Provider status -> canonical local status
 * ───────────────────────────────────────────────────────────────────────── */

/** Canonical fulfilment vocabulary used by this adapter. */
export const LOCAL_SHIPMENT_STATUSES = [
  "created",
  "picked_up",
  "in_transit",
  "out_for_delivery",
  "delivered",
  "failed",
  "cancelled",
  "unknown",
] as const;

export type LocalShipmentStatus = (typeof LOCAL_SHIPMENT_STATUSES)[number];

/**
 * Every real status string Shiprocket is known to emit, mapped to the
 * canonical vocabulary. Unknown / unrecognised input maps to `"unknown"` —
 * never guessed. Deliberate choices where the canonical set has no exact
 * analogue: `pending`/`processing`/`ready for pickup` -> `created` (not yet
 * handed to the courier); `shipped` -> `picked_up`; `rto`/`returned` ->
 * `failed` (an undelivered consignment).
 */
const STATUS_MAP: Record<string, LocalShipmentStatus> = {
  created: "created",
  new: "created",
  pending: "created",
  processing: "created",
  "ready for pickup": "created",
  "picked up": "picked_up",
  pickedup: "picked_up",
  shipped: "picked_up",
  "in transit": "in_transit",
  intransit: "in_transit",
  "out for delivery": "out_for_delivery",
  outfordelivery: "out_for_delivery",
  delivered: "delivered",
  "delivered to consumer": "delivered",
  failed: "failed",
  undelivered: "failed",
  rto: "failed",
  returned: "failed",
  cancelled: "cancelled",
  canceled: "cancelled",
};

function normalizeStatus(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, " ")
    .trim();
}

/** Map a raw provider status to a canonical local status (unknown-safe). */
export function mapShiprocketStatus(raw: unknown): LocalShipmentStatus {
  if (typeof raw !== "string") return "unknown";
  return STATUS_MAP[normalizeStatus(raw)] ?? "unknown";
}

/* ─────────────────────────────────────────────────────────────────────────
 * 3. Out-of-order / delayed event guard
 * ───────────────────────────────────────────────────────────────────────── */

export interface EventMeta {
  /** Monotonic carrier event number, when provided. */
  sequence?: number | null;
  /** Event timestamp: ISO string, epoch millis, or Date. */
  timestamp?: string | number | Date | null;
}

function toEpoch(value: EventMeta["timestamp"]): number | null {
  if (value == null) return null;
  if (value instanceof Date) {
    const t = value.getTime();
    return Number.isFinite(t) ? t : null;
  }
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const t = Date.parse(value);
    return Number.isNaN(t) ? null : t;
  }
  return null;
}

/**
 * True when `incoming` is stale relative to `current` and should be ignored.
 *
 * Uses sequence numbers when both sides have them, otherwise timestamps.
 * Equal sequence/timestamp counts as delayed (a duplicate replay). When there
 * is not enough data to compare, returns false so a real event is not lost —
 * idempotency for replays is handled separately by `applyWebhookEvent`.
 */
export function isDelayedEvent(incoming: EventMeta, current: EventMeta): boolean {
  const inSeq = incoming?.sequence;
  const curSeq = current?.sequence;
  if (
    typeof inSeq === "number" &&
    Number.isFinite(inSeq) &&
    typeof curSeq === "number" &&
    Number.isFinite(curSeq)
  ) {
    return inSeq <= curSeq;
  }

  const inTime = toEpoch(incoming?.timestamp);
  const curTime = toEpoch(current?.timestamp);
  if (inTime !== null && curTime !== null) {
    return inTime <= curTime;
  }

  return false;
}

/* ─────────────────────────────────────────────────────────────────────────
 * 4. Status transition validation
 * ───────────────────────────────────────────────────────────────────────── */

const TRANSITIONS: Record<LocalShipmentStatus, readonly LocalShipmentStatus[]> = {
  created: ["created", "picked_up", "failed", "cancelled"],
  picked_up: ["picked_up", "in_transit", "failed", "cancelled"],
  in_transit: ["in_transit", "out_for_delivery", "failed", "cancelled"],
  out_for_delivery: ["out_for_delivery", "delivered", "failed", "cancelled"],
  // Terminal states: only a no-op re-application is allowed.
  delivered: ["delivered"],
  failed: ["failed"],
  cancelled: ["cancelled"],
  // Cannot reason about an unknown current state: allow any known target,
  // but never transition *into* unknown.
  unknown: [
    "created",
    "picked_up",
    "in_transit",
    "out_for_delivery",
    "delivered",
    "failed",
    "cancelled",
    "unknown",
  ],
};

/**
 * Whether a shipment may move from `from` to `to`. Rejects skipped stages and
 * any move out of a terminal state; same-state re-application is allowed so a
 * repeated webhook is harmless.
 */
export function isValidStatusTransition(from: string, to: string): boolean {
  const allowed = TRANSITIONS[from as LocalShipmentStatus];
  return allowed ? allowed.includes(to as LocalShipmentStatus) : false;
}

/* ─────────────────────────────────────────────────────────────────────────
 * 5. Webhook payload validation + field extraction
 * ───────────────────────────────────────────────────────────────────────── */

export interface ShipmentPayloadFields {
  awb: string;
  courier: string;
  orderId: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  value: ShipmentPayloadFields | null;
}

type Dict = Record<string, any>;

function asDict(value: unknown): Dict {
  return value && typeof value === "object" ? (value as Dict) : {};
}

/** Carrier callbacks wrap their body in `payload`; accept either shape. */
function unwrap(payload: unknown): { outer: Dict; inner: Dict } {
  const outer = asDict(payload);
  const inner =
    outer.payload && typeof outer.payload === "object"
      ? asDict(outer.payload)
      : outer;
  return { outer, inner };
}

function firstString(dict: Dict, keys: readonly string[]): string | null {
  for (const key of keys) {
    const value = dict?.[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return null;
}

const AWB_KEYS = ["awb_code", "awb", "tracking_number", "trackingNumber"] as const;
const COURIER_KEYS = ["courier_name", "courier", "courierName"] as const;
const ORDER_KEYS = ["order_id", "orderId", "orderID"] as const;

/** Extract the AWB from the carrier's varying field names / nesting. */
export function extractAwb(payload: unknown): string | null {
  const { outer, inner } = unwrap(payload);
  return firstString(inner, AWB_KEYS) ?? firstString(outer, AWB_KEYS);
}

/**
 * Require AWB + courier + order linkage, accepting the carrier's common field
 * aliases and both flat and nested payload shapes. Rejects missing or blank
 * values; the returned `errors` list names each missing field.
 */
export function validateShipmentPayload(payload: unknown): ValidationResult {
  const { outer, inner } = unwrap(payload);
  const resolve = (keys: readonly string[]) =>
    firstString(inner, keys) ?? firstString(outer, keys);

  const awb = resolve(AWB_KEYS);
  const courier = resolve(COURIER_KEYS);
  let orderId = resolve(ORDER_KEYS);
  if (!orderId) {
    const orderObj = inner.order ?? outer.order;
    if (orderObj && typeof orderObj === "object") {
      orderId = firstString(asDict(orderObj), ["id", "order_id", "orderId"]);
    }
  }

  const errors: string[] = [];
  if (!awb) errors.push("awb");
  if (!courier) errors.push("courier");
  if (!orderId) errors.push("orderId");

  return {
    valid: errors.length === 0,
    errors,
    value: errors.length === 0 ? { awb: awb!, courier: courier!, orderId: orderId! } : null,
  };
}

/* ─────────────────────────────────────────────────────────────────────────
 * 6. Shipment request builder (never fabricates physical data)
 * ───────────────────────────────────────────────────────────────────────── */

export interface DimensionsCm {
  length?: number | null;
  breadth?: number | null;
  height?: number | null;
}

export interface BuildShipmentRequestInput {
  order?: { id?: unknown; items?: any[] } | null;
  /** Real gross weight in kilograms — must be supplied by the caller. */
  weightKg?: number | null;
  /** Real package dimensions in centimetres — must be supplied by the caller. */
  dimensionsCm?: DimensionsCm | null;
  /** HSN/SAC classification, passed through (never invented). */
  hsn?: string | null;
}

export interface ShipmentRequest {
  orderId: string;
  orderItems: Array<{
    name: string;
    sku: string;
    units: number;
    selling_price: number;
    hsn: string | null;
  }>;
  weightKg: number;
  dimensionsCm: { length: number; breadth: number; height: number };
  hsn: string | null;
}

export type BuildShipmentRequestResult =
  | { ok: true; needsOwnerInput: false; request: ShipmentRequest }
  | {
      ok: false;
      needsOwnerInput: true;
      reason: "needsOwnerInput";
      missing: string[];
    };

function isPositiveNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

/**
 * Build a Shiprocket-ready request using ONLY the physical data actually
 * passed in. If weight or any dimension is missing/invalid, the build is
 * refused with `needsOwnerInput` rather than substituting hardcoded defaults
 * (the legacy `10x10x5 cm / 0.5 kg` guess is exactly what this prevents).
 */
export function buildShipmentRequest(
  input: BuildShipmentRequestInput
): BuildShipmentRequestResult {
  const order = input?.order ?? null;
  const orderIdRaw = order?.id;
  const orderId =
    typeof orderIdRaw === "string"
      ? orderIdRaw.trim()
      : typeof orderIdRaw === "number"
        ? String(orderIdRaw)
        : "";

  const missing: string[] = [];
  if (!orderId) missing.push("order.id");
  if (!isPositiveNumber(input?.weightKg)) missing.push("weightKg");

  const d = input?.dimensionsCm;
  if (!isPositiveNumber(d?.length)) missing.push("dimensionsCm.length");
  if (!isPositiveNumber(d?.breadth)) missing.push("dimensionsCm.breadth");
  if (!isPositiveNumber(d?.height)) missing.push("dimensionsCm.height");

  if (missing.length > 0) {
    return { ok: false, needsOwnerInput: true, reason: "needsOwnerInput", missing };
  }

  const hsn =
    typeof input.hsn === "string" && input.hsn.trim() ? input.hsn.trim() : null;

  const orderItems = (order?.items ?? []).map((item: any) => {
    const itemObj = asDict(item);
    const qty = Number(itemObj.quantity);
    const price = Number(itemObj.unit_price);
    const itemHsn = firstString(itemObj, ["hsn", "hsn_code"]);
    return {
      name: firstString(itemObj, ["product_title", "title", "name"]) ?? "",
      sku: firstString(itemObj, ["variant_sku", "sku"]) ?? "",
      units: Number.isFinite(qty) ? qty : 0,
      selling_price: Number.isFinite(price) ? price : 0,
      hsn: itemHsn ?? hsn,
    };
  });

  return {
    ok: true,
    needsOwnerInput: false,
    request: {
      orderId,
      orderItems,
      weightKg: input.weightKg as number,
      dimensionsCm: {
        length: d!.length as number,
        breadth: d!.breadth as number,
        height: d!.height as number,
      },
      hsn,
    },
  };
}

/* ─────────────────────────────────────────────────────────────────────────
 * 7. Pure idempotency for repeated webhook events
 * ───────────────────────────────────────────────────────────────────────── */

export interface EventApplication {
  /** True when this event id was already applied (no second effect allowed). */
  duplicate: boolean;
  /** The new seen-id set; the input set is never mutated. */
  seen: ReadonlySet<string>;
}

/**
 * Pure dedupe step: given the set of already-applied event ids and an incoming
 * event id, decide whether it is a duplicate and return the next seen-set.
 * A blank id cannot be deduplicated, so it is treated as a fresh event and the
 * seen-set is left unchanged.
 */
export function applyWebhookEvent(
  seen: ReadonlySet<string> | null | undefined,
  eventId: string | null | undefined
): EventApplication {
  const current: ReadonlySet<string> = seen ?? new Set<string>();
  const id = typeof eventId === "string" ? eventId.trim() : "";
  if (!id) return { duplicate: false, seen: current };
  if (current.has(id)) return { duplicate: true, seen: current };
  const next = new Set(current);
  next.add(id);
  return { duplicate: false, seen: next };
}
