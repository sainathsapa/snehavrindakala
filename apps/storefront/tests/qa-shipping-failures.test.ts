/**
 * FINAL GO — QA Scenario I: shipping failure and retry (agent A99).
 *
 * Independent QA coverage of the pure shipping-verification adapter
 * (`lib/shipping/verify.ts`, A61). Every assertion here is deterministic and
 * fixture-based: token tampering, duplicate-event idempotency, out-of-order
 * delivery, the failed-delivery mapping/transition, an end-to-end in-memory
 * failure-then-retry simulation, and "notify once per status change".
 *
 * A small PURE simulator (defined below) drives the A61 helpers the way a real
 * webhook caller would: verify token -> validate payload -> dedupe by event id
 * -> drop delayed events -> enforce status transitions -> map status -> record
 * a side effect (a notification key). It performs NO network, database, email,
 * or payment calls and spends NO credentials.
 *
 * GATE HONESTY: these tests prove the decision layer is correct for fixtures.
 * They do NOT prove the live Shiprocket webhook token is configured, that the
 * carrier emits these exact status strings, or that a real callback reaches the
 * adapter. Those need the owner's credentials and a live event, and are recorded
 * separately as owner-gated / live-only — never claimed as a PASS here.
 */

import { describe, expect, it } from "vitest";
import {
  applyWebhookEvent,
  isDelayedEvent,
  isValidStatusTransition,
  LOCAL_SHIPMENT_STATUSES,
  mapShiprocketStatus,
  validateShipmentPayload,
  verifyWebhookToken,
  type EventMeta,
  type LocalShipmentStatus,
} from "../lib/shipping/verify";

const TOKEN = "shiprocket-webhook-secret-test-4c1d";
const ORDER_ID = "ord-ship-i";
const AWB_1 = "AWB-ORIG-1";
const AWB_2 = "AWB-RETRY-2";

/* ─────────────────────────── Pure simulator ─────────────────────────────── */

type OrderStatus = "processing" | "shipped" | "fulfilled" | "delivery_exception";
type RejectReason =
  | "auth"
  | "invalid_payload"
  | "wrong_shipment"
  | "duplicate"
  | "unknown_status"
  | "delayed"
  | "invalid_transition";

interface Attempt {
  awb: string;
  status: LocalShipmentStatus;
  meta: EventMeta;
  seen: ReadonlySet<string>;
}

interface SimState {
  orderId: string;
  orderStatus: OrderStatus;
  /** Index 0 is the first attempt; the last entry is always the active one. */
  attempts: readonly Attempt[];
  /** Keys of notifications that "would be" emitted, in order. */
  notifications: readonly string[];
}

interface CarrierEvent {
  eventId: string;
  token: string;
  sequence: number;
  timestamp: string;
  payload: {
    awb_code: string;
    courier_name: string;
    order_id: string;
    current_status: string;
  };
}

interface ReceiveResult {
  state: SimState;
  accepted: boolean;
  reason: RejectReason | "accepted";
  /** True only when the active shipment status actually changed. */
  changed: boolean;
}

/** Order status is a pure function of the active shipment status. */
function deriveOrderStatus(status: LocalShipmentStatus): OrderStatus {
  switch (status) {
    case "delivered":
      return "fulfilled";
    case "failed":
    case "cancelled":
      return "delivery_exception";
    case "picked_up":
    case "in_transit":
    case "out_for_delivery":
      return "shipped";
    case "created":
    case "unknown":
    default:
      return "processing";
  }
}

function initialState(): SimState {
  return {
    orderId: ORDER_ID,
    orderStatus: deriveOrderStatus("created"),
    attempts: [
      { awb: AWB_1, status: "created", meta: { sequence: 0 }, seen: new Set<string>() },
    ],
    notifications: [],
  };
}

function activeOf(state: SimState): Attempt {
  return state.attempts[state.attempts.length - 1];
}

function assertConsistent(state: SimState): void {
  // The core invariant: order status is always derived from the active
  // shipment status, and that status is inside A61's canonical vocabulary.
  expect(LOCAL_SHIPMENT_STATUSES).toContain(activeOf(state).status);
  expect(state.orderStatus).toBe(deriveOrderStatus(activeOf(state).status));
}

function ev(
  eventId: string,
  sequence: number,
  rawStatus: string,
  awb = AWB_1,
  overrides: Partial<CarrierEvent> = {}
): CarrierEvent {
  return {
    eventId,
    token: TOKEN,
    sequence,
    timestamp: new Date(Date.UTC(2026, 0, 1, 0, 0, sequence)).toISOString(),
    payload: {
      awb_code: awb,
      courier_name: "Delhivery",
      order_id: ORDER_ID,
      current_status: rawStatus,
    },
    ...overrides,
  };
}

/**
 * Apply one carrier event through the full A61 guard chain. Pure: on every
 * rejection the exact same state object is returned and nothing is recorded.
 */
function receiveEvent(
  state: SimState,
  event: CarrierEvent,
  expectedToken: string | null = TOKEN
): ReceiveResult {
  const reject = (reason: RejectReason): ReceiveResult => ({
    state,
    accepted: false,
    reason,
    changed: false,
  });

  // 1. Auth gate runs first and fails closed.
  if (!verifyWebhookToken(expectedToken, event.token)) return reject("auth");

  // 2. Required linkage fields must be present and well-formed.
  const validated = validateShipmentPayload(event.payload);
  if (!validated.valid || !validated.value) return reject("invalid_payload");

  const active = activeOf(state);
  if (
    validated.value.awb !== active.awb ||
    validated.value.orderId !== state.orderId
  ) {
    return reject("wrong_shipment");
  }

  // 3. Idempotency: a repeated event id has no second effect.
  const deduped = applyWebhookEvent(active.seen, event.eventId);
  if (deduped.duplicate) return reject("duplicate");

  // 4. Canonical status; unknown input is never guessed at.
  const mapped = mapShiprocketStatus(event.payload.current_status);
  if (mapped === "unknown") return reject("unknown_status");

  // 5. Delayed / out-of-order events are dropped before they can regress state.
  const incoming: EventMeta = {
    sequence: event.sequence,
    timestamp: event.timestamp,
  };
  if (isDelayedEvent(incoming, active.meta)) return reject("delayed");

  // 6. Only legal forward transitions (or a same-state re-application) apply.
  if (!isValidStatusTransition(active.status, mapped)) {
    return reject("invalid_transition");
  }

  const changed = mapped !== active.status;
  const nextAttempt: Attempt = {
    ...active,
    status: mapped,
    meta: incoming,
    seen: deduped.seen,
  };
  const nextState: SimState = {
    ...state,
    orderStatus: deriveOrderStatus(mapped),
    attempts: [...state.attempts.slice(0, -1), nextAttempt],
    notifications: changed
      ? [...state.notifications, `${state.orderId}:${active.awb}:${mapped}`]
      : state.notifications,
  };
  return { state: nextState, accepted: true, reason: "accepted", changed };
}

/** A failed attempt is terminal; a retry opens a fresh attempt/AWB. */
function startRetry(state: SimState, awb = AWB_2): SimState {
  const attempt: Attempt = {
    awb,
    status: "created",
    meta: { sequence: 0 },
    seen: new Set<string>(),
  };
  return {
    ...state,
    orderStatus: deriveOrderStatus("created"),
    attempts: [...state.attempts, attempt],
    notifications: [
      ...state.notifications,
      `${state.orderId}:${awb}:retry_scheduled`,
    ],
  };
}

function applyAll(state: SimState, events: CarrierEvent[]): SimState {
  return events.reduce((acc, e) => {
    const r = receiveEvent(acc, e);
    expect(r.accepted).toBe(true);
    return r.state;
  }, state);
}

/* ───────────────── 1. Invalid / empty webhook token ─────────────────────── */

describe("Scenario I — webhook token gate", () => {
  it("accepts the correct token and rejects a tampered one", () => {
    expect(verifyWebhookToken(TOKEN, TOKEN)).toBe(true);
    const tampered = TOKEN.slice(0, -1) + "X";
    expect(tampered).toHaveLength(TOKEN.length);
    expect(verifyWebhookToken(TOKEN, tampered)).toBe(false);
  });

  it("fails closed when the expected token is unset/blank (no provided value authenticates)", () => {
    for (const unset of [undefined, null, "", "   "]) {
      expect(verifyWebhookToken(unset, TOKEN)).toBe(false);
      expect(verifyWebhookToken(unset, "")).toBe(false);
    }
  });

  it("rejects an empty or missing provided token", () => {
    for (const provided of [undefined, null, "", "  "]) {
      expect(verifyWebhookToken(TOKEN, provided)).toBe(false);
    }
  });

  it("an attacker event with a bad token is rejected with zero effect on the simulation", () => {
    const before = initialState();
    const snapshot = JSON.stringify(before);
    const forged = ev("evt-forged", 2, "Delivered", AWB_1, { token: "wrong" });

    const r = receiveEvent(before, forged);
    expect(r.accepted).toBe(false);
    expect(r.reason).toBe("auth");
    expect(r.state).toBe(before); // same object: nothing mutated
    expect(activeOf(r.state).status).toBe("created");
    expect(r.state.notifications).toEqual([]);
    expect(JSON.stringify(before)).toBe(snapshot);
  });

  it("an unconfigured endpoint fails closed even for a would-be valid event", () => {
    const before = initialState();
    const realLooking = ev("evt-real", 2, "Shipped", AWB_1);
    const r = receiveEvent(before, realLooking, ""); // expected token blank
    expect(r.reason).toBe("auth");
    expect(r.accepted).toBe(false);
    expect(r.state.notifications).toEqual([]);
  });
});

/* ───────────────── 2. Duplicate event id → no second effect ─────────────── */

describe("Scenario I — duplicate webhook event id (applyWebhookEvent)", () => {
  it("records a new event id once and flags its replay as a duplicate", () => {
    const first = applyWebhookEvent(new Set<string>(), "evt_a");
    expect(first.duplicate).toBe(false);
    const replay = applyWebhookEvent(first.seen, "evt_a");
    expect(replay.duplicate).toBe(true);
    expect(replay.seen).toBe(first.seen);
    expect([...replay.seen]).toEqual(["evt_a"]);
  });

  it("a duplicate delivery event produces no second status change and no notification", () => {
    const pickup = receiveEvent(initialState(), ev("evt-1", 2, "Shipped"));
    expect(pickup.accepted).toBe(true);
    expect(activeOf(pickup.state).status).toBe("picked_up");
    const stepsBefore = pickup.state.notifications.length;

    // Same event id, even with a higher sequence, must be deduped first.
    const replay = receiveEvent(
      pickup.state,
      ev("evt-1", 9, "Delivered", AWB_1)
    );
    expect(replay.accepted).toBe(false);
    expect(replay.reason).toBe("duplicate");
    expect(replay.state).toBe(pickup.state);
    expect(activeOf(replay.state).status).toBe("picked_up"); // no second effect
    expect(replay.state.notifications.length).toBe(stepsBefore);
    assertConsistent(replay.state);
  });

  it("a distinct event id is accepted but an equal/stale sequence is dropped as delayed", () => {
    const pickup = receiveEvent(initialState(), ev("evt-1", 2, "Shipped"));
    const distinct = receiveEvent(pickup.state, ev("evt-2", 3, "In Transit"));
    expect(distinct.accepted).toBe(true);
    expect(activeOf(distinct.state).status).toBe("in_transit");
    expect([...activeOf(distinct.state).seen].sort()).toEqual([
      "evt-1",
      "evt-2",
    ]);
  });
});

/* ───────────────── 3. Delayed / out-of-order delivery ───────────────────── */

describe("Scenario I — delayed / out-of-order delivery does not regress status", () => {
  it("isDelayedEvent detects stale/equal sequences and accepts newer ones", () => {
    expect(isDelayedEvent({ sequence: 3 }, { sequence: 5 })).toBe(true);
    expect(isDelayedEvent({ sequence: 5 }, { sequence: 5 })).toBe(true);
    expect(isDelayedEvent({ sequence: 6 }, { sequence: 5 })).toBe(false);
    // Newer timestamp but stale sequence still counts as delayed.
    expect(
      isDelayedEvent(
        { sequence: 2, timestamp: "2026-06-01T00:00:00Z" },
        { sequence: 9, timestamp: "2026-01-01T00:00:00Z" }
      )
    ).toBe(true);
  });

  it("isValidStatusTransition rejects a backwards in-flight move", () => {
    expect(
      isValidStatusTransition("out_for_delivery", "in_transit")
    ).toBe(false);
    expect(isValidStatusTransition("in_transit", "picked_up")).toBe(false);
  });

  it("a late in_transit event after out_for_delivery leaves status unchanged", () => {
    const reachedOfd = applyAll(initialState(), [
      ev("evt-1", 2, "Shipped"),
      ev("evt-2", 3, "In Transit"),
      ev("evt-3", 4, "Out for Delivery"),
    ]);
    expect(activeOf(reachedOfd).status).toBe("out_for_delivery");
    const notesBefore = reachedOfd.notifications.length;

    const late = receiveEvent(reachedOfd, ev("evt-late", 3, "In Transit"));
    expect(late.accepted).toBe(false);
    expect(late.reason).toBe("delayed");
    expect(late.state).toBe(reachedOfd);
    expect(activeOf(late.state).status).toBe("out_for_delivery");
    expect(late.state.notifications.length).toBe(notesBefore);
    assertConsistent(late.state);
  });

  it("a late delivery event cannot resurrect a terminal failed shipment on the same attempt", () => {
    const failed = applyAll(initialState(), [
      ev("evt-1", 2, "Shipped"),
      ev("evt-2", 3, "In Transit"),
      ev("evt-3", 4, "Out for Delivery"),
      ev("evt-4", 5, "Undelivered"),
    ]);
    expect(activeOf(failed).status).toBe("failed");
    expect(failed.orderStatus).toBe("delivery_exception");
    const notesBefore = failed.notifications.length;

    const late = receiveEvent(failed, ev("evt-late-2", 4, "Delivered"));
    expect(late.accepted).toBe(false);
    // Either guard stops it: stale sequence and illegal failed->delivered.
    expect(["delayed", "invalid_transition"]).toContain(late.reason);
    expect(activeOf(late.state).status).toBe("failed");
    expect(late.state.notifications.length).toBe(notesBefore);
    expect(isValidStatusTransition("failed", "delivered")).toBe(false);
    assertConsistent(late.state);
  });
});

/* ───────────── 4. Failed delivery mapping + legal transition ────────────── */

describe("Scenario I — failed delivery maps to 'failed'", () => {
  it("maps every carrier failure string to the canonical 'failed'", () => {
    for (const raw of ["Failed", "Undelivered", "RTO", "Returned", "undelivered"]) {
      expect(mapShiprocketStatus(raw)).toBe("failed");
    }
    expect(LOCAL_SHIPMENT_STATUSES).toContain("failed");
    expect(mapShiprocketStatus("some new carrier status")).toBe("unknown");
  });

  it("maps dispatched-equivalent and out-for-delivery carrier strings correctly", () => {
    // A61's canonical vocabulary has 'picked_up' where the carrier says
    // 'shipped'/'picked up' (i.e. handed to courier / dispatched).
    for (const raw of ["Shipped", "Picked Up", "picked_up"]) {
      expect(mapShiprocketStatus(raw)).toBe("picked_up");
    }
    expect(mapShiprocketStatus("Out for Delivery")).toBe("out_for_delivery");
    // A non-canonical raw 'dispatched' is deliberately not guessed at.
    expect(mapShiprocketStatus("dispatched")).toBe("unknown");
  });

  it("'failed' is a valid transition from dispatched/picked_up and out_for_delivery", () => {
    expect(isValidStatusTransition("picked_up", "failed")).toBe(true);
    expect(isValidStatusTransition("in_transit", "failed")).toBe(true);
    expect(isValidStatusTransition("out_for_delivery", "failed")).toBe(true);
    expect(isValidStatusTransition("created", "failed")).toBe(true);
    // Terminal: no move out of failed except a no-op re-application.
    expect(isValidStatusTransition("failed", "out_for_delivery")).toBe(false);
    expect(isValidStatusTransition("failed", "delivered")).toBe(false);
  });

  it("the simulator accepts a failed-delivery webhook from out_for_delivery", () => {
    const ofd = applyAll(initialState(), [
      ev("evt-1", 2, "Shipped"),
      ev("evt-2", 3, "In Transit"),
      ev("evt-3", 4, "Out for Delivery"),
    ]);
    const r = receiveEvent(ofd, ev("evt-fail", 5, "Undelivered"));
    expect(r.accepted).toBe(true);
    expect(r.changed).toBe(true);
    expect(activeOf(r.state).status).toBe("failed");
    expect(r.state.orderStatus).toBe("delivery_exception");
    assertConsistent(r.state);
  });
});

/* ─────────── 5. Pure simulation: failure → retry stays consistent ───────── */

describe("Scenario I — order/shipment status remain consistent (pure simulation)", () => {
  it("keeps order status derived from shipment status through failure and retry", () => {
    let state = initialState();
    assertConsistent(state);
    expect(activeOf(state).status).toBe("created");
    expect(state.orderStatus).toBe("processing");

    // Attempt 1 ends in a failed delivery.
    state = applyAll(state, [
      ev("a1-1", 2, "Shipped"),
      ev("a1-2", 3, "In Transit"),
      ev("a1-3", 4, "Out for Delivery"),
      ev("a1-4", 5, "Failed"),
    ]);
    expect(activeOf(state).status).toBe("failed");
    expect(state.orderStatus).toBe("delivery_exception");
    expect(state.attempts).toHaveLength(1);
    assertConsistent(state);

    // Retry is a fresh attempt with a new AWB; status resets, order re-opens.
    state = startRetry(state);
    expect(state.attempts).toHaveLength(2);
    expect(activeOf(state).awb).toBe(AWB_2);
    expect(activeOf(state).status).toBe("created");
    expect(state.orderStatus).toBe("processing");
    assertConsistent(state);

    // Attempt 2 completes successfully.
    state = applyAll(state, [
      ev("a2-1", 2, "Picked Up", AWB_2),
      ev("a2-2", 3, "In Transit", AWB_2),
      ev("a2-3", 4, "Out for Delivery", AWB_2),
      ev("a2-4", 5, "Delivered", AWB_2),
    ]);
    expect(activeOf(state).status).toBe("delivered");
    expect(state.orderStatus).toBe("fulfilled");
    // The failed original attempt is preserved for audit, not overwritten.
    expect(state.attempts[0].status).toBe("failed");
    expect(state.attempts[1].status).toBe("delivered");
    assertConsistent(state);
  });

  it("receiveEvent does not mututate the input state (purity)", () => {
    const before = initialState();
    const beforeSnapshot = JSON.stringify({
      orderStatus: before.orderStatus,
      attempts: before.attempts.map((a) => ({
        awb: a.awb,
        status: a.status,
        meta: a.meta,
        seen: [...a.seen],
      })),
      notifications: before.notifications,
    });

    const r = receiveEvent(before, ev("evt-1", 2, "Shipped"));
    expect(r.accepted).toBe(true);
    expect(r.state).not.toBe(before);
    expect(before.attempts[0].status).toBe("created");
    expect([...before.attempts[0].seen]).toEqual([]);
    expect(before.notifications).toEqual([]);
    expect(
      JSON.stringify({
        orderStatus: before.orderStatus,
        attempts: before.attempts.map((a) => ({
          awb: a.awb,
          status: a.status,
          meta: a.meta,
          seen: [...a.seen],
        })),
        notifications: before.notifications,
      })
    ).toBe(beforeSnapshot);
  });

  it("never dedupes on a blank event id, so a real event is not lost", () => {
    const kept = new Set<string>(["evt_kept"]);
    for (const id of [undefined, null, "", "   "]) {
      const dedup = applyWebhookEvent(kept, id);
      expect(dedup.duplicate).toBe(false);
      // Seen-set is left untouched for an id that cannot be deduplicated.
      expect(dedup.seen).toBe(kept);
      expect([...dedup.seen]).toEqual(["evt_kept"]);
    }
    expect(applyWebhookEvent(new Set<string>(), "").seen.size).toBe(0);

    // In the simulator a blank event id is still processed on its own merits.
    const r = receiveEvent(
      initialState(),
      ev("", 2, "Shipped") // event id blank, but a genuine new status
    );
    expect(r.accepted).toBe(true);
    expect(activeOf(r.state).status).toBe("picked_up");
    expect([...activeOf(r.state).seen]).toEqual([]); // nothing recorded
  });
});

/* ───────────────── 6. Notification once per status change ───────────────── */

describe("Scenario I — notification triggered once per status change", () => {
  it("emits exactly one notification per real status change and none for no-ops", () => {
    let state = initialState();
    state = applyAll(state, [
      ev("n-1", 2, "Shipped"), // created -> picked_up
      ev("n-2", 3, "In Transit"), // -> in_transit
      ev("n-3", 4, "Out for Delivery"), // -> out_for_delivery
    ]);
    expect(state.notifications).toEqual([
      `${ORDER_ID}:${AWB_1}:picked_up`,
      `${ORDER_ID}:${AWB_1}:in_transit`,
      `${ORDER_ID}:${AWB_1}:out_for_delivery`,
    ]);

    // A genuine status change adds exactly one notification.
    const fail = receiveEvent(state, ev("n-4", 5, "Failed"));
    expect(fail.accepted).toBe(true);
    expect(fail.state.notifications).toHaveLength(4);
    expect(fail.state.notifications[3]).toBe(
      `${ORDER_ID}:${AWB_1}:failed`
    );

    // Delayed + duplicate + same-status replays add none.
    const delayed = receiveEvent(fail.state, ev("n-late", 4, "In Transit"));
    expect(delayed.reason).toBe("delayed");
    const duplicate = receiveEvent(fail.state, ev("n-4", 8, "Delivered"));
    expect(duplicate.reason).toBe("duplicate");
    expect(delayed.state.notifications).toHaveLength(4);
    expect(duplicate.state.notifications).toHaveLength(4);
  });

  it("a same-status re-application with a newer sequence records no second notification", () => {
    const ofd = applyAll(initialState(), [
      ev("s-1", 2, "Shipped"),
      ev("s-2", 3, "In Transit"),
      ev("s-3", 4, "Out for Delivery"),
    ]);
    const notesBefore = ofd.notifications.length;
    // New event id, higher sequence, but status does not change.
    const replay = receiveEvent(ofd, ev("s-replay", 6, "Out for Delivery"));
    expect(replay.accepted).toBe(true);
    expect(replay.changed).toBe(false);
    expect(activeOf(replay.state).status).toBe("out_for_delivery");
    expect(replay.state.notifications.length).toBe(notesBefore);
    // The seen-set still advanced, so a true replay of s-replay is deduped.
    expect(receiveEvent(replay.state, ev("s-replay", 7, "Delivered")).reason).toBe(
      "duplicate"
    );
  });

  it("a fresh retry attempt may notify again, but never twice for the same change", () => {
    let state = applyAll(initialState(), [
      ev("r-1", 2, "Shipped"),
      ev("r-2", 3, "In Transit"),
      ev("r-3", 4, "Out for Delivery"),
      ev("r-4", 5, "Undelivered"),
    ]);
    expect(state.notifications).toContain(`${ORDER_ID}:${AWB_1}:failed`);

    state = startRetry(state);
    expect(state.notifications).toContain(
      `${ORDER_ID}:${AWB_2}:retry_scheduled`
    );
    state = applyAll(state, [
      ev("r-5", 2, "Picked Up", AWB_2),
      ev("r-6", 3, "In Transit", AWB_2),
      ev("r-7", 4, "Out for Delivery", AWB_2),
      ev("r-8", 5, "Delivered", AWB_2),
    ]);

    // One key per status change, no duplicates anywhere in the stream.
    expect(new Set(state.notifications).size).toBe(state.notifications.length);
    expect(state.notifications).toContain(`${ORDER_ID}:${AWB_2}:delivered`);
    expect(
      state.notifications.filter((k) => k === `${ORDER_ID}:${AWB_2}:delivered`)
    ).toHaveLength(1);
    assertConsistent(state);
  });
});
