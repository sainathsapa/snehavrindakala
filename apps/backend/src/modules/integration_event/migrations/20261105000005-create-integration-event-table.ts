import { Migration } from "@mikro-orm/migrations";

export class Migration20261105000005 extends Migration {

  async up(): Promise<void> {
    this.addSql(`CREATE TABLE IF NOT EXISTS "integration_event" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "provider" text NOT NULL,
    "event_id" text NOT NULL UNIQUE,
    "event_type" text NOT NULL,
    "received_at" timestamptz NOT NULL DEFAULT now(),
    "payload" jsonb,
    "signature_result" text,
    "processing_state" text NOT NULL DEFAULT 'received',
    "attempt_count" integer NOT NULL DEFAULT 0,
    "last_error" text,
    "processed_at" timestamptz,
    "updated_at" timestamptz NOT NULL DEFAULT now()
  );

  CREATE INDEX IF NOT EXISTS idx_integration_event_provider_event_id ON "integration_event"("provider", "event_id");
  CREATE INDEX IF NOT EXISTS idx_integration_event_processing_state ON "integration_event"("processing_state");
  CREATE INDEX IF NOT EXISTS idx_integration_event_received_at ON "integration_event"("received_at");`);
  }

  async down(): Promise<void> {
    this.addSql(`DROP TABLE IF EXISTS "integration_event" CASCADE;`);
  }
}
