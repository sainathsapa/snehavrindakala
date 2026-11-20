import { Migration } from "@mikro-orm/migrations";

/**
 * Missing DML timestamps on the earnings ledger table.
 *
 * `earnings_ledger_entry` was created with `created_at` only. A DML model always
 * carries `updated_at` and `deleted_at` too, and the module's manager filters on
 * `deleted_at` and sorts on `created_at`, so ledger reads failed outright.
 */
export class Migration20261105000014 extends Migration {
  async up(): Promise<void> {
    this.addSql(
      `ALTER TABLE "earnings_ledger_entry" ADD COLUMN IF NOT EXISTS "updated_at" timestamptz NOT NULL DEFAULT now();`
    );
    this.addSql(
      `ALTER TABLE "earnings_ledger_entry" ADD COLUMN IF NOT EXISTS "deleted_at" timestamptz;`
    );
  }

  async down(): Promise<void> {
    for (const column of ["updated_at", "deleted_at"]) {
      this.addSql(
        `ALTER TABLE "earnings_ledger_entry" DROP COLUMN IF EXISTS "${column}";`
      );
    }
  }
}
