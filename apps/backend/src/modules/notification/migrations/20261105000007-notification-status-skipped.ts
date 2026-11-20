import { Migration } from "@mikro-orm/migrations";

/**
 * Adds `skipped` to the notification status set.
 *
 * A notification whose transport is not configured (local dev, CI) is rendered
 * and logged, then recorded as `skipped` — not `failed`. Without this, a fresh
 * clone shows a wall of "failed" notifications that are not failures.
 */
export class Migration20261105000007 extends Migration {

  async up(): Promise<void> {
    this.addSql(
      `ALTER TABLE "app_notification" DROP CONSTRAINT IF EXISTS "notification_status_check";`
    );
    this.addSql(
      `ALTER TABLE "app_notification" ADD CONSTRAINT "notification_status_check"
       CHECK ("status" IN ('pending','sent','delivered','failed','bounced','skipped'));`
    );
  }

  async down(): Promise<void> {
    this.addSql(
      `ALTER TABLE "app_notification" DROP CONSTRAINT IF EXISTS "notification_status_check";`
    );
    this.addSql(
      `UPDATE "app_notification" SET "status" = 'failed' WHERE "status" = 'skipped';`
    );
    this.addSql(
      `ALTER TABLE "app_notification" ADD CONSTRAINT "notification_status_check"
       CHECK ("status" IN ('pending','sent','delivered','failed','bounced'));`
    );
  }
}
