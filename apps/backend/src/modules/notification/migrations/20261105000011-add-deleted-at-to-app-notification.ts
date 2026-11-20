import { Migration } from "@mikro-orm/migrations";

/**
 * Soft-delete column for the notification module's table.
 *
 * Medusa's DML models carry `deleted_at` implicitly and the module's manager
 * filters every query on `"deleted_at" is null`, but the hand-written create
 * migration never declared the column. Without it the module resolves and then
 * fails at the first read with `column ... deleted_at does not exist`.
 */
export class Migration20261105000011 extends Migration {
  async up(): Promise<void> {
    this.addSql(
      `ALTER TABLE "app_notification" ADD COLUMN IF NOT EXISTS "deleted_at" timestamptz;`
    );
  }

  async down(): Promise<void> {
    this.addSql(
      `ALTER TABLE "app_notification" DROP COLUMN IF EXISTS "deleted_at";`
    );
  }
}
