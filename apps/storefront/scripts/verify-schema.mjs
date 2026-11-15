#!/usr/bin/env node
/**
 * Verify that db/schema.sql reproduces the live schema.
 *
 * WHY
 *
 * schema.sql was once written by hand from the code that creates the tables,
 * and it was wrong in a way nothing caught: it defined `site_art_form.title`
 * where the database has `name`. A database built from it answers every
 * art-form page with "column does not exist" — a total outage of the site's
 * main navigation, produced by a file that looked entirely correct.
 *
 * The failure is invisible by inspection. The only reliable check is to build
 * the schema in an empty database and compare it, column by column, against the
 * one the application is actually using. That is what this script does.
 *
 *   node scripts/verify-schema.mjs              # compare against $DATABASE_URL
 *   node scripts/verify-schema.mjs --from-env   # same, reading apps/storefront/.env
 *
 * Writes nothing to the source database. Creates and drops a scratch database.
 */
import { readFileSync } from "node:fs";
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
  const envUrl = process.env.DATABASE_URL;
  if (envUrl) return envUrl;
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

/**
 * Connect through the postgres container when the database is not directly
 * reachable — locally it listens on 5433, in a container on 5432, and the URL
 * says one of those depending on where it was copied from.
 */
function psql(sql, db) {
  const url = readUrl();
  const urlDb = (url.match(/\/([^/?]+)(\?|$)/) || [])[1] || "medusa";
  const target = db || urlDb;
  try {
    return execFileSync(
      "docker",
      ["exec", "snehavrinda-postgres", "psql", "-U", "medusa", "-d", target, "-t", "-A", "-c", sql],
      { encoding: "utf8" }
    ).trim();
  } catch (e) {
    return "__ERROR__" + (e.stdout || e.message);
  }
}

const list = OWNED.map((t) => `'${t}'`).join(",");

const COLUMNS = `
SELECT c.relname||'.'||a.attname||' '||format_type(a.atttypid,a.atttypmod)||' '||a.attnotnull
FROM pg_class c JOIN pg_attribute a ON a.attrelid=c.oid
WHERE c.relkind='r' AND c.relnamespace='public'::regnamespace
  AND a.attnum>0 AND NOT a.attisdropped AND c.relname IN (${list})
ORDER BY 1`;

const INDEXES = `
SELECT tablename||' :: '||indexdef FROM pg_indexes
WHERE schemaname='public' AND tablename IN (${list})
ORDER BY tablename, indexdef`;

// 1. Build the schema in a scratch database.
psql(`DROP DATABASE IF EXISTS ${SCRATCH};`, "postgres");
psql(`CREATE DATABASE ${SCRATCH};`, "postgres");

const apply = execFileSync(
  "docker",
  ["exec", "-i", "snehavrinda-postgres", "psql", "-U", "medusa", "-d", SCRATCH, "-v", "ON_ERROR_STOP=1"],
  { input: readFileSync(join(root, "db/schema.sql")), encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }
);
void apply;

// 2. Compare.
const live = psql(COLUMNS);
const built = psql(COLUMNS, SCRATCH);
const liveIdx = psql(INDEXES);
const builtIdx = psql(INDEXES, SCRATCH);

const diff = (a, b) => {
  const A = new Set(a.split("\n").filter(Boolean));
  const B = new Set(b.split("\n").filter(Boolean));
  return {
    missing: [...A].filter((x) => !B.has(x)),
    extra: [...B].filter((x) => !A.has(x)),
  };
};

const colDiff = diff(live, built);
const idxDiff = diff(liveIdx, builtIdx);

let failed = false;
for (const [label, d] of [["column", colDiff], ["index", idxDiff]]) {
  for (const m of d.missing) {
    console.error(`MISSING ${label} in schema.sql: ${m}`);
    failed = true;
  }
  for (const m of d.extra) {
    console.error(`EXTRA ${label} in schema.sql:   ${m}`);
    failed = true;
  }
}

psql(`DROP DATABASE IF EXISTS ${SCRATCH};`, "postgres");

if (failed) {
  console.error("\nschema.sql does not reproduce the live schema.");
  process.exit(1);
}
console.log(`schema.sql matches the live schema: ${live.split("\n").length} columns, ${liveIdx.split("\n").length} indexes.`);
