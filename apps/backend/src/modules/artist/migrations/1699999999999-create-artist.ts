import { Migration } from "@mikro-orm/migrations";

export class Migration1699999999999 extends Migration {
  async up(): Promise<void> {
    this.addSql(`CREATE TABLE "artist" (
      "id" text PRIMARY KEY,
      "display_name" text NOT NULL,
      "slug" text NOT NULL UNIQUE,
      "bio" text,
      "disciplines" jsonb,
      "techniques" jsonb,
      "region" text,
      "portrait_media_id" text,
      "status" text NOT NULL DEFAULT 'pending',
      "commission_available" boolean NOT NULL DEFAULT false,
      "created_at" timestamptz NOT NULL DEFAULT now(),
      "updated_at" timestamptz NOT NULL DEFAULT now()
    );`);
  }

  async down(): Promise<void> {
    this.addSql(`DROP TABLE IF EXISTS "artist" CASCADE;`);
  }
}
