import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * AGENT A74 (QA) — Scenario D: concurrent overselling prevention.
 *
 * HONESTY NOTE — what this file does and does not prove.
 *
 * The real guarantee in `lib/inventory.ts` is a Postgres row lock:
 * `SELECT ... FROM variant_stock WHERE variant_id = $1 FOR UPDATE` inside a
 * `transaction()`, followed by the pure `canReserve()` availability check and
 * an atomic `UPDATE ... reserved = reserved + $2`. There is **no** DB-level
 * UNIQUE constraint on active reservations in `schema.sql` (only a NON-unique
 * btree index), and a literal UNIQUE(variant_id) would be wrong anyway because
 * multi-unit variants must allow N concurrent holds for N units. So this file:
 *
 *   - mocks `@/lib/db` with a deterministic fake executor that models the
 *     FOR UPDATE row lock by SERIALISING transactions on the single hot row,
 *     then runs the REAL exported inventory functions against a write buffer
 *     with commit/rollback semantics;
 *   - proves, at the model layer, that for one available unit exactly one of
 *     two overlapping reservation attempts wins and the loser gets an accurate
 *     typed OUT_OF_STOCK (`reason: "insufficient"`) result, never a generic
 *     error;
 *   - proves TTL/expiry stock release and non-negative clamping;
 *   - statically asserts the SQL / CHECK constraints that back the design.
 *
 * NOT proven here (needs a real Postgres concurrency run, owner-gated stack):
 * actual MVCC lock contention, deadlock/lock-wait behaviour, and performance
 * under true simultaneous connections. A hypothetical UNIQUE guard is modeled
 * in ONE clearly-labelled test to answer the task's "unique constraint" framing;
 * it is NOT part of the shipped design (see static assertions).
 */

const BASE_NOW = 1_700_000_000_000;

const h = vi.hoisted(() => {
  interface Stock {
    variant_id: string;
    on_hand: number;
    reserved: number;
    sold: number;
  }
  interface Res {
    id: string;
    variant_id: string;
    cart_id: string;
    quantity: number;
    status: string;
    order_id: string | null;
    expiresAt: number;
  }

  let stocks = new Map<string, Stock>();
  let reservations: Res[] = [];
  let seq = 0;
  let nowMs = 1_700_000_000_000;
  let enforceUniqueActivePerVariant = false;
  let lock: Promise<void> = Promise.resolve();
  let snapshot: { stocks: Map<string, Stock>; reservations: Res[] } | null = null;

  function rowFor(s: Stock) {
    return {
      variant_id: s.variant_id,
      on_hand: s.on_hand,
      reserved: s.reserved,
      sold: s.sold,
    };
  }
  function stockOf(id: string): Stock | undefined {
    return stocks.get(id);
  }
  function begin() {
    snapshot = {
      stocks: new Map([...stocks].map(([k, v]) => [k, { ...v }])),
      reservations: reservations.map((r) => ({ ...r })),
    };
  }
  function commit() {
    snapshot = null;
  }
  function rollback() {
    if (snapshot) {
      stocks = snapshot.stocks;
      reservations = snapshot.reservations;
      snapshot = null;
    }
  }

  async function dispatch(sql: string, params: any[]): Promise<{ rows: any[] }> {
    const s = sql.replace(/\s+/g, " ").trim();

    if (s === "BEGIN") { begin(); return { rows: [] }; }
    if (s === "COMMIT") { commit(); return { rows: [] }; }
    if (s === "ROLLBACK") { rollback(); return { rows: [] }; }

    // SELECT variant_stock (findStock FOR UPDATE, getStock, queryInventory)
    if (s.startsWith("SELECT variant_id, on_hand, reserved, sold FROM variant_stock ORDER BY")) {
      return {
        rows: [...stocks.values()]
          .sort((a, b) => a.variant_id.localeCompare(b.variant_id))
          .map(rowFor),
      };
    }
    if (s.startsWith("SELECT variant_id, on_hand, reserved, sold FROM variant_stock")) {
      const row = stockOf(params[0]);
      return { rows: row ? [rowFor(row)] : [] };
    }

    // SELECT active reservation for a cart (reserveStock / consumeReservation)
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

    // SELECT reservation for release / restore
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

    // TTL refresh (idempotent re-reserve)
    if (s.startsWith("UPDATE stock_reservation SET expires_at")) {
      const [id, , ttl] = params;
      const row = reservations.find((r) => r.id === id);
      if (row) row.expiresAt = nowMs + ttl * 1000;
      return { rows: [] };
    }

    // Stock counter arithmetic
    if (s.startsWith("UPDATE variant_stock SET reserved = reserved +")) {
      const st = stockOf(params[0]);
      if (st) st.reserved += params[1];
      return { rows: [] };
    }
    if (s.startsWith("UPDATE variant_stock SET reserved = reserved -")) {
      const st = stockOf(params[0]);
      if (st) {
        st.reserved = Math.max(0, st.reserved - params[1]);
        st.sold += params[1];
      }
      return { rows: [] };
    }
    if (s.startsWith("UPDATE variant_stock SET reserved = GREATEST(0, reserved -")) {
      const st = stockOf(params[0]);
      if (st) st.reserved = Math.max(0, st.reserved - params[1]);
      return { rows: [] };
    }
    if (s.startsWith("UPDATE variant_stock SET sold = GREATEST(0, sold -")) {
      const st = stockOf(params[0]);
      if (st) st.sold = Math.max(0, st.sold - params[1]);
      return { rows: [] };
    }

    // Reservation status transitions
    if (s.startsWith("UPDATE stock_reservation SET status = 'consumed'")) {
      const row = reservations.find((r) => r.id === params[0] && r.status === "active");
      if (row) {
        row.status = "consumed";
        row.order_id = params[1];
      }
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

    // INSERT stock_reservation (reserveStock has no order_id; consume does)
    if (s.startsWith("INSERT INTO stock_reservation")) {
      const [vid, cart, qty] = params;
      const hasOrder = s.includes("order_id");
      const ttl = (hasOrder ? params[4] : params[3]) ?? 900;
      if (enforceUniqueActivePerVariant) {
        const clash = reservations.find(
          (r) => r.variant_id === vid && r.status === "active" && r.expiresAt > nowMs
        );
        if (clash) {
          const err: any = new Error("duplicate key value violates unique constraint");
          err.code = "23505";
          throw err;
        }
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

    // initialiseStock upsert
    if (s.startsWith("INSERT INTO variant_stock (variant_id, on_hand, reserved, sold)")) {
      const [vid, onHand] = params;
      const existing = stockOf(vid);
      if (existing) existing.on_hand = onHand;
      else stocks.set(vid, { variant_id: vid, on_hand: onHand, reserved: 0, sold: 0 });
      return { rows: [rowFor(stockOf(vid)!)] };
    }

    throw new Error(`Unhandled SQL in fake executor: ${s}`);
  }

  async function fakeTransaction<T>(fn: (client: any) => Promise<T>): Promise<T> {
    // Serialise transactions — this models a FOR UPDATE lock on ONE hot row.
    const previous = lock;
    let release!: () => void;
    lock = new Promise<void>((res) => { release = res; });
    await previous;
    begin();
    try {
      const client = {
        query: async (sql: string, params: any[] = []) => dispatch(sql, params),
      };
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
    seq = 0;
    lock = Promise.resolve();
    snapshot = null;
    nowMs = BASE_NOW;
    enforceUniqueActivePerVariant = false;
  }

  return {
    reset,
    fakeQuery,
    fakeTransaction,
    setNow: (ms: number) => { nowMs = ms; },
    advance: (ms: number) => { nowMs += ms; },
    setUnique: (v: boolean) => { enforceUniqueActivePerVariant = v; },
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
    allReservations: () => reservations.slice(),
    stockOf,
  };
});

vi.mock("../lib/db", () => ({
  query: (...args: any[]) => h.fakeQuery(args[0], args[1] ?? []),
  transaction: (fn: any) => h.fakeTransaction(fn),
}));

import {
  RESERVATION_TTL_SECONDS,
  availableStock,
  canReserve,
  reserveStock,
  consumeReservation,
  releaseReservation,
  releaseExpiredReservations,
  restoreSoldForOrder,
  initialiseStock,
} from "../lib/inventory";

const root = join(__dirname, "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

beforeEach(() => {
  h.reset();
});

describe("Scenario D — pure decision layer (no DB needed)", () => {
  it("availability is clamped at zero and never negative", () => {
    expect(availableStock({ variant_id: "v", on_hand: 1, reserved: 0, sold: 0 })).toBe(1);
    expect(availableStock({ variant_id: "v", on_hand: 1, reserved: 1, sold: 0 })).toBe(0);
    expect(availableStock({ variant_id: "v", on_hand: 1, reserved: 1, sold: 1 })).toBe(0);
    expect(availableStock({ variant_id: "v", on_hand: 2, reserved: 3, sold: 9 })).toBe(0);
  });

  it("a second buyer cannot reserve the one available unit; same buyer is idempotent", () => {
    const claimed = { variant_id: "v", on_hand: 1, reserved: 1, sold: 0 };
    expect(canReserve(claimed, 1)).toBe(false); // different buyer → OUT_OF_STOCK
    expect(canReserve(claimed, 1, 1)).toBe(true); // their own hold counts back
  });

  it("rejects non-positive / non-integer quantities", () => {
    const row = { variant_id: "v", on_hand: 5, reserved: 0, sold: 0 };
    expect(canReserve(row, 0)).toBe(false);
    expect(canReserve(row, -1)).toBe(false);
    expect(canReserve(row, 1.5)).toBe(false);
    expect(canReserve(row, 2)).toBe(true);
  });
});

describe("Scenario D — real reserveStock under a serialised (FOR UPDATE) fake executor", () => {
  it("two overlapping attempts for ONE unit: exactly one winner", async () => {
    await initialiseStock("one-of-one", 1);

    const [a, b] = await Promise.all([
      reserveStock({ variantId: "one-of-one", cartId: "buyer-A" }),
      reserveStock({ variantId: "one-of-one", cartId: "buyer-B" }),
    ]);

    const winners = [a, b].filter((r) => r.ok);
    expect(winners).toHaveLength(1);
    expect(winners[0].tracked).toBe(true);
    expect(winners[0].reservationId).toBeTruthy();

    const st = h.stockOf("one-of-one")!;
    expect(st.reserved).toBe(1);
    expect(st.sold).toBe(0);
    expect(h.activeReservations()).toHaveLength(1);
  });

  it("loser gets an accurate typed OUT_OF_STOCK result, not a generic error", async () => {
    await initialiseStock("one-of-one", 1);

    const [a, b] = await Promise.all([
      reserveStock({ variantId: "one-of-one", cartId: "buyer-A" }),
      reserveStock({ variantId: "one-of-one", cartId: "buyer-B" }),
    ]);
    const loser = a.ok ? b : a;

    // This is the module's OUT_OF_STOCK signal: ok=false + tracked=true +
    // reason="insufficient". It is a returned value, never a thrown/_generic_
    // error, and it is distinct from "not_tracked" and "no_reservation".
    expect(loser).toEqual({ ok: false, tracked: true, reason: "insufficient" });
    expect(loser).not.toBeInstanceOf(Error);
    expect(loser.reservationId).toBeUndefined();
    expect(Object.keys(loser).sort()).toEqual(["ok", "reason", "tracked"]);
  });

  it("allows exactly N winners for N units on a multi-unit variant", async () => {
    await initialiseStock("made-to-order", 2);

    const results = await Promise.all(
      ["c1", "c2", "c3"].map((cartId) =>
        reserveStock({ variantId: "made-to-order", cartId })
      )
    );
    expect(results.filter((r) => r.ok)).toHaveLength(2);
    expect(results.filter((r) => !r.ok).every((r) => r.reason === "insufficient")).toBe(true);
    expect(h.stockOf("made-to-order")!.reserved).toBe(2);
    expect(h.activeReservations()).toHaveLength(2);
  });

  it("MODELS A HYPOTHETICAL DB UNIQUE(variant_id) guard — not shipped (schema has none)", async () => {
    // Answers the "enforce a UNIQUE constraint" framing. This fake flag makes
    // INSERT reject a second active hold for the same variant with SQLSTATE
    // 23505; the transaction must roll back its reserved increment. The real
    // schema does NOT have this constraint — see the static assertions below.
    h.setUnique(true);
    await initialiseStock("one-of-one", 5);

    const first = await reserveStock({ variantId: "one-of-one", cartId: "buyer-A" });
    expect(first.ok).toBe(true);
    expect(h.stockOf("one-of-one")!.reserved).toBe(1);

    await expect(
      reserveStock({ variantId: "one-of-one", cartId: "buyer-B" })
    ).rejects.toMatchObject({ code: "23505" });

    // ROLLBACK restored the pre-transaction state: no leaked reservation.
    expect(h.stockOf("one-of-one")!.reserved).toBe(1);
    expect(h.activeReservations()).toHaveLength(1);
  });

  it("reserve-then-consume never double-sells the single unit (legacy-cart path)", async () => {
    await initialiseStock("one-of-one", 1);

    const first = await consumeReservation({
      variantId: "one-of-one", cartId: "buyer-A", orderId: "order-1",
    });
    const second = await consumeReservation({
      variantId: "one-of-one", cartId: "buyer-B", orderId: "order-2",
    });

    expect(first.ok).toBe(true);
    expect(second).toEqual({ ok: false, tracked: true, reason: "no_reservation" });
    const st = h.stockOf("one-of-one")!;
    expect(st.sold).toBe(1);
    expect(st.reserved).toBe(0);
    expect(availableStock(st)).toBe(0);
  });
});

describe("Scenario D — TTL and expiry release stock", () => {
  it("RESERVATION_TTL_SECONDS is the 15-minute checkout window", () => {
    expect(RESERVATION_TTL_SECONDS).toBe(15 * 60);
  });

  it("a reservation expires after its TTL and the sweep releases the hold", async () => {
    await initialiseStock("ttl-unit", 1);
    const res = await reserveStock({ variantId: "ttl-unit", cartId: "buyer-A" });
    expect(res.ok).toBe(true);
    expect(h.activeReservations()).toHaveLength(1);
    expect(h.stockOf("ttl-unit")!.reserved).toBe(1);

    // Move the clock past expires_at = reservedAt + TTL.
    h.advance(RESERVATION_TTL_SECONDS * 1000 + 1);
    expect(h.activeReservations()).toHaveLength(0); // expired by clock

    const swept = await releaseExpiredReservations();
    expect(swept).toBe(1);
    expect(h.allReservations()[0].status).toBe("expired");
    expect(h.stockOf("ttl-unit")!.reserved).toBe(0);

    // Stock is genuinely available again.
    const again = await reserveStock({ variantId: "ttl-unit", cartId: "buyer-B" });
    expect(again.ok).toBe(true);
    expect(h.stockOf("ttl-unit")!.reserved).toBe(1);
  });

  it("re-reserving the same cart is idempotent and refreshes the TTL", async () => {
    await initialiseStock("ttl-unit", 1);
    const first = await reserveStock({ variantId: "ttl-unit", cartId: "buyer-A", ttlSeconds: 10 });
    expect(first.ok).toBe(true);
    const reservationId = first.reservationId;

    h.advance(9_000);
    const again = await reserveStock({ variantId: "ttl-unit", cartId: "buyer-A", ttlSeconds: 100 });
    expect(again.ok).toBe(true);
    expect(again.reservationId).toBe(reservationId); // same hold, not a new one
    expect(h.activeReservations()).toHaveLength(1);
    expect(h.stockOf("ttl-unit")!.reserved).toBe(1); // never double-counted

    // Original 10s TTL would have lapsed at +10s; refreshed TTL survives +20s.
    h.advance(11_000);
    expect(h.activeReservations()).toHaveLength(1);
  });
});

describe("Scenario D — no negative stock possible", () => {
  it("releaseReservation clamps reserved at zero via GREATEST(0, ...)", async () => {
    // Contrived inconsistent seeded state: reservation exists, stock already 0.
    h.seedStock({ variant_id: "v", on_hand: 1, reserved: 0, sold: 0 });
    const r = h.seedReservation({ variant_id: "v", cart_id: "c", quantity: 5 });
    await releaseReservation(r.id);

    expect(h.stockOf("v")!.reserved).toBe(0);
    expect(h.allReservations()[0].status).toBe("released");
    expect(availableStock(h.stockOf("v")!)).toBe(1);
  });

  it("restoreSoldForOrder clamps sold at zero", async () => {
    h.seedStock({ variant_id: "v", on_hand: 1, reserved: 0, sold: 0 });
    h.seedReservation({ variant_id: "v", cart_id: "c", quantity: 3, status: "consumed", order_id: "o1" });

    const restored = await restoreSoldForOrder("o1");
    expect(restored).toBe(1);
    expect(h.stockOf("v")!.sold).toBe(0);
    expect(h.allReservations()[0].status).toBe("released");
  });
});

describe("Scenario D — static SQL / schema assertions backing the model", () => {
  const inventorySrc = read("lib/inventory.ts");
  const schemaSql = read("db/schema.sql");

  it("reserveStock and consumeReservation use FOR UPDATE row locks", () => {
    expect(inventorySrc).toMatch(/SELECT variant_id, on_hand, reserved, sold FROM variant_stock/);
    expect(inventorySrc).toMatch(/forUpdate \? "FOR UPDATE" : ""/);
    expect(inventorySrc).toMatch(/findStock\(client, input\.variantId, true\)/);
  });

  it("INSERT carries an expiring TTL driven by RESERVATION_TTL_SECONDS", () => {
    expect(inventorySrc).toMatch(/now\(\) \+ \(\$4 \* interval '1 second'\)/);
    expect(inventorySrc).toMatch(/input\.ttlSeconds \?\? RESERVATION_TTL_SECONDS/);
  });

  it("expiry sweep marks expired and releases holds with GREATEST(0, ...)", () => {
    expect(inventorySrc).toMatch(/status = 'expired'/);
    expect(inventorySrc).toMatch(/expires_at <= now\(\)/);
    expect(inventorySrc).toMatch(/reserved = GREATEST\(0, reserved - \$2\)/);
  });

  it("schema forbids negative stock and supports the reservation status lifecycle", () => {
    expect(schemaSql).toMatch(/CREATE TABLE IF NOT EXISTS variant_stock/);
    expect(schemaSql).toMatch(/on_hand integer NOT NULL CHECK \(on_hand >= 0\)/);
    expect(schemaSql).toMatch(/reserved integer NOT NULL DEFAULT 0 CHECK \(reserved >= 0\)/);
    expect(schemaSql).toMatch(/sold integer NOT NULL DEFAULT 0 CHECK \(sold >= 0\)/);
    expect(schemaSql).toMatch(/status IN \('active','consumed','released','expired'\)/);
    expect(schemaSql).toMatch(/expires_at timestamp without time zone NOT NULL/);
  });

  it("documents the real concurrency mechanism: non-unique index, NO UNIQUE active-reservation constraint", () => {
    // The task asked for a static assertion of a UNIQUE constraint on active
    // reservations. It does NOT exist in this schema — asserting it would be a
    // fabricated pass. The honest facts are asserted here instead:
    expect(schemaSql).toMatch(/CREATE INDEX IF NOT EXISTS idx_stock_reservation_active/);
    expect(schemaSql).toMatch(/ON stock_reservation USING btree \(variant_id, status, expires_at\)/);
    // No UNIQUE/partial-unique guard on active reservations exists:
    expect(schemaSql).not.toMatch(/CREATE UNIQUE INDEX[^\n]*stock_reservation/);
    expect(schemaSql).not.toMatch(/UNIQUE\s*\([^)]*\bstatus\b[^)]*\)/);
  });
});
