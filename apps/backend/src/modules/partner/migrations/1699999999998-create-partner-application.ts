import { Migration } from "@mikro-orm/migrations";

export class Migration1699999999998 extends Migration {

  async up(): Promise<void> {
    this.addSql(`CREATE TABLE IF NOT EXISTS "partner_application" (
    "id" text PRIMARY KEY,
    "applicant_name" text NOT NULL,
    "email" text NOT NULL,
    "disciplines" jsonb,
    "portfolio_references" jsonb,
    "pricing_range" text,
    "capacity" text,
    "review_status" text NOT NULL DEFAULT 'pending',
    "reviewer_id" text,
    "review_notes" text,
    "created_at" timestamptz NOT NULL DEFAULT now(),
    "updated_at" timestamptz NOT NULL DEFAULT now()
  );`);
  }

  async down(): Promise<void> {
    this.addSql(`DROP TABLE IF EXISTS "partner_application" CASCADE;`);
  }
}
