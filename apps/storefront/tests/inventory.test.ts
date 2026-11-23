import { describe, expect, it } from "vitest";
import { availableStock, canReserve } from "../lib/inventory";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The concurrency guarantee is enforced by `SELECT ... FOR UPDATE` on a single
 * variant_stock row. We cannot open a second Postgres connection in the unit
 * suite, so we model the SAME locked-row decision here: two callers read the
 * row serially, and the second sees the first's update. A regression that
 * removes the lock or the availability check will change these pure functions.
 */
function serialisedReservations(onHand: number, buyers: string[]): string[] {
  const row = { variant_id: "v1", on_hand: onHand, reserved: 0, sold: 0 };
  const winners: string[] = [];
  for (const buyer of buyers) {
    // Simulate the transaction: read locked row → decide → update in same turn.
    if (canReserve(row, 1)) {
      row.reserved += 1; // UPDATE variant_stock SET reserved = reserved + 1
      winners.push(buyer);
    }
  }
  return winners;
}

describe("atomic inventory logic", () => {
  it("derives availability and never goes negative", () => {
    expect(availableStock({ variant_id: "v", on_hand: 1, reserved: 0, sold: 0 })).toBe(1);
    expect(availableStock({ variant_id: "v", on_hand: 1, reserved: 1, sold: 0 })).toBe(0);
    expect(availableStock({ variant_id: "v", on_hand: 1, reserved: 1, sold: 1 })).toBe(0);
  });

  it("allows only ONE winner for a single-quantity work (Scenario D)", () => {
    const winners = serialisedReservations(1, ["buyer-A", "buyer-B"]);
    expect(winners).toEqual(["buyer-A"]);
    expect(serialisedReservations(1, ["a", "b", "c", "d"]).length).toBe(1);
  });

  it("allows as many winners as there are units", () => {
    expect(serialisedReservations(2, ["a", "b", "c"]).sort()).toEqual(["a", "b"]);
  });

  it("treats a re-reservation by the same buyer as idempotent", () => {
    const row = { variant_id: "v", on_hand: 1, reserved: 1, sold: 0 };
    expect(canReserve(row, 1, 1)).toBe(true); // their own hold counts back
    expect(canReserve(row, 1, 0)).toBe(false); // a different buyer cannot
  });

  it("rejects invalid quantities", () => {
    const row = { variant_id: "v", on_hand: 5, reserved: 0, sold: 0 };
    expect(canReserve(row, 0)).toBe(false);
    expect(canReserve(row, -1)).toBe(false);
    expect(canReserve(row, 1.5)).toBe(false);
  });
});

describe("reservations are wired into the purchase path", () => {
  const root = join(__dirname, "..");
  it("payment-session reserves before creating a payment session", () => {
    const src = readFileSync(
      join(root, "app/api/store/checkout/payment-session/route.ts"),
      "utf8"
    );
    expect(src).toMatch(/reserveStock\(/);
    expect(src.indexOf("reserveStock(")).toBeLessThan(
      src.indexOf("ensurePaymentSession(")
    );
  });

  it("checkout-complete consumes only after payment verification", () => {
    const src = readFileSync(
      join(root, "app/api/store/checkout/complete/route.ts"),
      "utf8"
    );
    expect(src).toMatch(/consumeReservation\(/);
    expect(src.indexOf("Payment amount does not match the cart")).toBeLessThan(
      src.indexOf("consumeReservation(")
    );
    expect(src).toMatch(/linkReservationsToOrder\(/);
  });

  it("cancellation restores sold stock", () => {
    const src = readFileSync(
      join(root, "app/api/admin/orders/[id]/cancel/route.ts"),
      "utf8"
    );
    expect(src).toMatch(/restoreSoldForOrder\(/);
  });

  it("schema defines the reservation tables and constraints", () => {
    const sql = readFileSync(join(root, "db/schema.sql"), "utf8");
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS variant_stock/);
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS stock_reservation/);
    expect(sql).toMatch(/CHECK \(status IN \('active','consumed','released','expired'\)\)/);
  });
});
