import { Migration } from "@mikro-orm/migrations";

export class Migration20261105000006 extends Migration {

  async up(): Promise<void> {
    this.addSql(`CREATE TABLE IF NOT EXISTS "app_notification" (
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

  CREATE INDEX IF NOT EXISTS idx_notification_recipient ON "app_notification"("recipient");
  CREATE INDEX IF NOT EXISTS idx_notification_status ON "app_notification"("status");
  CREATE INDEX IF NOT EXISTS idx_notification_template ON "app_notification"("template");
  CREATE INDEX IF NOT EXISTS idx_notification_created_at ON "app_notification"("created_at");`);
  }

  async down(): Promise<void> {
    this.addSql(`DROP TABLE IF EXISTS "app_notification" CASCADE;`);
  }
}
