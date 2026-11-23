import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * AGENT A06 — GAP-06: active reservation hardening.
 *
 * HONESTY / SCOPE NOTE
 * --------------------
 * No live DB is used. We mock `@/lib/db` (../lib/db) with a FAITHFUL fake
 * executor that models the tables, transactions (BEGIN/COMMIT/ROLLBACK), the
 * SELECT ... FOR UPDATE serialisation on the single hot variant_stock row, the
 * mutable clock used by `now()`, AND the two constraints added by migration
 * 009:
 *   - UNIQUE (variant_id, cart_id) WHERE status = 'active'  (SQLSTATE 23505)
 *   - CHECK (reserved + sold <= on_hand)                    (SQLSTATE 23514)
 * The REAL exported functions from lib/inventory.ts run against this fake, so
 * we exercise the actual reserve/consume/release/expiry code paths, not a
 * re-implementation. We additionally assert the migration's text scope.
 *
 * NOT proven here (owner-gated live stack): real MVCC lock contention,
 * deadlocks, and performance under true simultaneous connections. A DB that
 * actually runs migration 009 is required for that; this is code-level evidence.
 */

const h = vi.hoisted(() => {
  interface Stock { variant_id: string; on_hand: number; reserved: number; sold: number; }
  interface Res {
    id: string;
    variant_id: string;
    cart_id: string;
    quantity: number;
    status: string;
    order_id: string | null;
    expiresAt: number;
  }
  interface Snap {
    stocks: Map<string, Stock>;
    reservations: Res[];
    processedPayments: Map<string, string>;
    seq: number;
  }

  let stocks = new Map<string, Stock>();
  let reservations: Res[] = [];
  let processedPayments = new Map<string, string>(); // payment_id -> order_id
  let seq = 0;
  let nowMs = 1_700_000_000_000; // must be a literal: vi.hoisted runs before module consts
  let lock: Promise<void> = Promise.resolve();
  let snapshot: Snap | null = null;

  function dbError(code: string, message: string): Error {
    const e: any = new Error(message);
    e.code = code;
    return e;
  }
  function rowFor(s: Stock) {
    return { variant_id: s.variant_id, on_hand: s.on_hand, reserved: s.reserved, sold: s.sold };
  }
  /** migration 009 safeguard — enforced on every new stock write. */
  function assertNoOversell(s: Stock) {
    if (s.reserved + s.sold > s.on_hand) {
      throw dbError("23514", "new row violates check constraint ck_variant_stock_no_oversell");
    }
  }
  function begin() {
    snapshot = {
      stocks: new Map([...stocks].map(([k, v]) => [k, { ...v }])),
      reservations: reservations.map((r) => ({ ...r })),
      processedPayments: new Map(processedPayments),
      seq,
    };
  }
  function commit() { snapshot = null; }
  function rollback() {
    if (snapshot) {
      stocks = snapshot.stocks;
      reservations = snapshot.reservations;
      processedPayments = snapshot.processedPayments;
      seq = snapshot.seq;
      snapshot = null;
    }
  }

  async function dispatch(sql: string, params: any[]): Promise<{ rows: any[] }> {
    const s = sql.replace(/\s+/g, " ").trim();

    if (s === "BEGIN") { begin(); return { rows: [] }; }
    if (s === "COMMIT") { commit(); return { rows: [] }; }
    if (s === "ROLLBACK") { rollback(); return { rows: [] }; }

    // -- variant_stock reads -------------------------------------------------
    if (s.startsWith("SELECT variant_id, on_hand, reserved, sold FROM variant_stock ORDER BY")) {
      return {
        rows: [...stocks.values()]
          .sort((a, b) => a.variant_id.localeCompare(b.variant_id))
          .map(rowFor),
      };
    }
    if (s.startsWith("SELECT variant_id, on_hand, reserved, sold FROM variant_stock")) {
      const row = stocks.get(params[0]);
      return { rows: row ? [rowFor(row)] : [] };
    }

    // -- stock_reservation reads --------------------------------------------
    // Idempotency lookup (reserveStock) + consume lookup (FOR UPDATE).
    if (s.startsWith("SELECT id, quantity FROM stock_reservation")) {
      const [vid, cart] = params;
      let pool = reservations.filter(
        (r) => r.variant_id === vid && r.cart_id === cart && r.status === "active"
      );
      if (s.includes("expires_at > now()")) {
        pool = pool.filter((r) => r.expiresAt > nowMs);
      }
      if (s.includes("FOR UPDATE")) pool = pool.sort((a, b) => b.expiresAt - a.expiresAt);
      const row = pool[0];
      return { rows: row ? [{ id: row.id, quantity: row.quantity }] : [] };
    }
    if (s.startsWith("SELECT variant_id, quantity, status FROM stock_reservation")) {
      const row = reservations.find((r) => r.id === params[0]);
      return {
        rows: row
          ? [{ variant_id: row.variant_id, quantity: row.quantity, status: row.status }]
          : [],
      };
    }
    if (s.startsWith("SELECT id, variant_id, quantity FROM stock_reservation")) {
      return {
        rows: reservations
          .filter((r) => r.order_id === params[0] && r.status === "consumed")
          .map((r) => ({ id: r.id, variant_id: r.variant_id, quantity: r.quantity })),
      };
    }

    // -- stock_reservation writes -------------------------------------------
    // TTL refresh for an idempotent re-reserve.
    if (s.startsWith("UPDATE stock_reservation SET expires_at")) {
      const [id, , ttl] = params;
      const row = reservations.find((r) => r.id === id);
      if (row) row.expiresAt = nowMs + ttl * 1000;
      return { rows: [] };
    }
    // Link consumed holds to a real order id.
    if (s.startsWith("UPDATE stock_reservation SET order_id")) {
      const [orderId, ids] = params;
      const set = new Set<string>(ids ?? []);
      for (const r of reservations) if (set.has(r.id)) r.order_id = orderId;
      return { rows: [] };
    }
    // Status transitions.
    if (s.startsWith("UPDATE stock_reservation SET status = 'consumed'")) {
      const row = reservations.find((r) => r.id === params[0] && r.status === "active");
      if (row) { row.status = "consumed"; row.order_id = params[1]; }
      return { rows: [] };
    }
    if (s.startsWith("UPDATE stock_reservation SET status = 'released'")) {
      const row = reservations.find((r) => r.id === params[0]);
      if (row) row.status = "released";
      return { rows: [] };
    }
    if (s.startsWith("UPDATE stock_reservation SET status = 'expired'")) {
      const expired = reservations.filter(
        (r) => r.status === "active" && r.expiresAt <= nowMs
      );
      for (const r of expired) r.status = "expired";
      return {
        rows: expired.map((r) => ({ id: r.id, variant_id: r.variant_id, quantity: r.quantity })),
      };
    }
    // INSERT reservation — THIS is where migration 009's partial unique index
    // is enforced: at most one ACTIVE hold per (variant_id, cart_id).
    if (s.startsWith("INSERT INTO stock_reservation")) {
      const [vid, cart, qty] = params;
      const hasOrder = s.includes("order_id");
      const ttl = (hasOrder ? params[4] : params[3]) ?? 900;

      const clash = reservations.some(
        (r) => r.variant_id === vid && r.cart_id === cart && r.status === "active"
      );
      if (clash) {
        throw dbError(
          "23505",
          "duplicate key value violates unique constraint uq_stock_reservation_active_cart"
        );
      }
      const res: Res = {
        id: `r${++seq}`,
        variant_id: vid,
        cart_id: cart,
        quantity: qty,
        status: "active",
        order_id: hasOrder ? params[3] : null,
        expiresAt: nowMs + ttl * 1000,
      };
      reservations.push(res);
      return { rows: [{ id: res.id }] };
    }

    // -- variant_stock writes ------------------------------------------------
    if (s.startsWith("UPDATE variant_stock SET reserved = reserved +")) {
      const st = stocks.get(params[0]);
      if (st) { st.reserved += params[1]; assertNoOversell(st); }
      return { rows: [] };
    }
    if (s.startsWith("UPDATE variant_stock SET reserved = reserved -")) {
      const st = stocks.get(params[0]);
      if (st) {
        st.reserved = Math.max(0, st.reserved - params[1]);
        st.sold += params[1];
        assertNoOversell(st);
      }
      return { rows: [] };
    }
    if (s.startsWith("UPDATE variant_stock SET reserved = GREATEST(0, reserved -")) {
      const st = stocks.get(params[0]);
      if (st) st.reserved = Math.max(0, st.reserved - params[1]);
      return { rows: [] };
    }
    if (s.startsWith("UPDATE variant_stock SET sold = GREATEST(0, sold -")) {
      const st = stocks.get(params[0]);
      if (st) st.sold = Math.max(0, st.sold - params[1]);
      return { rows: [] };
    }
    if (s.startsWith("INSERT INTO variant_stock (variant_id, on_hand, reserved, sold)")) {
      const [vid, onHand] = params;
      const existing = stocks.get(vid);
      if (existing) {
        existing.on_hand = onHand;
        assertNoOversell(existing);
      } else {
        stocks.set(vid, { variant_id: vid, on_hand: onHand, reserved: 0, sold: 0 });
      }
      return { rows: [rowFor(stocks.get(vid)!)] };
    }

    // -- PAY-01 single-use payment claim (duplicate order guard) -------------
    if (s.startsWith("INSERT INTO processed_payments")) {
      const [paymentId, , , orderId] = params;
      if (processedPayments.has(paymentId)) return { rows: [] };
      processedPayments.set(paymentId, orderId);
      return { rows: [{ order_id: orderId }] };
    }

    throw new Error(`Unhandled SQL in fake executor: ${s}`);
  }

  async function fakeTransaction<T>(fn: (client: any) => Promise<T>): Promise<T> {
    // Serialise transactions — models a FOR UPDATE lock on one hot stock row.
    const previous = lock;
    let release!: () => void;
    lock = new Promise<void>((res) => { release = res; });
    await previous;
    begin();
    try {
      const client = { query: async (sql: string, params: any[] = []) => dispatch(sql, params) };
      const result = await fn(client);
      commit();
      return result;
    } catch (err) {
      rollback();
      throw err;
    } finally {
      release();
    }
  }

  async function fakeQuery(sql: string, params: any[] = []) {
    return (await dispatch(sql, params)).rows;
  }

  function reset() {
    stocks = new Map();
    reservations = [];
    processedPayments = new Map();
    seq = 0;
    nowMs = 1_700_000_000_000;
    lock = Promise.resolve();
    snapshot = null;
  }

  return {
    reset,
    fakeQuery,
    fakeTransaction,
    setNow: (ms: number) => { nowMs = ms; },
    advance: (ms: number) => { nowMs += ms; },
    seedStock: (s: Stock) => { stocks.set(s.variant_id, { ...s }); },
    seedReservation: (r: Partial<Res> & { variant_id: string; cart_id: string; quantity: number }) => {
      const res: Res = {
        id: r.id ?? `r${++seq}`,
        variant_id: r.variant_id,
        cart_id: r.cart_id,
        quantity: r.quantity,
        status: r.status ?? "active",
        order_id: r.order_id ?? null,
        expiresAt: r.expiresAt ?? nowMs + 900_000,
      };
      reservations.push(res);
      return res;
    },
    activeReservations: () =>
      reservations.filter((r) => r.status === "active" && r.expiresAt > nowMs),
    reservationsWithStatus: (status: string) => reservations.filter((r) => r.status === status),
    allReservations: () => reservations.slice(),
    stockOf: (id: string) => stocks.get(id),
    paymentClaims: () => processedPayments.size,
  };
});

vi.mock("../lib/db", () => ({
  query: (...args: any[]) => h.fakeQuery(args[0], args[1] ?? []),
  transaction: (fn: any) => h.fakeTransaction(fn),
}));

import {
  RESERVATION_TTL_SECONDS,
  availableStock,
  reserveStock,
  consumeReservation,
  releaseReservation,
  releaseExpiredReservations,
  restoreSoldForOrder,
  initialiseStock,
} from "../lib/inventory";

const root = join(__dirname, "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

/** Model of the PAY-01 claim + consume that builds an order from a paid cart. */
async function createOrderForPayment(paymentId: string, cartId: string, variantId: string) {
  const proposedOrderId = `order-${paymentId}`;
  const rows = await h.fakeQuery(
    "INSERT INTO processed_payments (payment_id, cart_id, razorpay_order_id, order_id) " +
      "VALUES ($1, $2, $3, $4) ON CONFLICT (payment_id) DO NOTHING RETURNING order_id",
    [paymentId, cartId, `rzp_${paymentId}`, proposedOrderId]
  );
  if (!rows.length) return null; // duplicate claim → no second order
  const result = await consumeReservation({ variantId, cartId, orderId: proposedOrderId });
  return result.ok ? proposedOrderId : null;
}

beforeEach(() => {
  h.reset();
});

/* ─────────────────────────────────────────────────────────────────────────── */

describe("R1 — duplicate reservation requests are idempotent", () => {
  it("re-reserving the same (variant, cart) returns the same hold and never double-counts", async () => {
    await initialiseStock("v", 2);
    const first = await reserveStock({ variantId: "v", cartId: "cart-A" });
    const second = await reserveStock({ variantId: "v", cartId: "cart-A" });

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(second.reservationId).toBe(first.reservationId);
    expect(h.activeReservations()).toHaveLength(1);
    expect(h.stockOf("v")!.reserved).toBe(1);
  });

  it("the partial UNIQUE(variant_id,cart_id) WHERE active index blocks a duplicate INSERT", async () => {
    await initialiseStock("v", 5);
    await reserveStock({ variantId: "v", cartId: "cart-A" });

    // Bypass the application idempotency SELECT and issue a raw INSERT. The DB
    // constraint (modelled in the fake) must reject it — this is the backstop
    // that a non-unique btree index could not provide.
    await expect(
      h.fakeQuery(
        "INSERT INTO stock_reservation (variant_id, cart_id, quantity, status, expires_at) " +
          "VALUES ($1, $2, $3, 'active', now() + ($4 * interval '1 second')) RETURNING id",
        ["v", "cart-A", 1, RESERVATION_TTL_SECONDS]
      )
    ).rejects.toMatchObject({ code: "23505" });

    expect(h.activeReservations()).toHaveLength(1);
  });
});

describe("R2 — concurrent single-stock purchase (one-of-a-one)", () => {
  it("exactly one of two overlapping buyers reserves the single unit", async () => {
    await initialiseStock("one-of-one", 1);
    const [a, b] = await Promise.all([
      reserveStock({ variantId: "one-of-one", cartId: "buyer-A" }),
      reserveStock({ variantId: "one-of-one", cartId: "buyer-B" }),
    ]);

    expect([a, b].filter((r) => r.ok)).toHaveLength(1);
    expect([a, b].find((r) => !r.ok)).toMatchObject({ ok: false, tracked: true, reason: "insufficient" });
    expect(h.activeReservations()).toHaveLength(1);
    expect(h.stockOf("one-of-one")!.reserved).toBe(1);
    // One-of-one rule preserved: never two active holds for the single work.
    expect(availableStock(h.stockOf("one-of-one")!)).toBe(0);
  });
});

describe("R3 — concurrent multi-stock reservations are NOT blocked", () => {
  it("N units allow N different carts to hold concurrently, one line each", async () => {
    await initialiseStock("made-to-order", 3);
    const results = await Promise.all(
      ["c1", "c2", "c3", "c4", "c5"].map((cartId) =>
        reserveStock({ variantId: "made-to-order", cartId })
      )
    );

    expect(results.filter((r) => r.ok)).toHaveLength(3);
    expect(results.filter((r) => !r.ok).every((r) => r.reason === "insufficient")).toBe(true);
    expect(h.activeReservations()).toHaveLength(3);
    expect(new Set(h.activeReservations().map((r) => r.cart_id)).size).toBe(3);
    expect(h.stockOf("made-to-order")!.reserved).toBe(3);
    // The CHECK safeguard holds: reserved + sold (3 + 0) <= on_hand (3).
    expect(availableStock(h.stockOf("made-to-order")!)).toBe(0);
  });

  it("a single cart still cannot grab two lines on a multi-unit variant", async () => {
    await initialiseStock("v", 10);
    await reserveStock({ variantId: "v", cartId: "cart-A", quantity: 2 });
    await reserveStock({ variantId: "v", cartId: "cart-A", quantity: 2 });
    expect(h.activeReservations()).toHaveLength(1);
    expect(h.activeReservations()[0].quantity).toBe(2);
    expect(h.stockOf("v")!.reserved).toBe(2);
  });
});

describe("R4 — reservation expiry", () => {
  it("an expired hold is swept, stock released, and a new buyer can reserve", async () => {
    await initialiseStock("ttl", 1);
    const res = await reserveStock({ variantId: "ttl", cartId: "buyer-A" });
    expect(res.ok).toBe(true);
    expect(h.activeReservations()).toHaveLength(1);

    h.advance(RESERVATION_TTL_SECONDS * 1000 + 1);
    expect(h.activeReservations()).toHaveLength(0); // expired by clock

    expect(await releaseExpiredReservations()).toBe(1);
    expect(h.reservationsWithStatus("expired")).toHaveLength(1);
    expect(h.stockOf("ttl")!.reserved).toBe(0);

    const again = await reserveStock({ variantId: "ttl", cartId: "buyer-B" });
    expect(again.ok).toBe(true);
    expect(h.stockOf("ttl")!.reserved).toBe(1);
  });

  it("an expired-but-unswept hold is a documented 23505 edge, recoverable by the sweep", async () => {
    await initialiseStock("ttl", 2);
    const res = await reserveStock({ variantId: "ttl", cartId: "buyer-A" });
    h.advance(RESERVATION_TTL_SECONDS * 1000 + 1); // now expired, not yet swept

    // Application SELECT filters expires_at > now() so it does NOT see the old
    // row and attempts a fresh INSERT — the partial index rejects it (23505).
    await expect(reserveStock({ variantId: "ttl", cartId: "buyer-A" })).rejects.toMatchObject({
      code: "23505",
    });
    // No stock was leaked: the failed transaction rolled back its increment.
    expect(h.stockOf("ttl")!.reserved).toBe(1);

    // Forward recovery: sweep makes the row non-active, retry succeeds.
    await releaseExpiredReservations();
    const retry = await reserveStock({ variantId: "ttl", cartId: "buyer-A" });
    expect(retry.ok).toBe(true);
    expect(h.stockOf("ttl")!.reserved).toBe(1);
    expect(res.reservationId).toBeTruthy();
  });
});

describe("R5 — reservation release", () => {
  it("releaseReservation marks released and returns stock to availability", async () => {
    await initialiseStock("v", 1);
    const res = await reserveStock({ variantId: "v", cartId: "cart-A" });
    await releaseReservation(res.reservationId!);

    expect(h.reservationsWithStatus("released")).toHaveLength(1);
    expect(h.activeReservations()).toHaveLength(0);
    expect(h.stockOf("v")!.reserved).toBe(0);
    expect(availableStock(h.stockOf("v")!)).toBe(1);

    const other = await reserveStock({ variantId: "v", cartId: "cart-B" });
    expect(other.ok).toBe(true);
  });

  it("restoreSoldForOrder reverses a consumed sale on cancellation/refund", async () => {
    await initialiseStock("v", 1);
    await reserveStock({ variantId: "v", cartId: "cart-A" });
    await consumeReservation({ variantId: "v", cartId: "cart-A", orderId: "o1" });
    expect(h.stockOf("v")!.sold).toBe(1);

    expect(await restoreSoldForOrder("o1")).toBe(1);
    expect(h.stockOf("v")!.sold).toBe(0);
    expect(h.reservationsWithStatus("released")).toHaveLength(1);
  });
});

describe("R6 — checkout retry is safe (no double consume)", () => {
  it("retrying consume after success does not sell the unit twice", async () => {
    await initialiseStock("v", 1);
    await reserveStock({ variantId: "v", cartId: "cart-A" });
    const first = await consumeReservation({ variantId: "v", cartId: "cart-A", orderId: "o1" });
    const retry = await consumeReservation({ variantId: "v", cartId: "cart-A", orderId: "o1" });

    expect(first.ok).toBe(true);
    expect(retry).toMatchObject({ ok: false, tracked: true, reason: "no_reservation" });
    expect(h.stockOf("v")!.sold).toBe(1);
    expect(h.stockOf("v")!.reserved).toBe(0);
    expect(h.reservationsWithStatus("consumed")).toHaveLength(1);
  });
});

describe("R7 — payment failure releases the hold", () => {
  it("a failed payment releases the reservation without consuming stock", async () => {
    await initialiseStock("v", 1);
    const res = await reserveStock({ variantId: "v", cartId: "cart-A" });
    await releaseReservation(res.reservationId!); // payment failed → release

    expect(h.stockOf("v")!.sold).toBe(0);
    expect(h.stockOf("v")!.reserved).toBe(0);
    expect(h.activeReservations()).toHaveLength(0);
  });
});

describe("R8 — payment success consumes exactly one reservation", () => {
  it("consumeReservation binds the order and moves reserved→sold atomically", async () => {
    await initialiseStock("v", 1);
    const res = await reserveStock({ variantId: "v", cartId: "cart-A" });
    const consumed = await consumeReservation({ variantId: "v", cartId: "cart-A", orderId: "o-ok" });

    expect(consumed.ok).toBe(true);
    expect(consumed.reservationId).toBe(res.reservationId);
    const row = h.allReservations()[0];
    expect(row.status).toBe("consumed");
    expect(row.order_id).toBe("o-ok");
    expect(h.stockOf("v")!.sold).toBe(1);
    expect(h.stockOf("v")!.reserved).toBe(0);
  });

  it("legacy cart (no prior reservation) reserve-and-consume still works under the new constraints", async () => {
    await initialiseStock("v", 1);
    const first = await consumeReservation({ variantId: "v", cartId: "buyer-A", orderId: "o1" });
    const second = await consumeReservation({ variantId: "v", cartId: "buyer-B", orderId: "o2" });

    expect(first.ok).toBe(true);
    expect(second).toMatchObject({ ok: false, tracked: true, reason: "no_reservation" });
    expect(h.stockOf("v")!.sold).toBe(1);
    expect(h.stockOf("v")!.reserved).toBe(0);
    expect(h.reservationsWithStatus("consumed")).toHaveLength(1);
  });
});

describe("R9 — duplicate order creation attempts", () => {
  it("a replayed payment claim mints exactly one order and consumes one hold", async () => {
    await initialiseStock("v", 1);
    await reserveStock({ variantId: "v", cartId: "cart-A" });

    const [a, b] = await Promise.all([
      createOrderForPayment("pay-1", "cart-A", "v"),
      createOrderForPayment("pay-1", "cart-A", "v"),
    ]);

    const winners = [a, b].filter((v) => v !== null);
    expect(winners).toHaveLength(1); // exactly one order id minted
    expect(winners[0]).toBe("order-pay-1");
    expect([a, b].filter((v) => v === null)).toHaveLength(1); // one replay rejected
    expect(h.paymentClaims()).toBe(1);
    expect(h.reservationsWithStatus("consumed")).toHaveLength(1);
    expect(h.stockOf("v")!.sold).toBe(1);
  });
});

/* ─────────────────────────────────────────────────────────────────────────── */

describe("GAP-06 — migration 009 static contract", () => {
  const migration = read("db/migrations/009_reservation_hardening.sql");
  // Strip comment lines so prose (e.g. "UNIQUE(variant_id)" in the rationale,
  // or "DROP" in the recovery note) cannot satisfy / spoil a DDL assertion.
  const sqlOnly = migration
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n");

  it("exists with a partial UNIQUE index on (variant_id, cart_id) WHERE active", () => {
    expect(sqlOnly).toMatch(/CREATE UNIQUE INDEX IF NOT EXISTS/);
    expect(sqlOnly).toMatch(/\(variant_id, cart_id\)/);
    expect(sqlOnly).toMatch(/WHERE status = 'active'/);
  });

  it("does NOT add a global UNIQUE(variant_id) that would block multi-unit variants", () => {
    expect(sqlOnly).not.toMatch(/UNIQUE\s*\(\s*variant_id\s*\)/);
    expect(sqlOnly).not.toMatch(/UNIQUE\s*\(\s*variant_id\s*,[^)]*status/);
  });

  it("is additive/idempotent and documents forward recovery", () => {
    expect(sqlOnly).not.toMatch(/\b(DROP|DELETE|TRUNCATE|UPDATE)\b/);
    expect(migration.toLowerCase()).toMatch(/forward recovery/);
    expect(sqlOnly).toMatch(/NOT VALID/);
  });

  it("the existing qa-concurrent-inventory static assertion still holds for schema.sql", () => {
    const schemaSql = read("db/schema.sql");
    // We deliberately did NOT edit schema.sql (owned by A08): its non-unique
    // index remains, and the existing suite's assertion is not weakened.
    expect(schemaSql).toMatch(/CREATE INDEX IF NOT EXISTS idx_stock_reservation_active/);
    expect(schemaSql).not.toMatch(/CREATE UNIQUE INDEX[^\n]*stock_reservation/);
  });
});
