/**
 * A10 INDEPENDENT QA — A06 reservation hardening (pure + static only).
 *
 * Independently pins the partial unique index (variant_id, cart_id) WHERE
 * status='active', the NOT VALID CHECK, migration 009 being additive, and the
 * application-side idempotency lookup + FOR UPDATE lock that the index backs.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { availableStock, canReserve } from "@/lib/inventory";

const app = join(__dirname, "..");
const read = (rel: string) => readFileSync(join(app, rel), "utf8");

describe("A06 — partial unique index in migration 009", () => {
  const m = () => read("db/migrations/009_reservation_hardening.sql");

  it("creates UNIQUE (variant_id, cart_id) only for active reservations", () => {
    const src = m();
    expect(src).toMatch(/CREATE UNIQUE INDEX IF NOT EXISTS uq_stock_reservation_active_cart/i);
    expect(src).toMatch(/ON public\.stock_reservation USING btree \(variant_id,\s*cart_id\)/i);
    expect(src).toMatch(/WHERE status = 'active'/i);
  });

  it("does NOT use the wrong UNIQUE(variant_id) scope", () => {
    const src = m().replace(/--[^\n]*/g, "");
    expect(src).not.toMatch(/UNIQUE\s*\(\s*variant_id\s*\)/i);
  });

  it("adds a NOT VALID oversell CHECK that is enforced for new writes", () => {
    const src = m();
    expect(src).toMatch(/ck_variant_stock_no_oversell/);
    expect(src).toMatch(/CHECK\s*\(\s*reserved \+ sold <= on_hand\s*\)/i);
    expect(src).toMatch(/NOT VALID/i);
  });

  it("009 is additive, idempotent and has a forward-recovery note", () => {
    const src = m();
    expect(src).toMatch(/IF NOT EXISTS/i);
    expect(src).toMatch(/forward recovery/i);
    const stripped = src.replace(/--[^\n]*/g, "");
    expect(stripped).not.toMatch(/DROP TABLE|DELETE FROM|TRUNCATE/i);
  });
});

describe("A06 — application-side reservation safety still present", () => {
  it("reserveStock uses FOR UPDATE + a scoped active idempotency lookup", () => {
    const src = read("lib/inventory.ts");
    expect(src).toMatch(/SELECT variant_id, on_hand, reserved, sold FROM variant_stock[\s\S]{0,80}FOR UPDATE/);
    expect(src).toMatch(
      /WHERE variant_id = \$1 AND cart_id = \$2 AND status = 'active' AND expires_at > now\(\)/i
    );
  });

  it("pure availability decision refuses oversell and treats same-buyer holds as idempotent", () => {
    const stock = { variant_id: "v-qa", on_hand: 1, reserved: 1, sold: 0 };
    expect(availableStock(stock)).toBe(0);
    expect(canReserve(stock, 1)).toBe(false);
    expect(canReserve(stock, 1, 1)).toBe(true); // same buyer already holds the unit
    expect(canReserve({ variant_id: "v", on_hand: 2, reserved: 0, sold: 0 }, 1)).toBe(true);
    expect(canReserve(stock, 0)).toBe(false);
  });
});
