import { Migration } from "@mikro-orm/migrations";

/**
 * Missing DML timestamps on the integration event table.
 *
 * It was created with `updated_at` only. Medusa's DML models always carry
 * `created_at` and `deleted_at` as well, and the module's manager filters on
 * `deleted_at`, so event-log reads and idempotency checks failed.
 */
export class Migration20261105000015 extends Migration {
  async up(): Promise<void> {
    this.addSql(
      `ALTER TABLE "integration_event" ADD COLUMN IF NOT EXISTS "created_at" timestamptz NOT NULL DEFAULT now();`
    );
    this.addSql(
      `ALTER TABLE "integration_event" ADD COLUMN IF NOT EXISTS "deleted_at" timestamptz;`
    );
  }

  async down(): Promise<void> {
    for (const column of ["created_at", "deleted_at"]) {
      this.addSql(
        `ALTER TABLE "integration_event" DROP COLUMN IF EXISTS "${column}";`
      );
    }
  }
}
