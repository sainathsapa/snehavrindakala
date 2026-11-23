import { Migration } from "@mikro-orm/migrations";

/**
 * NOT-01 — idempotency key for transactional notifications.
 *
 * The order-confirmation email used to be sent from two places (the backend
 * payment subscriber and the storefront's checkout-complete route), and
 * `app_notification` had no constraint to stop the second one. A nullable column
 * plus a UNIQUE index keeps this backward compatible: Postgres treats NULLs as
 * distinct, so every pre-existing row (NULL key) is untouched, while real keys
 * are constrained. The index is deliberately NOT partial: a bare
 * `ON CONFLICT (event_key)` cannot infer a partial index in Postgres. The
 * service inserts with ON CONFLICT DO NOTHING and returns the winning row.
 */
export class Migration20261105000016 extends Migration {
  async up(): Promise<void> {
    this.addSql(
      `ALTER TABLE "app_notification" ADD COLUMN IF NOT EXISTS "event_key" text;`
    );
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "idx_app_notification_event_key"
         ON "app_notification" ("event_key");`
    );
  }

  async down(): Promise<void> {
    this.addSql(`DROP INDEX IF EXISTS "idx_app_notification_event_key";`);
    this.addSql(
      `ALTER TABLE "app_notification" DROP COLUMN IF EXISTS "event_key";`
    );
  }
}
