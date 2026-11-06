import { Migration } from "@mikro-orm/migrations";

export class Migration20261105000001 extends Migration {

  async up(): Promise<void> {
    this.addSql(`CREATE TABLE IF NOT EXISTS "artist" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "display_name" text NOT NULL,
    "slug" text NOT NULL UNIQUE,
    "bio" text,
    "disciplines" jsonb,
    "techniques" jsonb,
    "region" text,
    "portrait_media_id" text,
    "contact_email" text,
    "phone" text,
    "status" text NOT NULL DEFAULT 'pending',
    "commission_available" boolean NOT NULL DEFAULT false,
    "is_verified" boolean NOT NULL DEFAULT false,
    "created_at" timestamptz NOT NULL DEFAULT now(),
    "updated_at" timestamptz NOT NULL DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS "partner_application" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "artist_id" uuid REFERENCES "artist"("id") ON DELETE SET NULL,
    "applicant_name" text NOT NULL,
    "email" text NOT NULL,
    "phone" text,
    "disciplines" jsonb,
    "portfolio_references" jsonb,
    "pricing_range" text,
    "capacity" text,
    "production_times" text,
    "packaging_ability" text,
    "review_status" text NOT NULL DEFAULT 'pending',
    "reviewer_id" text,
    "review_notes" text,
    "created_at" timestamptz NOT NULL DEFAULT now(),
    "updated_at" timestamptz NOT NULL DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS "partner_agreement" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "artist_id" uuid NOT NULL REFERENCES "artist"("id") ON DELETE CASCADE,
    "agreement_type" text NOT NULL,
    "version" text NOT NULL,
    "effective_date" timestamptz NOT NULL,
    "expiry_date" timestamptz,
    "commercial_terms_ref" text,
    "signed_document_ref" text,
    "signed_at" timestamptz,
    "created_at" timestamptz NOT NULL DEFAULT now(),
    "updated_at" timestamptz NOT NULL DEFAULT now()
  );

  CREATE INDEX IF NOT EXISTS idx_artist_slug ON "artist"("slug");
  CREATE INDEX IF NOT EXISTS idx_artist_status ON "artist"("status");
  CREATE INDEX IF NOT EXISTS idx_partner_application_review_status ON "partner_application"("review_status");
  CREATE INDEX IF NOT EXISTS idx_partner_agreement_artist_id ON "partner_agreement"("artist_id");`);
  }

  async down(): Promise<void> {
    this.addSql(`DROP TABLE IF EXISTS "partner_agreement" CASCADE;
  DROP TABLE IF EXISTS "partner_application" CASCADE;
  DROP TABLE IF EXISTS "artist" CASCADE;`);
  }
}
