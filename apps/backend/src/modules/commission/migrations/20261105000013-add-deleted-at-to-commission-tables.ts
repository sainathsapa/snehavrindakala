import { Migration } from "@mikro-orm/migrations";

/**
 * Soft-delete columns for the commission module's tables.
 *
 * The hand-written create migration declared `created_at` / `updated_at` but not
 * `deleted_at`, which Medusa's DML models always carry. The module's manager adds
 * `"deleted_at" is null` to every query, so reads failed with
 * `column c0.deleted_at does not exist` and commission pages returned 500.
 */
const TABLES = [
  "commission_request",
  "commission_quote",
  "commission_milestone",
  "commission_revision",
  "commission_attachment",
  "payout_batch",
];

export class Migration20261105000013 extends Migration {
  async up(): Promise<void> {
    for (const table of TABLES) {
      this.addSql(
        `ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "deleted_at" timestamptz;`
      );
    }
  }

  async down(): Promise<void> {
    for (const table of TABLES) {
      this.addSql(`ALTER TABLE "${table}" DROP COLUMN IF EXISTS "deleted_at";`);
    }
  }
}
