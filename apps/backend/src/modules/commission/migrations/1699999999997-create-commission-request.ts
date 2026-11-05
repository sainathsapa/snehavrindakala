import { Migration } from "@mikro-orm/migrations";

export class Migration1699999999997 extends Migration {
  async up(): Promise<void> {
    this.addSql(`CREATE TABLE "commission_request" (
      "id" text PRIMARY KEY,
      "customer_id" text NOT NULL,
      "reference_id" text NOT NULL UNIQUE,
      "art_form" text NOT NULL,
      "brief" text NOT NULL,
      "intended_use" text,
      "dimensions" text,
      "budget_range" text,
      "target_date" timestamptz,
      "delivery_region" text,
      "delivery_pin" text,
      "status" text NOT NULL DEFAULT 'New',
      "assigned_artist_id" text,
      "created_at" timestamptz NOT NULL DEFAULT now(),
      "updated_at" timestamptz NOT NULL DEFAULT now()
    );`);
  }

  async down(): Promise<void> {
    this.addSql(`DROP TABLE IF EXISTS "commission_request" CASCADE;`);
  }
}
