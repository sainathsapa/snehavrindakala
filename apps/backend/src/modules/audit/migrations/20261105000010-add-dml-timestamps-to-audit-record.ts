import { Migration } from "@mikro-orm/migrations";

/**
 * Medusa's DML timestamp columns on the audit module's own table.
 *
 * `audit_record` was created by hand with a single `timestamp` column. A DML
 * model always carries `created_at`, `updated_at` and `deleted_at` as well, and
 * the module's manager filters every read on `deleted_at is null` and orders on
 * `created_at`, so the first query failed with
 * `column a0.deleted_at does not exist`.
 *
 * `audit_log` is a different thing entirely: it belongs to the storefront's own
 * schema and is not touched here.
 */
export class Migration20261105000010 extends Migration {
  async up(): Promise<void> {
    this.addSql(
      `ALTER TABLE "audit_record" ADD COLUMN IF NOT EXISTS "created_at" timestamptz NOT NULL DEFAULT now();`
    );
    this.addSql(
      `ALTER TABLE "audit_record" ADD COLUMN IF NOT EXISTS "updated_at" timestamptz NOT NULL DEFAULT now();`
    );
    this.addSql(
      `ALTER TABLE "audit_record" ADD COLUMN IF NOT EXISTS "deleted_at" timestamptz;`
    );
  }

  async down(): Promise<void> {
    for (const column of ["created_at", "updated_at", "deleted_at"]) {
      this.addSql(
        `ALTER TABLE "audit_record" DROP COLUMN IF EXISTS "${column}";`
      );
    }
  }
}
