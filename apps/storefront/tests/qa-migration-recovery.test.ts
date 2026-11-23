import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Scenario J — migration and recovery readiness, verified honestly.
 *
 * These are PURE/STATIC checks. There is no running Postgres, Medusa or stack in
 * this environment, so nothing here claims a real restore happened. What this
 * file does is pin the static facts that make a restore *possible* and *safe* to
 * attempt in an isolated environment: the scripts exist and are wired together,
 * the drill cannot point at production by default, the migration set is additive
 * and ordered, the fresh-install path is documented, and no migration destroys
 * business data.
 *
 * A live restore is tracked separately as BLOCKED BY OWNER INPUT (stack + backup
 * destination); see docs/release/QA_BACKUP_RESTORE_REPORT.md.
 */

const repo = join(__dirname, "..", "..", "..");
const read = (rel: string) => readFileSync(join(repo, rel), "utf8");

const migrationsDir = join(repo, "apps", "storefront", "db", "migrations");
const EXPECTED_MIGRATIONS = [
  "002_partner_marketplace.sql",
  "003_marketplace_finance.sql",
  "004_payment_reconciliation.sql",
];

/** Drop SQL comments so prose can neither trigger nor hide a rule. */
const stripComments = (sql: string) =>
  sql.replace(/\/\*[\s\S]*?\*\//g, "").replace(/--[^\n]*/g, "");

const statements = (sql: string) =>
  stripComments(sql)
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);

describe("Scenario J — backup + restore-drill wiring (static)", () => {
  it("backup-db.sh exists and is an executable-style bash script", () => {
    const path = join(repo, "scripts", "backup-db.sh");
    expect(existsSync(path)).toBe(true);
    const source = read("scripts/backup-db.sh");
    expect(source.split("\n")[0]).toBe("#!/usr/bin/env bash");
    expect(source).toMatch(/pg_dump/);
  });

  it("restore-drill.sh exists and references the backup script", () => {
    const path = join(repo, "scripts", "restore-drill.sh");
    expect(existsSync(path)).toBe(true);
    const drill = read("scripts/restore-drill.sh");
    expect(drill.split("\n")[0]).toBe("#!/usr/bin/env bash");
    // The drill must name the dump-producing script so the recovery sequence is
    // discoverable from the script itself, not only from prose docs.
    expect(drill).toMatch(/backup-db\.sh/);
  });

  it("the drill defaults to a disposable scratch DB, never a production URL", () => {
    const drill = read("scripts/restore-drill.sh");

    // No hard-coded connection URI / production endpoint: connection details are
    // supplied by the environment at run time, not baked into the script.
    expect(drill).not.toMatch(/postgres(?:ql)?:\/\//i);
    expect(drill).not.toMatch(/@[a-z0-9.-]+\.(?:rds\.amazonaws|compute\.amazonaws|azure|cloudsql)/i);

    // The default target is a scratch database with a disposable suffix.
    expect(drill).toMatch(/RESTORE_DB:-medusa_restore_check/);
    expect(drill).toMatch(/SCRATCH=/);
    expect("medusa_restore_check").toMatch(/_check$|_drill$|_restore$/);

    // A guard refuses any target without the disposable suffix, so a copied
    // command or a stray RESTORE_DB=medusa cannot drop the live database.
    expect(drill).toMatch(/must end in _check, _drill or _restore/);

    // Reaching the live DB is an explicit, interactive disaster-recovery step.
    expect(drill).toMatch(/--force/);
    expect(drill).toMatch(/Type the database name to continue/);
  });

  it("the backup-then-drill recovery sequence is documented", () => {
    const doc = read("docs/BACKUPS.md");
    expect(doc).toMatch(/scripts\/backup-db\.sh/);
    expect(doc).toMatch(/scripts\/restore-drill\.sh/);
    // The documented order matters: take a verified dump, then prove it restores.
    expect(doc.indexOf("scripts/backup-db.sh")).toBeLessThan(
      doc.indexOf("scripts/restore-drill.sh", doc.indexOf("## The drill"))
    );
    expect(doc).toMatch(/never the live database/);
  });
});

describe("Scenario J — migrations 002-004 are additive and ordered", () => {
  it("exactly the expected migration files exist", () => {
    const sqlFiles = readdirSync(migrationsDir)
      .filter((f) => f.endsWith(".sql"))
      .sort();
    expect(sqlFiles).toEqual(EXPECTED_MIGRATIONS);
  });

  it("filenames form a strictly increasing numeric sequence", () => {
    const numbers = EXPECTED_MIGRATIONS.map((f) => parseInt(f.slice(0, 3), 10));
    expect(numbers).toEqual([2, 3, 4]);
    for (let i = 1; i < numbers.length; i++) {
      expect(numbers[i]).toBeGreaterThan(numbers[i - 1]);
    }
  });

  it("every DDL statement is additive (IF NOT EXISTS) and none is destructive", () => {
    let createCount = 0;
    for (const file of EXPECTED_MIGRATIONS) {
      const sql = stripComments(read(join("apps/storefront/db/migrations", file)));
      for (const stmt of statements(sql)) {
        if (/^CREATE\s+(UNIQUE\s+)?(TABLE|INDEX)\b/i.test(stmt)) {
          createCount++;
          expect(stmt, `${file}: ${stmt.slice(0, 70)}`).toMatch(/IF\s+NOT\s+EXISTS/i);
        }
        expect(stmt, `${file}: destructive DDL`).not.toMatch(
          /^(DROP|DELETE|TRUNCATE|ALTER)\b/i
        );
      }
    }
    expect(createCount).toBeGreaterThan(10); // not a vacuous pass
  });

  it("each migration declares itself additive in its header", () => {
    for (const file of EXPECTED_MIGRATIONS) {
      const header = read(join("apps/storefront/db/migrations", file)).split("\n").slice(0, 4).join("\n");
      expect(header, file).toMatch(/additive/i);
    }
  });
});

describe("Scenario J — fresh-install path is documented", () => {
  it("db/migrations documents schema.sql baseline + ordered additive migrations", () => {
    const guide = read("apps/storefront/db/migrations/README.md");
    expect(guide).toMatch(/fresh-install baseline/i);
    expect(guide).toMatch(/schema\.sql/);
    expect(guide).toMatch(/numeric filename order/i);
    expect(guide).toMatch(/additive migrations/i);
    // The documented recovery story: rollback is a restore, not a down-script.
    expect(guide).toMatch(/Rollback is a database restore/i);
    expect(guide).toMatch(/Recovery is forward/i);
  });

  it("the baseline schema file exists and contains no data-destroying statement", () => {
    expect(existsSync(join(repo, "apps", "storefront", "db", "schema.sql"))).toBe(true);
    const schema = stripComments(read("apps/storefront/db/schema.sql"));
    expect(schema).not.toMatch(/\bDROP\s+TABLE\b/i);
    expect(schema).not.toMatch(/\bDELETE\s+FROM\b/i);
    expect(schema).not.toMatch(/\bTRUNCATE\b/i);
    expect(schema).not.toMatch(/\bALTER\b[^;]*\bDROP\b/i);
    // The baseline does real DDL, with IF NOT EXISTS so a re-run is harmless.
    expect(schema).toMatch(/CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS/i);
  });
});

describe("Scenario J — no migration deletes business data", () => {
  it("migrations 002-004 contain no DROP/DELETE/TRUNCATE or destructive ALTER", () => {
    const destructive = [
      /\bDROP\s+TABLE\b/i,
      /\bDROP\s+COLUMN\b/i,
      /\bDELETE\s+FROM\b/i,
      /\bTRUNCATE\b/i,
      /\bALTER\s+TABLE\b[^;]*\bDROP\b/i,
    ];
    for (const file of EXPECTED_MIGRATIONS) {
      const sql = stripComments(read(join("apps/storefront/db/migrations", file)));
      for (const pattern of destructive) {
        expect(sql, `${file}: ${pattern}`).not.toMatch(pattern);
      }
    }
  });

  it("the migrations guide records the no-deletion invariant and its enforcement", () => {
    const guide = read("apps/storefront/db/migrations/README.md");
    expect(guide).toMatch(/No data is deleted/i);
    expect(guide).toMatch(/DROP TABLE/);
    expect(guide).toMatch(/DELETE FROM/);
    expect(guide).toMatch(/TRUNCATE/);
    expect(guide).toMatch(/migration-integrity\.test\.ts/);
  });
});
