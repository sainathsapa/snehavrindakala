/**
 * Migration: create artist table.
 * Executed by Medusa's migration runner against PostgreSQL.
 */
export const up = `
  CREATE TABLE IF NOT EXISTS "artist" (
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
  );
`;

export const down = `
  DROP TABLE IF EXISTS "artist" CASCADE;
`;
