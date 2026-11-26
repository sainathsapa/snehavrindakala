/**
 * Artist domain entity (DML).
 * Registered via model.define so Medusa v2 / MikroORM can resolve metadata
 * at runtime. Medusa auto-adds created_at, updated_at, deleted_at.
 */
import { model } from "@medusajs/utils";

export const Artist = model.define("artist", {
  id: model.text().primaryKey(),
  display_name: model.text(),
  slug: model.text().unique(),
  bio: model.text().nullable(),
  // jsonb, not text[]: the migration creates these columns as jsonb and
  // model.array() made MikroORM send a Postgres array literal
  // ('{Painting,Weaving}'), which Postgres refuses as JSON — every artist insert
  // failed with "invalid input syntax for type json".
  disciplines: model.json().nullable(),
  techniques: model.json().nullable(),
  region: model.text().nullable(),
  portrait_media_id: model.text().nullable(),
  contact_email: model.text().nullable(),
  phone: model.text().nullable(),
  status: model.enum(["pending", "approved", "suspended"]).default("pending"),
  commission_available: model.boolean().default(false),
  is_verified: model.boolean().default(false),
});
