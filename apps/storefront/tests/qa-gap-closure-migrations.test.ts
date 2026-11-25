/**
 * A10 INDEPENDENT QA — migrations 005-009 (static only).
 *
 * Independently verifies presence, additive/idempotent form, no history
 * deletion, forward-recovery notes, 005 order independence, and that the
 * migration test lists were updated to 005-009.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const app = join(__dirname, "..");
const readApp = (rel: string) => readFileSync(join(app, rel), "utf8");
const migrationsDir = join(app, "db", "migrations");
const readM = (f: string) => readFileSync(join(migrationsDir, f), "utf8");

const IDS = [
  "005_notification_retry",
  "006_role_namespacing",
  "007_refund_inventory",
  "008_finance_constraints",
  "009_reservation_hardening",
  "010_commercial_readiness_and_shipping",
];

describe("migrations 005-009 — presence and form", () => {
  it("all of 002-009 are present with the reserved names", () => {
    const files = readdirSync(migrationsDir).filter((f) => /^\d{3}_.*\.sql$/.test(f)).sort();
    expect(files).toEqual([
      "002_partner_marketplace.sql",
      "003_marketplace_finance.sql",
      "004_payment_reconciliation.sql",
      "005_notification_retry.sql",
      "006_role_namespacing.sql",
      "007_refund_inventory.sql",
      "008_finance_constraints.sql",
      "009_reservation_hardening.sql",
      "010_commercial_readiness_and_shipping.sql",
    ]);
  });

  it("each 005-009 migration is idempotent and has a forward-recovery note", () => {
    for (const id of IDS) {
      const src = readM(`${id}.sql`);
      expect(src, `${id} not idempotent`).toMatch(/IF NOT EXISTS/i);
      expect(src, `${id} missing forward-recovery note`).toMatch(/forward.recovery/i);
    }
  });

  it("no migration deletes or truncates business history (006 DROP CONSTRAINT is allowed)", () => {
    for (const id of IDS) {
      const stripped = readM(`${id}.sql`).replace(/--[^\n]*/g, "");
      expect(stripped, `${id} deletes data`).not.toMatch(/DROP TABLE|DELETE FROM|TRUNCATE/i);
    }
    // Only 006 touches a constraint, and only to widen a role CHECK.
    const m006 = readM("006_role_namespacing.sql");
    expect(m006).toMatch(/DROP CONSTRAINT/i);
    for (const other of IDS.filter((i) => i !== "006_role_namespacing")) {
      const stripped = readM(`${other}.sql`).replace(/--[^\n]*/g, "");
      expect(stripped, `${other} drops a constraint`).not.toMatch(/DROP CONSTRAINT/i);
    }
  });

  it("005 creates a compatible base table so it is order-independent", () => {
    const m = readM("005_notification_retry.sql");
    expect(m).toMatch(/CREATE TABLE IF NOT EXISTS "app_notification"/);
    expect(m).toMatch(/order independence/i);
  });
});

describe("migration test lists were updated to 005-009", () => {
  it("migration-integrity.test.ts lists 005-009", () => {
    const src = readApp("tests/migration-integrity.test.ts");
    for (const id of IDS) expect(src, `missing ${id}`).toContain(id);
  });

  it("qa-migration-recovery.test.ts lists 005-009", () => {
    const src = readApp("tests/qa-migration-recovery.test.ts");
    for (const id of IDS) expect(src, `missing ${id}`).toContain(`${id}.sql`);
  });
});
