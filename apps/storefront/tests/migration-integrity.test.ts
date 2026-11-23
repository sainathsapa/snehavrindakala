import { describe, it, expect } from "vitest";
import {
  checksum,
  listMigrationFiles,
  listPendingMigrations,
  applyMigrations,
  BOOKKEEPING_DDL,
  type QueryExecutor,
} from "@/db/migrate";

/**
 * Guards the migration runner and the migration files without a live database.
 *
 * The contract is the same one scripts/migrate.mjs enforces at deploy time:
 * migrations are additive, idempotent, numerically ordered, checksummed, and
 * each applied migration leaves exactly one checkpoint row. All of that is
 * exercised here through the typed wrapper with an in-memory executor.
 */

const files = listMigrationFiles();

/** Strip SQL comments so prose cannot trigger or hide a rule. */
const strip = (sql: string) =>
  sql.replace(/\/\*[\s\S]*?\*\//g, "").replace(/--[^\n]*/g, "");

const statements = (sql: string) =>
  strip(sql)
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);

interface FakeState {
  fresh?: boolean;
  appliedIds?: string[];
  appliedChecksums?: Record<string, string>;
}

/** In-memory QueryExecutor: records every statement and returns canned reads. */
function fakeExecutor(state: FakeState = {}) {
  const executed: Array<{ sql: string; params?: any[] }> = [];
  const executor: QueryExecutor = async (sql, params) => {
    executed.push({ sql, params });
    if (sql.includes("to_regclass")) return [{ exists: !state.fresh }];
    if (sql.includes("SELECT id, checksum")) {
      return (state.appliedIds ?? []).map((id) => ({
        id,
        checksum: state.appliedChecksums?.[id] ?? "stale",
        applied_at: new Date("2020-01-01T00:00:00Z"),
      }));
    }
    return [];
  };
  return { executor, executed };
}

describe("migration files", () => {
  it("discovers migrations 002-004 in numeric filename order", () => {
    expect(files.map((f) => f.id)).toEqual([
      "002_partner_marketplace",
      "003_marketplace_finance",
      "004_payment_reconciliation",
    ]);
    const orders = files.map((f) => f.order);
    expect([...orders].sort((a, b) => a - b)).toEqual(orders);
    for (let i = 1; i < orders.length; i++) {
      expect(orders[i]).toBeGreaterThan(orders[i - 1]);
    }
  });

  it("guards every CREATE with IF NOT EXISTS (idempotent)", () => {
    let createCount = 0;
    for (const file of files) {
      for (const stmt of statements(file.sql)) {
        if (/^CREATE\s+(UNIQUE\s+)?(TABLE|INDEX)\b/i.test(stmt)) {
          createCount++;
          expect(stmt, `${file.id}: ${stmt.slice(0, 80)}`).toMatch(/IF\s+NOT\s+EXISTS/i);
        }
      }
    }
    expect(createCount).toBeGreaterThan(10); // not a vacuous pass
  });

  it("allows DML only when it is safe to re-run (ON CONFLICT)", () => {
    for (const file of files) {
      for (const stmt of statements(file.sql)) {
        if (/^INSERT\b/i.test(stmt)) expect(stmt).toMatch(/ON\s+CONFLICT/i);
      }
    }
  });

  it("never drops, deletes or truncates business data", () => {
    for (const file of files) {
      const sql = strip(file.sql);
      expect(sql, `${file.id} DROP TABLE`).not.toMatch(/\bDROP\s+TABLE\b/i);
      expect(sql, `${file.id} DELETE FROM`).not.toMatch(/\bDELETE\s+FROM\b/i);
      expect(sql, `${file.id} TRUNCATE`).not.toMatch(/\bTRUNCATE\b/i);
    }
  });
});

describe("checksums", () => {
  it("matches stable sha256 vectors", () => {
    expect(checksum("")).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    );
    expect(checksum("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
    );
  });

  it("is deterministic, content-sensitive, and used for the files", () => {
    expect(files[0].checksum).toBe(checksum(files[0].sql));
    expect(files[0].checksum).toMatch(/^[a-f0-9]{64}$/);
    expect(checksum(files[0].sql)).toBe(checksum(files[0].sql));
    expect(checksum(files[0].sql)).not.toBe(checksum(files[1].sql));
  });
});

describe("runner checkpoints", () => {
  it("fresh DB: applies schema.sql once, then records one checkpoint per migration", async () => {
    const { executor, executed } = fakeExecutor({ fresh: true });
    const result = await applyMigrations(executor);

    expect(result.fresh).toBe(true);
    expect(result.schemaApplied).toBe(true);
    expect(result.applied.map((f) => f.id)).toEqual(files.map((f) => f.id));
    expect(result.skipped).toEqual([]);

    expect(executed.some((s) => s.sql === BOOKKEEPING_DDL)).toBe(true);
    expect(
      executed.filter((s) => s.sql.includes("CREATE TABLE IF NOT EXISTS admin_users"))
    ).toHaveLength(1);

    const checkpoints = executed.filter((s) =>
      s.sql.includes("INSERT INTO schema_migrations")
    );
    expect(checkpoints).toHaveLength(files.length);
    files.forEach((f, i) => {
      expect(checkpoints[i].params).toEqual([f.id, f.checksum]);
    });

    // Each migration's SQL ran before its checkpoint, in numeric order.
    const sqlPositions = files.map((f) => executed.findIndex((s) => s.sql === f.sql));
    expect(sqlPositions.every((p) => p >= 0)).toBe(true);
    expect([...sqlPositions].sort((a, b) => a - b)).toEqual(sqlPositions);
    files.forEach((f, i) => {
      const cp = executed.findIndex((s) => s.sql.includes("INSERT INTO schema_migrations") && s.params?.[0] === f.id);
      expect(cp).toBeGreaterThan(sqlPositions[i]);
    });
  });

  it("upgrade: already-recorded migrations are skipped and schema.sql is not re-applied", async () => {
    const ids = files.map((f) => f.id);
    const { executor, executed } = fakeExecutor({
      fresh: false,
      appliedIds: ids,
      appliedChecksums: Object.fromEntries(files.map((f) => [f.id, f.checksum])),
    });
    const result = await applyMigrations(executor);

    expect(result.fresh).toBe(false);
    expect(result.schemaApplied).toBe(false);
    expect(result.applied).toEqual([]);
    expect(result.skipped).toEqual(ids);
    expect(executed.some((s) => s.sql.includes("admin_users"))).toBe(false);
    expect(
      executed.filter((s) => s.sql.includes("INSERT INTO schema_migrations"))
    ).toHaveLength(0);
  });

  it("listPendingMigrations excludes ids already in the checkpoint table", () => {
    const pending = listPendingMigrations([files[0].id]);
    expect(pending.map((f) => f.id)).toEqual(files.slice(1).map((f) => f.id));
    expect(listPendingMigrations(files.map((f) => f.id))).toEqual([]);
  });
});
