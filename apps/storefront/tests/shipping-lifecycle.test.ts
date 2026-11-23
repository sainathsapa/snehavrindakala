/**
 * A61 — shipping / fulfilment lifecycle verification tests.
 *
 * Exercises the pure adapter in `lib/shipping/verify.ts` against fixtures:
 * token tampering, the full status map, delayed/out-of-order events, invalid
 * transitions, payload validation, AWB extraction, refusal to fabricate
 * physical data, and duplicate-event idempotency.
 *
 * NOTE ON GATE HONESTY: everything asserted here is deterministic and fixture-
 * based. These tests do NOT prove that the live Shiprocket webhook token is
 * configured correctly, that the carrier actually emits the status strings in
 * the map, or that a real callback reaches this adapter — those require the
 * owner's Shiprocket credentials/webhook token and a live event. See the
 * agent report for the explicit live-vs-fixture split.
 */

import { describe, expect, it } from "vitest";
import {
  applyWebhookEvent,
  buildShipmentRequest,
  extractAwb,
  isDelayedEvent,
  isValidStatusTransition,
  LOCAL_SHIPMENT_STATUSES,
  mapShiprocketStatus,
  validateShipmentPayload,
  verifyWebhookToken,
} from "../lib/shipping/verify";

/* ─────────────────────────── Token verification ─────────────────────────── */

describe("verifyWebhookToken", () => {
  const TOKEN = "shiprocket-shared-secret-9f3a";

  it("accepts a matching expected/provided token", () => {
    expect(verifyWebhookToken(TOKEN, TOKEN)).toBe(true);
  });

  it("tolerates surrounding whitespace like a real header value", () => {
    expect(verifyWebhookToken(`  ${TOKEN}  `, `\t${TOKEN}\n`)).toBe(true);
  });

  it("rejects a tampered token of the same length", () => {
    const tampered = TOKEN.slice(0, -1) + "X";
    expect(tampered).toHaveLength(TOKEN.length);
    expect(verifyWebhookToken(TOKEN, tampered)).toBe(false);
  });

  it("rejects a token of a different length", () => {
    expect(verifyWebhookToken(TOKEN, TOKEN + "extra")).toBe(false);
    expect(verifyWebhookToken(TOKEN, TOKEN.slice(0, 4))).toBe(false);
  });

  it("fails closed when the expected token is unset or blank", () => {
    for (const unset of [undefined, null, "", "   "]) {
      expect(verifyWebhookToken(unset, TOKEN)).toBe(false);
      expect(verifyWebhookToken(unset, "")).toBe(false);
    }
  });

  it("rejects a missing provided token", () => {
    for (const unset of [undefined, null, "", "  "]) {
      expect(verifyWebhookToken(TOKEN, unset)).toBe(false);
    }
  });

  it("never throws on non-string inputs", () => {
    expect(verifyWebhookToken(TOKEN as any, 123 as any)).toBe(false);
    expect(verifyWebhookToken({} as any, TOKEN as any)).toBe(false);
  });
});

/* ────────────────────────── Status mapping table ───────────────────────── */

describe("mapShiprocketStatus — full mapping table", () => {
  const table: Array<[raw: string, expected: string]> = [
    ["created", "created"],
    ["new", "created"],
    ["pending", "created"],
    ["processing", "created"],
    ["Ready For Pickup", "created"],
    ["Picked Up", "picked_up"],
    ["pickedup", "picked_up"],
    ["picked_up", "picked_up"],
    ["Shipped", "picked_up"],
    ["In Transit", "in_transit"],
    ["intransit", "in_transit"],
    ["in_transit", "in_transit"],
    ["Out for Delivery", "out_for_delivery"],
    ["outfordelivery", "out_for_delivery"],
    ["out_for_delivery", "out_for_delivery"],
    ["Delivered", "delivered"],
    ["delivered_to_consumer", "delivered"],
    ["Failed", "failed"],
    ["Undelivered", "failed"],
    ["RTO", "failed"],
    ["Returned", "failed"],
    ["Cancelled", "cancelled"],
    ["canceled", "cancelled"],
  ];

  it.each(table)("maps %s -> %s", (raw, expected) => {
    expect(mapShiprocketStatus(raw)).toBe(expected);
  });

  it("normalises casing, whitespace, hyphens and underscores", () => {
    expect(mapShiprocketStatus("  in-transit ")).toBe("in_transit");
    expect(mapShiprocketStatus("OUT FOR DELIVERY")).toBe("out_for_delivery");
    expect(mapShiprocketStatus("  Picked   Up\n")).toBe("picked_up");
    expect(mapShiprocketStatus("delivered_to_consumer")).toBe("delivered");
  });

  it("maps every unrecognised value to 'unknown' rather than guessing", () => {
    for (const raw of ["something new", "  ", "", "quantum entangled"]) {
      expect(mapShiprocketStatus(raw)).toBe("unknown");
    }
    for (const raw of [undefined, null, 42, {}, []]) {
      expect(mapShiprocketStatus(raw)).toBe("unknown");
    }
  });

  it("every mapped result is inside the declared canonical vocabulary", () => {
    for (const [raw] of table) {
      expect(LOCAL_SHIPMENT_STATUSES).toContain(mapShiprocketStatus(raw));
    }
  });
});

/* ──────────────────── Out-of-order / delayed events ────────────────────── */

describe("isDelayedEvent", () => {
  it("rejects older and equal sequence numbers", () => {
    expect(isDelayedEvent({ sequence: 3 }, { sequence: 5 })).toBe(true);
    expect(isDelayedEvent({ sequence: 5 }, { sequence: 5 })).toBe(true);
  });

  it("accepts a newer sequence number", () => {
    expect(isDelayedEvent({ sequence: 6 }, { sequence: 5 })).toBe(false);
  });

  it("rejects older and equal timestamps (ISO, numeric, Date)", () => {
    const current = { timestamp: "2026-01-10T10:00:00Z" };
    expect(
      isDelayedEvent({ timestamp: "2026-01-09T10:00:00Z" }, current)
    ).toBe(true);
    expect(isDelayedEvent({ timestamp: "2026-01-10T10:00:00Z" }, current)).toBe(
      true
    );
    expect(
      isDelayedEvent(
        { timestamp: new Date("2026-01-09T10:00:00Z") },
        { timestamp: Date.parse("2026-01-10T10:00:00Z") }
      )
    ).toBe(true);
  });

  it("accepts a newer timestamp", () => {
    expect(
      isDelayedEvent(
        { timestamp: "2026-01-11T10:00:00Z" },
        { timestamp: "2026-01-10T10:00:00Z" }
      )
    ).toBe(false);
  });

  it("prefers sequence over timestamp when both are available", () => {
    // Newer timestamp but stale sequence -> delayed.
    expect(
      isDelayedEvent(
        { sequence: 2, timestamp: "2026-01-12T10:00:00Z" },
        { sequence: 9, timestamp: "2026-01-10T10:00:00Z" }
      )
    ).toBe(true);
  });

  it("fails open when there is not enough data to compare", () => {
    expect(isDelayedEvent({}, {})).toBe(false);
    expect(isDelayedEvent({ sequence: 1 }, {})).toBe(false);
    expect(isDelayedEvent({}, { sequence: 9 })).toBe(false);
    expect(isDelayedEvent({ timestamp: "not-a-date" }, { timestamp: "also-bad" })).toBe(
      false
    );
  });
});

/* ───────────────────── Status transition validation ────────────────────── */

describe("isValidStatusTransition", () => {
  it("allows the happy-path forward progression", () => {
    expect(isValidStatusTransition("created", "picked_up")).toBe(true);
    expect(isValidStatusTransition("picked_up", "in_transit")).toBe(true);
    expect(isValidStatusTransition("in_transit", "out_for_delivery")).toBe(true);
    expect(isValidStatusTransition("out_for_delivery", "delivered")).toBe(true);
  });

  it("allows failure / cancellation from in-flight states", () => {
    expect(isValidStatusTransition("created", "cancelled")).toBe(true);
    expect(isValidStatusTransition("picked_up", "failed")).toBe(true);
    expect(isValidStatusTransition("in_transit", "cancelled")).toBe(true);
    expect(isValidStatusTransition("out_for_delivery", "failed")).toBe(true);
  });

  it("rejects skipped stages and backwards movement", () => {
    expect(isValidStatusTransition("created", "delivered")).toBe(false);
    expect(isValidStatusTransition("created", "out_for_delivery")).toBe(false);
    expect(isValidStatusTransition("in_transit", "created")).toBe(false);
    expect(isValidStatusTransition("delivered", "in_transit")).toBe(false);
    expect(isValidStatusTransition("out_for_delivery", "in_transit")).toBe(false);
  });

  it("treats delivered/failed/cancelled as terminal", () => {
    for (const terminal of ["delivered", "failed", "cancelled"]) {
      expect(isValidStatusTransition(terminal, "created")).toBe(false);
      expect(isValidStatusTransition(terminal, "delivered")).toBe(
        terminal === "delivered"
      ); // only a no-op re-application is allowed
    }
  });

  it("allows idempotent same-state re-application", () => {
    for (const status of LOCAL_SHIPMENT_STATUSES) {
      expect(isValidStatusTransition(status, status)).toBe(true);
    }
  });

  it("never transitions into 'unknown', and is permissive from 'unknown'", () => {
    expect(isValidStatusTransition("in_transit", "unknown")).toBe(false);
    expect(isValidStatusTransition("unknown", "in_transit")).toBe(true);
    expect(isValidStatusTransition("bogus", "delivered")).toBe(false);
  });
});

/* ────────────────────── Payload validation + AWB ────────────────────────── */

describe("validateShipmentPayload", () => {
  it("accepts a flat, fully linked payload", () => {
    const result = validateShipmentPayload({
      awb_code: "AWB123456",
      courier_name: "Delhivery",
      order_id: "ord_42",
      current_status: "Delivered",
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.value).toEqual({
      awb: "AWB123456",
      courier: "Delhivery",
      orderId: "ord_42",
    });
  });

  it("accepts the carrier's nested payload shape and field aliases", () => {
    const result = validateShipmentPayload({
      payload: {
        tracking_number: "TRK-9",
        courier: "Xpressbees",
        orderId: "ord_9",
      },
    });
    expect(result.valid).toBe(true);
    expect(result.value).toEqual({
      awb: "TRK-9",
      courier: "Xpressbees",
      orderId: "ord_9",
    });
  });

  it("accepts an order object as the order linkage", () => {
    const result = validateShipmentPayload({
      awb: "AWB-77",
      courier_name: "DTDC",
      order: { id: "ord_77" },
    });
    expect(result.valid).toBe(true);
    expect(result.value?.orderId).toBe("ord_77");
  });

  it("rejects missing AWB", () => {
    const r = validateShipmentPayload({ courier_name: "C", order_id: "o" });
    expect(r.valid).toBe(false);
    expect(r.errors).toContain("awb");
    expect(r.value).toBeNull();
  });

  it("rejects missing courier", () => {
    const r = validateShipmentPayload({ awb: "A", order_id: "o" });
    expect(r.valid).toBe(false);
    expect(r.errors).toContain("courier");
  });

  it("rejects missing order linkage", () => {
    const r = validateShipmentPayload({ awb: "A", courier_name: "C" });
    expect(r.valid).toBe(false);
    expect(r.errors).toContain("orderId");
  });

  it("rejects blank/whitespace values rather than treating them as present", () => {
    const r = validateShipmentPayload({
      awb: "   ",
      courier_name: "",
      order_id: "\t\n",
    });
    expect(r.valid).toBe(false);
    expect(r.errors).toEqual(["awb", "courier", "orderId"]);
  });

  it("reports every missing field at once", () => {
    expect(validateShipmentPayload({}).errors).toEqual([
      "awb",
      "courier",
      "orderId",
    ]);
  });
});

describe("extractAwb — AWB mapping", () => {
  it("reads AWB from each supported field name", () => {
    expect(extractAwb({ awb_code: "A1" })).toBe("A1");
    expect(extractAwb({ awb: "A2" })).toBe("A2");
    expect(extractAwb({ tracking_number: "A3" })).toBe("A3");
    expect(extractAwb({ trackingNumber: "A4" })).toBe("A4");
  });

  it("reads AWB from the nested carrier body", () => {
    expect(extractAwb({ payload: { awb_code: "NESTED" } })).toBe("NESTED");
  });

  it("returns null when no AWB is present", () => {
    expect(extractAwb({ order_id: "o" })).toBeNull();
    expect(extractAwb(null)).toBeNull();
  });
});

/* ────────────────── Shipment request / physical data ──────────────────── */

describe("buildShipmentRequest", () => {
  const order = {
    id: "ord_123",
    items: [
      {
        product_title: "Hand-painted vase",
        variant_sku: "VASE-01",
        quantity: 2,
        unit_price: 1500,
      },
    ],
  };

  it("uses the REAL passed-in weight, dimensions, HSN and order id", () => {
    const result = buildShipmentRequest({
      order,
      weightKg: 2.75,
      dimensionsCm: { length: 30, breadth: 20, height: 12.5 },
      hsn: "6704",
    });

    expect(result.ok).toBe(true);
    expect(result.needsOwnerInput).toBe(false);
    if (!result.ok) return;
    expect(result.request.orderId).toBe("ord_123");
    expect(result.request.weightKg).toBe(2.75);
    expect(result.request.dimensionsCm).toEqual({
      length: 30,
      breadth: 20,
      height: 12.5,
    });
    expect(result.request.hsn).toBe("6704");
    expect(result.request.orderItems[0]).toMatchObject({
      name: "Hand-painted vase",
      sku: "VASE-01",
      units: 2,
      selling_price: 1500,
      hsn: "6704",
    });
  });

  it("never invents the legacy 0.5 kg / 10x10x5 cm defaults", () => {
    const result = buildShipmentRequest({ order, weightKg: 0.5, dimensionsCm: { length: 10, breadth: 10, height: 5 } });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // The values are present only because they were explicitly passed.
    expect(result.request.weightKg).toBe(0.5);
    expect(result.request.dimensionsCm).toEqual({ length: 10, breadth: 10, height: 5 });

    const genuinelyMissing = buildShipmentRequest({ order });
    expect(genuinelyMissing.ok).toBe(false);
    if (genuinelyMissing.ok) return;
    expect(genuinelyMissing.missing).toContain("weightKg");
    expect(genuinelyMissing.missing).toContain("dimensionsCm.length");
  });

  it("returns needsOwnerInput when weight is missing or invalid", () => {
    for (const weightKg of [undefined, null, 0, -1, NaN, Infinity, "2" as any]) {
      const result = buildShipmentRequest({
        order,
        weightKg,
        dimensionsCm: { length: 30, breadth: 20, height: 12 },
      });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.needsOwnerInput).toBe(true);
      expect(result.reason).toBe("needsOwnerInput");
      expect(result.missing).toContain("weightKg");
    }
  });

  it("returns needsOwnerInput when dimensions are missing or invalid", () => {
    const dimensionsCases: any[] = [
      undefined,
      null,
      { breadth: 20, height: 12 },
      { length: 0, breadth: 20, height: 12 },
      { length: -5, breadth: 20, height: 12 },
      { length: NaN, breadth: 20, height: 12 },
    ];
    for (const dimensionsCm of dimensionsCases) {
      const result = buildShipmentRequest({ order, weightKg: 1.2, dimensionsCm });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.reason).toBe("needsOwnerInput");
      expect(result.missing.some((f) => f.startsWith("dimensionsCm."))).toBe(true);
    }
  });

  it("reports all missing physical fields together", () => {
    const result = buildShipmentRequest({ order: { id: "o" } });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.missing).toEqual([
      "weightKg",
      "dimensionsCm.length",
      "dimensionsCm.breadth",
      "dimensionsCm.height",
    ]);
  });

  it("refuses to build without an order id linkage", () => {
    const result = buildShipmentRequest({
      order: { items: [] },
      weightKg: 1,
      dimensionsCm: { length: 1, breadth: 1, height: 1 },
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.missing).toContain("order.id");
  });
});

/* ───────────────────── Duplicate-event idempotency ───────────────────── */

describe("applyWebhookEvent — duplicate event idempotency (pure layer)", () => {
  it("applies a new event once and records its id", () => {
    const first = applyWebhookEvent(new Set<string>(), "evt_1");
    expect(first.duplicate).toBe(false);
    expect([...first.seen]).toEqual(["evt_1"]);
  });

  it("marks a repeated event id as a duplicate with no second effect", () => {
    const first = applyWebhookEvent(new Set<string>(), "evt_1");
    const second = applyWebhookEvent(first.seen, "evt_1");

    expect(second.duplicate).toBe(true);
    // The seen-set is unchanged: no second effect was recorded.
    expect(second.seen).toBe(first.seen);
    expect([...second.seen]).toEqual(["evt_1"]);
  });

  it("accepts a distinct event id", () => {
    const first = applyWebhookEvent(new Set<string>(), "evt_1");
    const second = applyWebhookEvent(first.seen, "evt_2");
    expect(second.duplicate).toBe(false);
    expect([...second.seen].sort()).toEqual(["evt_1", "evt_2"]);
  });

  it("does not mutate the input seen-set (purity)", () => {
    const original = new Set<string>(["evt_a"]);
    const result = applyWebhookEvent(original, "evt_b");
    expect([...original]).toEqual(["evt_a"]);
    expect(result.seen).not.toBe(original);
    expect([...result.seen].sort()).toEqual(["evt_a", "evt_b"]);
  });

  it("treats a blank event id as not deduplicable and leaves state untouched", () => {
    const original = new Set<string>(["evt_a"]);
    for (const id of [undefined, null, "", "   "]) {
      const result = applyWebhookEvent(original, id);
      expect(result.duplicate).toBe(false);
      expect(result.seen).toBe(original);
    }
  });
});
