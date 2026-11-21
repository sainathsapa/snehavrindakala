import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Guards db/schema.sql and the deploy step that applies it.
 *
 * The migration ran nowhere once. schema.sql existed, was correct, and was not
 * copied into the image or referenced by any command, so a fresh deploy still
 * created its tables lazily on first request — the exact failure the file was
 * written to prevent. Nothing noticed, because the file itself was right.
 *
 * These tests check the wiring, not the SQL: that the file is in the image,
 * that it is applied before the server starts, and that the statement list is
 * safe to re-run. Whether the columns are correct is a different question and
 * is answered by `npm run db:verify`, which needs a live database.
 */

const root = join(__dirname, "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

describe("schema deployment", () => {
  const dockerfile = read("Dockerfile");
  const entrypoint = read("docker-entrypoint.sh");

  it("ships the schema and the migration into the runtime image", () => {
    // The builder stage has the source tree via `COPY apps/storefront`, but the
    // runner stage starts from a bare node image and gets only what is copied
    // explicitly. Forgetting either copy leaves the runner unable to migrate.
    expect(dockerfile).toMatch(/COPY[^\n]*apps\/storefront\/db[^\n]*apps\/storefront\/db/);
    expect(dockerfile).toMatch(/COPY[^\n]*apps\/storefront\/scripts/);
  });

  it("migrates before serving, and does not serve when the migration fails", () => {
    // Start-up lives in the entrypoint script rather than a CMD array: it also
    // has to resolve the publishable key before the server starts.
    expect(dockerfile).toMatch(/CMD[^\n]*docker-entrypoint\.sh/);
    expect(entrypoint).toMatch(/^set -e$/m);

    const migrateAt = entrypoint.indexOf("scripts/migrate.mjs");
    const serveAt = entrypoint.indexOf("server.js");

    expect(migrateAt).toBeGreaterThan(-1);
    expect(serveAt).toBeGreaterThan(migrateAt);

    // `;` or `|| true` would start the server even after a failed migration,
    // turning a deploy-time error into a runtime one nobody is watching for.
    // Only the runtime-env step is allowed to be best effort.
    const migrateLine = entrypoint
      .split("\n")
      .find((line) => line.includes("scripts/migrate.mjs"))!;
    expect(migrateLine).not.toMatch(/;|\|\|/);
  });

  it("is safe to run more than once", () => {
    const sql = read("db/schema.sql");

    // Every statement must tolerate an existing object, or the second deploy
    // fails on something the first one created.
    const creates =
      sql.match(/CREATE\s+(?:UNIQUE\s+)?(?:TABLE|INDEX)[^;]*/gi) ?? [];
    expect(creates.length).toBeGreaterThan(20);

    const unsafe = creates.filter((s) => !/IF NOT EXISTS/i.test(s));
    expect(unsafe).toEqual([]);
  });

  it("serialises concurrent migrations instead of racing", () => {
    // Two containers starting together can deadlock inside Postgres's catalogue
    // while creating tables; an advisory lock makes the second wait and then
    // find the work already done.
    const migrate = read("scripts/migrate.mjs");
    expect(migrate).toMatch(/pg_advisory_lock/);
    expect(migrate).toMatch(/pg_advisory_unlock/);
    expect(migrate).toMatch(/BEGIN/);
    expect(migrate).toMatch(/COMMIT/);
  });

  it("does not touch tables it does not own", () => {
    // The storefront and Medusa share one database. A CREATE TABLE IF NOT
    // EXISTS for a Medusa table would pin a stale definition and silently
    // block a Medusa upgrade from changing it.
    //
    // Listed explicitly rather than matched by prefix. A prefix rule reads
    // tidier and is wrong: `product_translation` and `product_review` are the
    // storefront's own tables despite starting with `product`, so a prefix
    // check flags correct tables and would end up relaxed until it caught
    // nothing at all.
    const owned = new Set([
      "admin_users", "app_notifications", "audit_log", "category_translation",
      "cart_reminders", "certificates", "password_reset_requests", "rate_limit_hits", "customer_wishlist", "newsletter_subscribers", "work_alerts",
      "commission_payouts", "discount_codes", "journal_posts", "order_refunds",
      "order_gift_notes", "order_shipments", "product_review", "product_translation", "return_requests",
      "site_artist", "site_art_form", "site_featured_category", "site_hero_slide",
      "site_settings",
      "site_testimonial", "support_tickets", "ticket_replies", "translations",
    ]);

    const sql = read("db/schema.sql");
    const tables = [...sql.matchAll(/CREATE TABLE IF NOT EXISTS ([a-z_]+)/g)].map((m) => m[1]);

    expect(tables.length).toBeGreaterThan(15);
    expect(tables.filter((t) => !owned.has(t))).toEqual([]);
  });

  it("defines every table the application creates", () => {
    // The check that would have caught product_review and translations. Both are
    // created lazily by their route, and neither had ever been used, so neither
    // existed in any database — and a live-versus-file diff compared two empty
    // sets and passed while both features still created their own tables on
    // first request.
    //
    // Anchored to the source rather than to a database, so it works in CI where
    // no database exists at all.
    const roots = ["lib", "app", "components", "scripts"];
    const created = new Map();

    const walk = (dir: string) => {
      let entries: string[];
      try {
        entries = readdirSync(join(root, dir));
      } catch {
        return;
      }
      for (const entry of entries) {
        if (entry === "node_modules" || entry.startsWith(".")) continue;
        const rel = `${dir}/${entry}`;
        const full = join(root, rel);
        if (statSync(full).isDirectory()) walk(rel);
        else if (/\.(ts|tsx|mjs|js)$/.test(entry)) {
          const src = readFileSync(full, "utf8");
          // The trailing paren matters: prose such as "ran CREATE TABLE IF NOT
          // EXISTS at once" would otherwise register a table called `at`.
          for (const m of src.matchAll(/CREATE TABLE IF NOT EXISTS ([a-z_]+)\s*\(/gi)) {
            if (!created.has(m[1])) created.set(m[1], rel);
          }
        }
      }
    };
    for (const r of roots) walk(r);

    const sql = read("db/schema.sql");
    const defined = new Set(
      [...sql.matchAll(/CREATE TABLE IF NOT EXISTS ([a-z_]+)\s*\(/gi)].map((m) => m[1])
    );

    const missing = [...created.entries()]
      .filter(([t]) => !defined.has(t))
      .map(([t, where]) => `${t} (created by ${where})`);

    expect(missing).toEqual([]);
  });
});
