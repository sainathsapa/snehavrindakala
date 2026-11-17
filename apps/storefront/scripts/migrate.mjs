#!/usr/bin/env node
/**
 * Apply db/schema.sql before the server starts.
 *
 * WHY THIS EXISTS
 *
 * schema.sql is only useful if something runs it. Listing the tables in a file
 * that no deploy touches leaves exactly the problem the file was written to
 * solve: a fresh database with no tables, discovered by the first visitor who
 * happens to hit a feature that needs one.
 *
 * So this runs as the first thing the container does, and the server is not
 * allowed to start if it fails. A missing table should be a loud deploy failure
 * that nobody sees, not a quiet runtime error that a customer sees.
 *
 * CONCURRENCY
 *
 * More than one container can start at once — a rolling restart, a scale-out,
 * two compose replicas. Two processes running CREATE TABLE at the same moment
 * can deadlock inside Postgres's catalogue (the application hit exactly that
 * once; see the comment in lib/site-content.ts). A session-level advisory lock
 * makes the second process wait for the first, then find the work already done,
 * because every statement in the file is IF NOT EXISTS.
 *
 * WHY NOT psql
 *
 * The runner image is node:24-alpine and has no psql. Installing the Postgres
 * client for one statement would add a package to a production image that
 * otherwise does not need one. `pg` is already a dependency because the
 * application talks to Postgres directly.
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const here = dirname(fileURLToPath(import.meta.url));
const schemaPath = join(here, "..", "db", "schema.sql");

/** Arbitrary but fixed, so every process asks for the same lock. */
const MIGRATION_LOCK_ID = 4_210_001;

const url = process.env.DATABASE_URL;
if (!url) {
  // Not a warning. Without a database there is nothing to migrate, and
  // carrying on would start a server that fails on its first content query.
  console.error("[migrate] DATABASE_URL is not set.");
  process.exit(1);
}

let sql;
try {
  sql = readFileSync(schemaPath, "utf8");
} catch (e) {
  console.error(`[migrate] Cannot read ${schemaPath}: ${e.message}`);
  process.exit(1);
}

const client = new pg.Client({ connectionString: url });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Postgres can refuse the very first connection while it is still starting up
 * or finishing recovery. That is normal on a cold compose start, so retry
 * briefly instead of failing a deploy over a container that was a second late.
 * Anything else — bad password, wrong host — fails immediately rather than
 * burning a minute of retries before saying so.
 */
async function connect() {
  const retryable = new Set(["ECONNREFUSED", "ENOTFOUND", "ETIMEDOUT", "ECONNRESET"]);
  for (let attempt = 1; attempt <= 10; attempt++) {
    try {
      await client.connect();
      return;
    } catch (e) {
      if (!retryable.has(e.code) || attempt === 10) throw e;
      console.log(`[migrate] database not ready (${e.code}), retry ${attempt}/10`);
      await sleep(1500 * attempt);
    }
  }
}

try {
  await connect();

  // Serialise across containers. `pg_advisory_lock` blocks until the holder
  // releases, which happens automatically when its session ends.
  await client.query("SELECT pg_advisory_lock($1)", [MIGRATION_LOCK_ID]);
  try {
    // One statement, inside a transaction: either the whole schema is there or
    // none of it, so a failure halfway cannot leave a database that is missing
    // only the tables the file happens not to have reached yet.
    await client.query("BEGIN");
    await client.query(sql);
    await client.query("COMMIT");

    const { rows } = await client.query(`
      SELECT count(*)::int AS n FROM pg_tables
      WHERE schemaname = 'public'
        AND tablename IN (
          'admin_users','app_notifications','audit_log','category_translation',
          'commission_payouts','discount_codes','journal_posts','order_refunds',
          'order_shipments','product_review','product_translation',
          'return_requests','site_art_form','site_featured_category',
          'site_hero_slide','site_settings','site_testimonial',
          'support_tickets','ticket_replies','translations'
        )
    `);
    console.log(`[migrate] schema applied — ${rows[0].n} storefront tables present.`);
  } finally {
    await client.query("SELECT pg_advisory_unlock($1)", [MIGRATION_LOCK_ID]).catch(() => {});
  }
} catch (e) {
  console.error(`[migrate] failed: ${e.message}`);
  process.exit(1);
} finally {
  await client.end().catch(() => {});
}
