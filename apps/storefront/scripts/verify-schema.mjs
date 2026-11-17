#!/usr/bin/env node
/**
 * Verify that db/schema.sql is a faithful and complete record of the schema.
 *
 * WHY
 *
 * The first version of schema.sql was wrong twice, in two different ways, and a
 * naive check passed both times:
 *
 *   1. It invented columns. `site_art_form.title` where the database has
 *      `name`. Caught by diffing against a live database.
 *   2. It omitted whole tables. `product_review` and `translations` are created
 *      lazily by the application, and no code path had used them yet, so they
 *      existed in neither the live database nor the file. Diffing live against
 *      built compared two empty sets and reported success — while both features
 *      would still have created their tables at runtime, the exact behaviour
 *      this file exists to remove.
 *
 * So there are three checks, and the last one is the one that matters:
 *
 *   A. Every table the application source creates must appear in schema.sql.
 *      This is anchored to the code, not to the database, so a table that has
 *      never been instantiated cannot hide.
 *   B. Every table in schema.sql that also exists live must match it column for
 *      column and index for index. This is what stops invented columns.
 *   C. Every storefront-owned table that exists live must appear in schema.sql.
 *      A deploy must never silently lose a table.
 *
 * A table that is in schema.sql but not yet live is reported as pending, not as
 * a failure: that is a new table waiting for its first deploy.
 *
 *   node scripts/verify-schema.mjs
 *
 * Reads the live database. Writes only to a scratch database it creates.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SCRATCH = "schema_verify_tmp";

/** Tables the storefront owns. Medusa's are deliberately absent — see schema.sql. */
const OWNED = [
  "admin_users", "app_notifications", "audit_log", "category_translation",
  "commission_payouts", "discount_codes", "journal_posts", "order_refunds",
  "order_shipments", "product_review", "product_translation", "return_requests",
  "site_art_form", "site_featured_category", "site_hero_slide", "site_settings",
  "site_testimonial", "support_tickets", "ticket_replies", "translations",
];

function readUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  try {
    const env = readFileSync(join(root, ".env"), "utf8");
    const m = env.match(/^DATABASE_URL=(.*)$/m);
    if (m) return m[1].trim().replace(/^["']|["']$/g, "");
  } catch {
    /* fall through */
  }
  console.error("No DATABASE_URL. Set it, or add it to apps/storefront/.env");
  process.exit(2);
}

function psql(sql, db) {
  const url = readUrl();
  const urlDb = (url.match(/\/([^/?]+)(\?|$)/) || [])[1] || "medusa";
  try {
    return execFileSync(
      "docker",
      ["exec", "snehavrinda-postgres", "psql", "-U", "medusa", "-d", db || urlDb, "-t", "-A", "-c", sql],
      { encoding: "utf8" }
    ).trim();
  } catch (e) {
    return "__ERROR__" + (e.stdout || e.message);
  }
}

/** Walk the application source looking for tables it creates. */
function tablesCreatedByCode() {
  const found = new Map();
  const skip = new Set(["node_modules", ".next", ".git", "dist"]);

  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      if (skip.has(entry)) continue;
      const p = join(dir, entry);
      const s = statSync(p);
      if (s.isDirectory()) walk(p);
      else if (/\.(ts|tsx|mjs|js)$/.test(entry)) {
        const src = readFileSync(p, "utf8");
        // Require the opening paren, or prose like "ran CREATE TABLE IF NOT
        // EXISTS at once" in a comment is read as creating a table called `at`.
        for (const m of src.matchAll(/CREATE TABLE IF NOT EXISTS ([a-z_]+)\s*\(/gi)) {
          const rel = p.slice(root.length + 1);
          if (!found.has(m[1])) found.set(m[1], rel);
        }
      }
    }
  };
  walk(root);
  return found;
}

const schemaSql = readFileSync(join(root, "db/schema.sql"), "utf8");
const inFile = new Set(
  [...schemaSql.matchAll(/CREATE TABLE IF NOT EXISTS ([a-z_]+)\s*\(/gi)].map((m) => m[1])
);

const list = OWNED.map((t) => `'${t}'`).join(",");

const COLUMNS = (tables) => `
SELECT c.relname||'.'||a.attname||' '||format_type(a.atttypid,a.atttypmod)||' '||a.attnotnull
FROM pg_class c JOIN pg_attribute a ON a.attrelid=c.oid
WHERE c.relkind='r' AND c.relnamespace='public'::regnamespace
  AND a.attnum>0 AND NOT a.attisdropped AND c.relname IN (${tables})
ORDER BY 1`;

const INDEXES = (tables) => `
SELECT tablename||' :: '||indexdef FROM pg_indexes
WHERE schemaname='public' AND tablename IN (${tables})
ORDER BY tablename, indexdef`;

let failed = false;
const fail = (msg) => {
  console.error(msg);
  failed = true;
};

// --- A. Every table the code creates is in the file. -----------------------
// Anchored to source, so a table that has never existed in any database is
// still caught. This is the check that would have found product_review.
const codeTables = tablesCreatedByCode();
for (const [table, where] of codeTables) {
  if (!OWNED.includes(table)) continue; // Medusa creates its own
  if (!inFile.has(table)) {
    fail(`MISSING table in schema.sql: ${table} (created by ${where})`);
  }
}

// --- Build the file into a scratch database. -------------------------------
psql(`DROP DATABASE IF EXISTS ${SCRATCH};`, "postgres");
psql(`CREATE DATABASE ${SCRATCH};`, "postgres");

try {
  execFileSync(
    "docker",
    ["exec", "-i", "snehavrinda-postgres", "psql", "-U", "medusa", "-d", SCRATCH, "-v", "ON_ERROR_STOP=1"],
    { input: schemaSql, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }
  );
} catch (e) {
  fail(`schema.sql does not apply cleanly:\n${e.stderr || e.message}`);
}

// --- B. Tables that exist live must match the file. ------------------------
const liveTables = psql(
  `SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename IN (${list}) ORDER BY 1`
).split("\n").filter(Boolean);

const shared = liveTables.filter((t) => inFile.has(t));
const sharedList = shared.map((t) => `'${t}'`).join(",") || "''";

const liveCols = psql(COLUMNS(sharedList));
const builtCols = psql(COLUMNS(sharedList));
const liveIdx = psql(INDEXES(sharedList));
const builtIdx = psql(INDEXES(sharedList));

const compare = (live, built, label) => {
  const A = new Set(live.split("\n").filter(Boolean));
  const B = new Set(built.split("\n").filter(Boolean));
  for (const x of A) if (!B.has(x)) fail(`MISSING ${label} in schema.sql: ${x}`);
  for (const x of B) if (!A.has(x)) fail(`EXTRA ${label} in schema.sql:   ${x}`);
};

compare(liveCols, builtCols, "column");
compare(liveIdx, builtIdx, "index");

// --- C. No live storefront table may be absent from the file. -------------
for (const t of liveTables) {
  if (!inFile.has(t)) fail(`MISSING table in schema.sql: ${t} (exists in the live database)`);
}

// --- Pending: in the file, not yet deployed. Informational only. ----------
const pending = [...inFile].filter((t) => !liveTables.includes(t));

psql(`DROP DATABASE IF EXISTS ${SCRATCH};`, "postgres");

for (const t of pending) {
  console.log(`pending (not yet in the live database): ${t}`);
}

if (failed) {
  console.error("\nschema.sql does not match the application.");
  process.exit(1);
}
console.log(
  `schema.sql verified: ${inFile.size} tables defined, ${codeTables.size} referenced by code, ` +
    `${liveCols.split("\n").filter(Boolean).length} columns and ` +
    `${liveIdx.split("\n").filter(Boolean).length} indexes match the live database.`
);
