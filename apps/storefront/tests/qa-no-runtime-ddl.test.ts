import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * A08 — no lazy DDL in request handlers or lib modules.
 *
 * These are STATIC checks. No running Postgres is involved: they pin the wiring
 * that makes it safe for handlers to assume their tables already exist —
 * db/schema.sql + migrations 002-010 are applied by the container entrypoint
 * before the server starts, so a `CREATE TABLE`/`ALTER TABLE` on a request path
 * is a cold-container race/regression, not a harmless fallback.
 *
 * The live-DB half of the gate (the tables really exist) stays in
 * scripts/verify-schema.mjs and is unchanged here.
 */

const repo = join(__dirname, "..", "..", "..");
const app = join(repo, "apps", "storefront");
const read = (rel: string) => readFileSync(join(app, rel), "utf8");

/** Drop line and block comments so prose about DDL cannot trigger a false alarm. */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

/** Any schema-mutation statement that must live at deploy time, not in a handler. */
const DDL =
  /\b(?:CREATE\s+(?:UNIQUE\s+)?(?:TABLE|INDEX|TYPE)\b|ALTER\s+TABLE\b|ADD\s+COLUMN\b|DROP\s+(?:TABLE|COLUMN)\b)/i;

function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(entry)) out.push(full);
  }
  return out;
}

/** `CREATE TABLE IF NOT EXISTS <name> (` from a SQL file. */
function definedTables(sql: string): Set<string> {
  return new Set(
    [...sql.matchAll(/CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+(?:public\.)?"?([a-z_]+)"?\s*\(/gi)].map(
      (m) => m[1]
    )
  );
}

describe("A08 — no runtime DDL in handlers or lib modules", () => {
  it("no CREATE/ALTER DDL remains in any lib or app source file", () => {
    // Only application source is scanned: db/ and scripts/ own DDL by design.
    const files = [...walk(join(app, "lib")), ...walk(join(app, "app"))];
    expect(files.length).toBeGreaterThan(20);
    const offenders = files
      .filter((f) => DDL.test(stripComments(readFileSync(f, "utf8"))))
      .map((f) => f.slice(app.length + 1));
    expect(offenders).toEqual([]);
  });

  it("every configured verify-schema handler exists and is DDL-free", () => {
    const verify = read("scripts/verify-schema.mjs");
    const block = verify.match(/HIGH_TRAFFIC_HANDLERS\s*=\s*\[([\s\S]*?)\];/);
    expect(block).not.toBeNull();
    const handlers = [...block![1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
    expect(handlers.length).toBeGreaterThanOrEqual(28);
    for (const rel of handlers) {
      expect(existsSync(join(app, rel)), `missing handler ${rel}`).toBe(true);
      expect(DDL.test(stripComments(read(rel))), `DDL in ${rel}`).toBe(false);
    }
  });

  it("db/schema.sql covers every table the cleaned handlers used (fresh install)", () => {
    const defined = definedTables(read("db/schema.sql"));
    // Exactly the tables that were created lazily by the 28 handlers (plus the
    // additional tickets handler found during the sweep).
    const handlerTables = [
      "admin_users", "app_notifications", "audit_log", "cart_reminders",
      "category_translation", "certificates", "commission_payouts",
      "customer_wishlist", "discount_codes", "journal_posts", "order_gift_notes",
      "order_refunds", "order_shipments", "password_reset_requests",
      "product_review", "product_translation", "rate_limit_hits",
      "return_requests", "site_art_form", "site_artist", "site_featured_category",
      "site_hero_slide", "site_settings", "site_testimonial", "support_tickets",
      "ticket_replies", "translations", "work_alerts",
    ];
    for (const table of handlerTables) {
      expect(defined.has(table), `schema.sql missing ${table}`).toBe(true);
    }
  });

  it("schema.sql covers the migration-owned tables the DB gate checks", () => {
    const verify = read("scripts/verify-schema.mjs");
    // EXPECTED_SCHEMA entries are two-space-indented `table: [` properties.
    const expected = [
      ...verify.matchAll(/^  ([a-z_]+):\s*\[/gm),
    ].map((m) => m[1]);
    expect(expected.length).toBeGreaterThan(5);
    // The hard gate must cover the gap-closure migrations too, not just 002-004.
    for (const table of [
      "app_notification",
      "notification_event",
      "notification_suppression",
      "inventory_restoration_action",
      "inventory_movement",
    ]) {
      expect(expected, `DB gate missing ${table}`).toContain(table);
    }

    const migrationsDir = join(app, "db", "migrations");
    const migrationFiles = readdirSync(migrationsDir)
      .filter((f) => /^0\d{2}_.*\.sql$/.test(f))
      .sort();
    // Discovered, not pinned: a new migration must not require editing this
    // test to keep the schema gate honest.
    expect(migrationFiles.length).toBeGreaterThanOrEqual(9);

    const fromMigrations = new Set<string>();
    for (const file of migrationFiles) {
      for (const table of definedTables(
        readFileSync(join(migrationsDir, file), "utf8")
      )) {
        fromMigrations.add(table);
      }
    }
    const fromSchema = definedTables(read("db/schema.sql"));
    for (const table of expected) {
      expect(
        fromMigrations.has(table) || fromSchema.has(table),
        `no schema/migration coverage for ${table}`
      ).toBe(true);
    }
  });

  it("schema.sql carries the upgrade ALTERs that replaced lazy per-request column adds", () => {
    const schema = read("db/schema.sql");
    for (const column of [
      "product_handle", "requested_by", "approved_by", "decided_at",
      "decision_note", "art_form", "story_hi", "name_hi", "title_hi", "label_hi",
    ]) {
      expect(
        new RegExp(`ADD\\s+COLUMN\\s+IF\\s+NOT\\s+EXISTS\\s+${column}\\b`, "i").test(schema),
        `schema.sql missing upgrade ALTER for ${column}`
      ).toBe(true);
    }
  });

  it("verify-schema.mjs uses the HARD fail() for its handler check (no warn path)", () => {
    const verify = read("scripts/verify-schema.mjs");
    const fn = verify.match(/function checkHandlers\(\)\s*\{([\s\S]*?)\n\}/);
    expect(fn).not.toBeNull();
    expect(fn![1]).toMatch(/\bfail\(/);
    expect(fn![1]).not.toMatch(/\bwarn\(/);
    expect(verify).not.toMatch(/function\s+warn\s*\(/);
    expect(verify).not.toMatch(/advisory/i);
    expect(verify).toContain("HARD check");
  });

  it("migration runner still runs at bootstrap, before the server starts", () => {
    const entrypoint = read("docker-entrypoint.sh");
    const migrateAt = entrypoint.indexOf("scripts/migrate.mjs");
    const serveAt = entrypoint.indexOf("server.js");
    expect(migrateAt).toBeGreaterThan(-1);
    expect(serveAt).toBeGreaterThan(migrateAt);
    expect(entrypoint).toMatch(/^set -e$/m);

    const dockerfile = read("Dockerfile");
    expect(dockerfile).toMatch(/CMD[^\n]*docker-entrypoint\.sh/);
    expect(dockerfile).toMatch(/COPY[^\n]*apps\/storefront\/db/);

    // Compose builds the storefront from that Dockerfile and documents that the
    // service applies its own schema before serving.
    const compose = readFileSync(join(repo, "docker-compose.yml"), "utf8");
    expect(compose).toMatch(/dockerfile:\s*apps\/storefront\/Dockerfile/);
    expect(compose).toMatch(/storefront[\s\S]*?applies them itself on start-up/);
  });
});
