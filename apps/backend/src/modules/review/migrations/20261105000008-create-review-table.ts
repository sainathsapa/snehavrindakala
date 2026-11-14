import { Migration } from "@mikro-orm/migrations";

export class Migration20261105000008 extends Migration {
  async up(): Promise<void> {
    this.addSql(`CREATE TABLE IF NOT EXISTS "product_review" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "product_id" text NOT NULL,
      "variant_id" text,
      "customer_id" text,
      "author_name" text,
      "rating" integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
      "title" text,
      "body" text NOT NULL,
      "verified" boolean NOT NULL DEFAULT false,
      "verification_order_id" text,
      "photos" jsonb,
      "status" text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
      "admin_note" text,
      "created_at" timestamptz NOT NULL DEFAULT now(),
      "updated_at" timestamptz NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS idx_product_review_product_status ON "product_review"("product_id", "status");
    CREATE INDEX IF NOT EXISTS idx_product_review_customer ON "product_review"("customer_id");
    CREATE INDEX IF NOT EXISTS idx_product_review_status ON "product_review"("status");
    -- One review per customer per product. The customer column is nullable only
    -- for legacy rows; new rows are required to have one, so this is the
    -- duplicate guard.
    CREATE UNIQUE INDEX IF NOT EXISTS uq_product_review_customer_product
      ON "product_review"("customer_id", "product_id") WHERE "customer_id" IS NOT NULL;`);
  }

  async down(): Promise<void> {
    this.addSql(`DROP TABLE IF EXISTS "product_review" CASCADE;`);
  }
}