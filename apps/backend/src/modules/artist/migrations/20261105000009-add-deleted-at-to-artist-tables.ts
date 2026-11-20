import { Migration } from "@mikro-orm/migrations";

/**
 * Soft-delete columns for the artist module's tables.
 *
 * Medusa's DML models carry `created_at`, `updated_at` and `deleted_at`
 * implicitly, and every query the module's manager issues filters on
 * `"deleted_at" is null`. The hand-written create migration in this folder only
 * declared the first two, so `GET /store/artists` and `/admin/artists` failed
 * with `column a0.deleted_at does not exist` even though the module resolved.
 */
export class Migration20261105000009 extends Migration {
  async up(): Promise<void> {
    for (const table of ["artist", "partner_application", "partner_agreement"]) {
      this.addSql(
        `ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "deleted_at" timestamptz;`
      );
    }
  }

  async down(): Promise<void> {
    for (const table of ["artist", "partner_application", "partner_agreement"]) {
      this.addSql(`ALTER TABLE "${table}" DROP COLUMN IF EXISTS "deleted_at";`);
    }
  }
}
