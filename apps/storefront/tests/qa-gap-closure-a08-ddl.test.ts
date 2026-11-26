/**
 * A10 INDEPENDENT QA — A08 no runtime DDL (static only).
 *
 * Independently verifies the hard fail() gate in verify-schema.mjs, the absence
 * of DDL in handlers, that schema.sql + migrations 002-010 cover the tables,
 * and that EXPECTED_SCHEMA includes the 005-009 tables.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const app = join(__dirname, "..");
const repo = join(app, "..", "..");
const read = (rel: string) => readFileSync(join(app, rel), "utf8");

const DDL =
  /\b(?:CREATE\s+(?:UNIQUE\s+)?(?:TABLE|INDEX|TYPE)\b|ALTER\s+TABLE\b|ADD\s+COLUMN\b|DROP\s+(?:TABLE|COLUMN)\b)/i;

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(entry)) out.push(full);
  }
  return out;
}

function definedTables(sql: string): Set<string> {
  return new Set(
    [...sql.matchAll(/CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+(?:public\.)?"?([a-z_]+)"?\s*\(/gi)].map(
      (m) => m[1]
    )
  );
}

describe("A08 — verify-schema.mjs has a HARD fail() gate", () => {
  const verify = () => read("scripts/verify-schema.mjs");

  it("handler check calls fail(), never warn()/advisory, and the process exits non-zero", () => {
    const src = verify();
    const fn = src.match(/function checkHandlers\(\)\s*\{([\s\S]*?)\n\}/);
    expect(fn).not.toBeNull();
    expect(fn![1]).toMatch(/\bfail\(/);
    expect(fn![1]).not.toMatch(/\bwarn\(/);
    expect(src).not.toMatch(/function\s+warn\s*\(/);
    expect(src).not.toMatch(/advisory/i);
    expect(src).toMatch(/HARD check/i);
    expect(src).toMatch(/if \(failures\)/);
    expect(src).toMatch(/process\.exit\(1\)/);
  });

  it("EXPECTED_SCHEMA covers the 005-009 tables and 007 columns", () => {
    const src = verify();
    const expected = [...src.matchAll(/^  ([a-z_]+):\s*\[/gm)].map((m) => m[1]);
    for (const table of [
      "app_notification", "notification_event", "notification_suppression",
      "inventory_restoration_action", "inventory_movement", "refund_execution",
    ]) {
      expect(expected, `EXPECTED_SCHEMA missing ${table}`).toContain(table);
    }
    const refundBlock = src.match(/refund_execution:\s*\[([\s\S]*?)\],/)?.[1] ?? "";
    for (const column of [
      "inventory_restoration_state", "inventory_eligibility_reason",
      "inventory_restored_by", "inventory_restored_at", "inventory_restoration_key",
    ]) {
      expect(refundBlock, `refund_execution missing ${column}`).toContain(column);
    }
  });

  it("configures at least 28 high-traffic handlers, all present", () => {
    const src = verify();
    const block = src.match(/HIGH_TRAFFIC_HANDLERS\s*=\s*\[([\s\S]*?)\];/);
    expect(block).not.toBeNull();
    const handlers = [...block![1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
    expect(handlers.length).toBeGreaterThanOrEqual(28);
    for (const rel of handlers) expect(existsSync(join(app, rel)), `missing ${rel}`).toBe(true);
  });
});

describe("A08 — no DDL in handlers or lib, schema coverage is complete", () => {
  it("no CREATE/ALTER DDL remains in lib or app source", () => {
    const files = [...walk(join(app, "lib")), ...walk(join(app, "app"))];
    expect(files.length).toBeGreaterThan(20);
    const offenders = files
      .filter((f) => DDL.test(stripComments(readFileSync(f, "utf8"))))
      .map((f) => f.slice(app.length + 1));
    expect(offenders).toEqual([]);
  });

  it("schema.sql + the migrations define every EXPECTED_SCHEMA table", () => {
    const verify = read("scripts/verify-schema.mjs");
    const expected = [...verify.matchAll(/^  ([a-z_]+):\s*\[/gm)].map((m) => m[1]);
    const migrationsDir = join(app, "db", "migrations");
    const files = readdirSync(migrationsDir)
      .filter((f) => /^0\d{2}_.*\.sql$/.test(f))
      .sort();
    // One file per migration; the list is discovered, not pinned, so adding a
    // migration does not have to edit this test as well.
    expect(files.length).toBeGreaterThanOrEqual(9);
    const fromSql = definedTables(read("db/schema.sql"));
    for (const file of files) {
      for (const t of definedTables(readFileSync(join(migrationsDir, file), "utf8"))) {
        fromSql.add(t);
      }
    }
    for (const table of expected) {
      expect(fromSql.has(table), `no schema/migration coverage for ${table}`).toBe(true);
    }
  });
});
