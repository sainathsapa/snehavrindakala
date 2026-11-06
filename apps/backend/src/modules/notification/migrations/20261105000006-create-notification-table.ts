import { Migration } from "@mikro-orm/migrations";

export class Migration20261105000006 extends Migration {

  async up(): Promise<void> {
    this.addSql(`CREATE TABLE IF NOT EXISTS "notification" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "recipient" text NOT NULL,
    "channel" text NOT NULL DEFAULT 'email',
    "template" text NOT NULL,
    "data" jsonb,
    "status" text NOT NULL DEFAULT 'pending',
    "provider_message_id" text,
    "error_message" text,
    "created_at" timestamptz NOT NULL DEFAULT now(),
    "updated_at" timestamptz NOT NULL DEFAULT now()
  );

  CREATE INDEX IF NOT EXISTS idx_notification_recipient ON "notification"("recipient");
  CREATE INDEX IF NOT EXISTS idx_notification_status ON "notification"("status");
  CREATE INDEX IF NOT EXISTS idx_notification_template ON "notification"("template");
  CREATE INDEX IF NOT EXISTS idx_notification_created_at ON "notification"("created_at");`);
  }

  async down(): Promise<void> {
    this.addSql(`DROP TABLE IF EXISTS "notification" CASCADE;`);
  }
}
