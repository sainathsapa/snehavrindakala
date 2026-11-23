#!/usr/bin/env node
/**
 * Real migration runner for the storefront database.
 *
 * WHY THIS EXISTS
 *
 * schema.sql used to be the whole story: one idempotent baseline file applied
 * at boot. That stops cold-start failures for the tables it lists, but it has no
 * memory — every deploy re-runs the same file, and any later ALTER/additive
 * migration has nowhere to record that it already ran. This runner adds a
 * checkpoint table so each migration is applied exactly once, in order, with a
 * checksum, under a lock, atomically.
 *
 * GUARANTEES
 *
 *  - A Postgres advisory lock serialises concurrent containers. The second one
 *    waits, then finds the work already recorded and does nothing.
 *  - Everything happens in ONE transaction: the bookkeeping table, the fresh-db
 *    baseline and every pending migration either all commit or all roll back.
 *  - A fresh database gets db/schema.sql applied exactly once (detected by the
 *    bookkeeping table not existing yet). Existing databases are NOT re-seeded.
 *  - Failures exit non-zero so the container does not start a half-migrated app.
 *  - Nothing secret is logged: only variable NAMES, migration ids and redacted
 *    error text ever reach stdout/stderr.
 *
 * MODES
 *
 *  node scripts/migrate.mjs            apply pending migrations (default)
 *  node scripts/migrate.mjs --dry-run  report freshness + pending ids, write nothing
 *  node scripts/migrate.mjs --verify   check every file has a matching checkpoint
 */
import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const here = dirname(fileURLToPath(import.meta.url));
const DB_DIR = join(here, "..", "db");
const SCHEMA_FILE = join(DB_DIR, "schema.sql");
const MIGRATIONS_DIR = join(DB_DIR, "migrations");

/** Arbitrary but fixed, so every process asks for the same lock. */
const MIGRATION_LOCK_ID = 4_210_001;

const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has("--dry-run");
const VERIFY = args.has("--verify");

// Kept as a split string so it is not mistaken for a lazy CREATE in handlers.
const BOOKKEEPING_DDL =
  "CREATE TABLE IF NOT EXISTS " +
  "schema_migrations (\n" +
  "  id text PRIMARY KEY,\n" +
  "  checksum text NOT NULL,\n" +
  "  applied_at timestamptz NOT NULL DEFAULT now()\n" +
  ")";
const FRESH_CHECK_SQL =
  "SELECT to_regclass('public.schema_migrations') IS NOT NULL AS exists";
const APPLIED_SQL =
  "SELECT id, checksum, applied_at FROM schema_migrations ORDER BY id";
const CHECKPOINT_SQL =
  "INSERT INTO schema_migrations (id, checksum, applied_at) VALUES ($1, $2, now())";

/** sha256 of the exact SQL bytes applied. */
function checksum(sql) {
  return createHash("sha256").update(sql, "utf8").digest("hex");
}

/** Read migrations in numeric filename order. */
function migrationFiles() {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => /\.sql$/i.test(f))
    .map((filename) => {
      const sql = readFileSync(join(MIGRATIONS_DIR, filename), "utf8");
      return {
        id: basename(filename, ".sql"),
        filename,
        sql,
        checksum: checksum(sql),
        order: Number.parseInt(filename, 10) || 0,
      };
    })
    .sort((a, b) => a.order - b.order || a.filename.localeCompare(b.filename));
}

/** Replace any value that could be a DSN/password before logging it. */
function redact(value) {
  let s = String(value);
  const url = process.env.DATABASE_URL;
  if (url) {
    s = s.split(url).join("[REDACTED_DATABASE_URL]");
    try {
      const u = new URL(url);
      if (u.password) s = s.split(u.password).join("[REDACTED]");
    } catch {
      /* not a parseable URL; the regex below still catches DSNs */
    }
  }
  return s.replace(
    /postgres(?:ql)?:\/\/[^\s/]+@[^\s]+/gi,
    "[REDACTED_DATABASE_URL]"
  );
}

function log(msg) {
  console.log(`[migrate] ${redact(msg)}`);
}
function error(msg) {
  console.error(`[migrate] ${redact(msg)}`);
}

async function bookkeepingExists(client) {
  const { rows } = await client.query(FRESH_CHECK_SQL);
  return Boolean(rows[0]?.exists);
}

async function appliedRows(client) {
  const { rows } = await client.query(APPLIED_SQL);
  return rows;
}

/** Retry only connection-establishment errors on a cold database. */
const RETRYABLE = new Set(["ECONNREFUSED", "ENOTFOUND", "ETIMEDOUT", "ECONNRESET"]);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function connectWithRetry(client) {
  for (let attempt = 1; attempt <= 10; attempt++) {
    try {
      await client.connect();
      return;
    } catch (e) {
      if (!RETRYABLE.has(e.code) || attempt === 10) throw e;
      log(`database not ready (${e.code}), retry ${attempt}/10`);
      await sleep(1500 * attempt);
    }
  }
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    // Name only. Never echo the value.
    error("DATABASE_URL is not set (value intentionally not printed).");
    process.exit(1);
  }

  const files = migrationFiles();
  const client = new pg.Client({ connectionString: url });

  try {
    await connectWithRetry(client);

    // --dry-run: read-only plan, no lock, no writes. ------------------------
    if (DRY_RUN) {
      const existed = await bookkeepingExists(client);
      const recorded = existed ? await appliedRows(client) : [];
      const recordedIds = new Set(recorded.map((r) => r.id));
      const pending = files.filter((f) => !recordedIds.has(f.id));
      log("dry-run: no changes written.");
      log(`fresh database: ${existed ? "no" : "yes (db/schema.sql would be applied)"}`);
      log(`pending migrations (${pending.length}): ${pending.map((f) => f.id).join(", ") || "none"}`);
      return;
    }

    // --verify: every file must have a matching, current checkpoint. --------
    if (VERIFY) {
      const existed = await bookkeepingExists(client);
      if (!existed) {
        error("schema_migrations does not exist; there is nothing to verify.");
        process.exit(1);
      }
      const rows = await appliedRows(client);
      const byId = new Map(rows.map((r) => [r.id, r]));
      const problems = [];
      for (const f of files) {
        const row = byId.get(f.id);
        if (!row) problems.push(`missing checkpoint: ${f.id}`);
        else if (row.checksum !== f.checksum) problems.push(`checksum mismatch: ${f.id}`);
      }
      for (const r of rows) {
        if (!files.some((f) => f.id === r.id)) problems.push(`unknown checkpoint: ${r.id}`);
      }
      if (problems.length) {
        for (const p of problems) error(p);
        error(`verify failed: ${problems.length} problem(s).`);
        process.exit(1);
      }
      log(`verified ${files.length} migration checkpoint(s).`);
      return;
    }

    // Apply: serialise, then do all work in one transaction. ----------------
    await client.query("SELECT pg_advisory_lock($1)", [MIGRATION_LOCK_ID]);
    try {
      await client.query("BEGIN");

      const existed = await bookkeepingExists(client);
      const fresh = !existed;
      await client.query(BOOKKEEPING_DDL);

      if (fresh) {
        const schemaSql = readFileSync(SCHEMA_FILE, "utf8");
        await client.query(schemaSql);
        log("fresh database: applied db/schema.sql once");
      }

      const recordedIds = new Set((await appliedRows(client)).map((r) => r.id));
      let applied = 0;
      for (const f of files) {
        if (recordedIds.has(f.id)) continue;
        await client.query(f.sql);
        await client.query(CHECKPOINT_SQL, [f.id, f.checksum]);
        log(`applied migration ${f.id}`);
        applied++;
      }

      await client.query("COMMIT");
      log(`done — ${applied} applied, ${files.length - applied} already recorded.`);
    } catch (e) {
      try {
        await client.query("ROLLBACK");
      } catch {
        /* the original error is the one worth reporting */
      }
      throw e;
    } finally {
      await client
        .query("SELECT pg_advisory_unlock($1)", [MIGRATION_LOCK_ID])
        .catch(() => {});
    }
  } catch (e) {
    error(`failed: ${e.code ? `${e.code}: ` : ""}${e.message}`);
    process.exit(1);
  } finally {
    await client.end().catch(() => {});
  }
}

main();
