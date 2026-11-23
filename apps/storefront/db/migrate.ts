/**
 * Typed, testable core of the real migration runner.
 *
 * scripts/migrate.mjs is the production entry point (it owns the Postgres
 * connection, advisory lock and transaction). This module exposes the *logic*
 * as pure-ish functions so the integrity tests can exercise it without a live
 * database: checksums, ordering, pending selection and checkpoint recording.
 *
 * The semantics here mirror scripts/migrate.mjs exactly:
 *   1. Detect whether the bookkeeping table already existed (fresh DB?).
 *   2. Create `schema_migrations` if absent.
 *   3. On a fresh DB only, apply db/schema.sql once (baseline, no data).
 *   4. Apply every migration whose id is not yet recorded, and record
 *      id + sha256 checksum + applied_at for each one.
 */

import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** Minimal query shape shared with lib/partner/repository's QueryExecutor. */
export type QueryExecutor = (sql: string, params?: any[]) => Promise<any[]>;

export interface MigrationFile {
  /** Filename without the .sql suffix, e.g. "002_partner_marketplace". */
  id: string;
  filename: string;
  /** Raw SQL, used both for execution and for the checksum. */
  sql: string;
  /** sha256 of the exact SQL bytes applied. */
  checksum: string;
  /** Numeric prefix of the filename, used for stable ordering. */
  order: number;
}

export interface AppliedCheckpoint {
  id: string;
  checksum: string;
  applied_at: string | Date;
}

export interface MigrationRunResult {
  /** True when `schema_migrations` did not exist before this run. */
  fresh: boolean;
  /** True when db/schema.sql was applied (fresh DB only). */
  schemaApplied: boolean;
  /** Migrations applied during this run, in order. */
  applied: MigrationFile[];
  /** Migration ids that were already recorded and skipped. */
  skipped: string[];
}

export interface ApplyOptions {
  migrationsDir?: string;
  schemaFile?: string;
}

/** Resolve the db/ directory regardless of ESM/CJS or the caller's cwd. */
function resolveDbDir(): string {
  if (typeof __dirname !== "undefined") return __dirname;
  try {
    const u = import.meta.url;
    if (u) return dirname(fileURLToPath(u));
  } catch {
    /* import.meta may be unavailable in some transpilers */
  }
  return join(process.cwd(), "db");
}

const DB_DIR = resolveDbDir();
const MIGRATIONS_DIR = join(DB_DIR, "migrations");
const SCHEMA_FILE = join(DB_DIR, "schema.sql");

/** Bookkeeping DDL. Built as a constant; additive only, never drops anything. */
export const BOOKKEEPING_DDL =
  "CREATE TABLE IF NOT EXISTS schema_migrations (" +
  "id text PRIMARY KEY, " +
  "checksum text NOT NULL, " +
  "applied_at timestamptz NOT NULL DEFAULT now()" +
  ")";

const FRESH_CHECK_SQL = "SELECT to_regclass('public.schema_migrations') IS NOT NULL AS exists";
const APPLIED_SQL = "SELECT id, checksum, applied_at FROM schema_migrations ORDER BY id";
const CHECKPOINT_SQL =
  "INSERT INTO schema_migrations (id, checksum, applied_at) VALUES ($1, $2, now())";

/** Stable content hash used as the checkpoint fingerprint. */
export function checksum(sql: string): string {
  return createHash("sha256").update(sql, "utf8").digest("hex");
}

/** Migration id from a filename: strip only the trailing .sql suffix. */
export function migrationId(filename: string): string {
  return basename(filename).replace(/\.sql$/i, "");
}

/**
 * Read migrations from disk, sorted by their numeric prefix (then filename).
 * A file named `010_x.sql` therefore follows `009_y.sql` even though string
 * sorting alone would be ambiguous beyond 9.
 */
export function listMigrationFiles(dir: string = MIGRATIONS_DIR): MigrationFile[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => /\.sql$/i.test(f))
    .map((filename) => {
      const sql = readFileSync(join(dir, filename), "utf8");
      return {
        id: migrationId(filename),
        filename,
        sql,
        checksum: checksum(sql),
        order: Number.parseInt(filename, 10) || 0,
      };
    })
    .sort((a, b) => a.order - b.order || a.filename.localeCompare(b.filename));
}

/** Files from `dir` whose id is not in `appliedIds`, in numeric order. */
export function listPendingMigrations(
  appliedIds: Iterable<string>,
  dir: string = MIGRATIONS_DIR
): MigrationFile[] {
  const applied = new Set(appliedIds);
  return listMigrationFiles(dir).filter((f) => !applied.has(f.id));
}

/**
 * Apply migrations through an arbitrary executor (a pg client in production,
 * an in-memory fake in tests). Checkpoints are recorded in the same order the
 * SQL is applied, so a partial failure rolls back as one unit in the script.
 */
export async function applyMigrations(
  executor: QueryExecutor,
  options: ApplyOptions = {}
): Promise<MigrationRunResult> {
  const migrationsDir = options.migrationsDir ?? MIGRATIONS_DIR;
  const schemaFile = options.schemaFile ?? SCHEMA_FILE;

  const freshRows = await executor(FRESH_CHECK_SQL);
  const fresh = freshRows.length === 0 || !freshRows[0]?.exists;

  await executor(BOOKKEEPING_DDL);

  let schemaApplied = false;
  if (fresh) {
    const schemaSql = readFileSync(schemaFile, "utf8");
    if (schemaSql.trim().length > 0) {
      await executor(schemaSql);
      schemaApplied = true;
    }
  }

  const checkpointRows = await executor(APPLIED_SQL);
  const appliedIds = new Set<string>(checkpointRows.map((r) => r.id));

  const pending = listPendingMigrations(appliedIds, migrationsDir);
  const applied: MigrationFile[] = [];
  for (const file of pending) {
    await executor(file.sql);
    await executor(CHECKPOINT_SQL, [file.id, file.checksum]);
    applied.push(file);
  }

  return {
    fresh,
    schemaApplied,
    applied,
    skipped: listMigrationFiles(migrationsDir)
      .filter((f) => appliedIds.has(f.id))
      .map((f) => f.id),
  };
}
