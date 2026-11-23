import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Engineering-gap closure: the notification retry state machine only matters
 * in production if something actually calls it and an admin can see the queue.
 * These tests pin the two Lead-wired routes (a CRON_SECRET-guarded worker and a
 * read-only admin view) and their compose caller. Static assertions keep them
 * independent of a live database or credentials.
 */

const root = join(__dirname, "..");
const repoRoot = join(root, "..", "..");
const readApp = (p: string) => readFileSync(join(root, p), "utf8");
const readRepo = (p: string) => readFileSync(join(repoRoot, p), "utf8");

describe("notification retry worker trigger", () => {
  const cron = readApp("app/api/cron/notification-retries/route.ts");

  it("guards the worker with CRON_SECRET and refuses open/misconfigured runs", () => {
    expect(cron).toMatch(/authoriseCron/);
    expect(cron).toMatch(/secret: process\.env\.CRON_SECRET/);
    expect(cron).toMatch(/process\.env\.CRON_SECRET \? 401 : 503/);
  });

  it("calls the existing bounded retry processor, never reimplements it", () => {
    expect(cron).toMatch(/processNotificationRetries/);
    expect(cron).toMatch(/limit: MAX_PER_RUN/);
    expect(cron).toMatch(/const MAX_PER_RUN = \d+/);
  });

  it("exports both GET and POST and performs no DDL", () => {
    expect(cron).toMatch(/export const GET = handle/);
    expect(cron).toMatch(/export const POST = handle/);
    expect(cron).not.toMatch(/CREATE\s+TABLE|ALTER\s+TABLE/i);
  });
});

describe("notification retry admin observability", () => {
  const admin = readApp("app/api/admin/notification-retries/route.ts");

  it("requires an authenticated admin", () => {
    expect(admin).toMatch(/requireAdmin\(\)/);
    expect(admin).toMatch(/status: 401/);
  });

  it("exposes the real retry stats and is strictly read-only", () => {
    expect(admin).toMatch(/notificationRetryStats\(\)/);
    expect(admin).not.toMatch(/processNotificationRetries/);
    expect(admin).not.toMatch(/CREATE\s+TABLE|ALTER\s+TABLE|INSERT\s+INTO|UPDATE\s+"app_notification"/i);
  });

  it("is force-dynamic so counts are fresh on every request", () => {
    expect(admin).toMatch(/dynamic = "force-dynamic"/);
  });
});

describe("migration 005 is order-independent", () => {
  const migration = readApp("db/migrations/005_notification_retry.sql");

  it("creates a compatible base table before altering it", () => {
    const createAt = migration.indexOf('CREATE TABLE IF NOT EXISTS "app_notification"');
    const alterAt = migration.indexOf('ALTER TABLE "app_notification"');
    expect(createAt).toBeGreaterThanOrEqual(0);
    expect(alterAt).toBeGreaterThan(createAt);
  });

  it("keeps the base-table columns compatible with the backend module", () => {
    for (const col of ["id", "recipient", "channel", "template", "status", "provider_message_id", "created_at"]) {
      expect(migration).toMatch(new RegExp(`"${col}"`));
    }
  });
});

describe("compose schedules the retry worker", () => {
  const compose = readRepo("docker-compose.yml");

  it("defines a dedicated notification-retry-cron service on the ops profile", () => {
    expect(compose).toMatch(/notification-retry-cron:/);
    expect(compose).toMatch(/profiles: \["ops"\]/);
    expect(compose).toMatch(/\/api\/cron\/notification-retries/);
  });

  it("wires CRON_SECRET and the retry config env vars", () => {
    expect(compose).toMatch(/NOTIFICATION_RETRY_INTERVAL_SECONDS/);
    expect(compose).toMatch(/NOTIFICATION_MAX_ATTEMPTS/);
    expect(compose).toMatch(/SES_SNS_TOPIC_ARN/);
  });
});
