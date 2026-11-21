-- SnehaVrinda Kala — storefront-owned schema, in one place.
--
-- WHY THIS FILE EXISTS
--
-- The tables below used to be created lazily: every feature that needed storage
-- ran `CREATE TABLE IF NOT EXISTS` on its first request. That works in
-- development, where you touch every feature by hand, and it fails in
-- production, where the first visitor to a cold container is the one who gets
-- the error. Worse, nothing recorded the whole schema anywhere, so a fresh
-- deployment could only be validated by exercising every route.
--
-- This file is that record.
--
-- HOW IT WAS PRODUCED, AND WHY THAT MATTERS
--
-- Every statement below was read out of a running, populated database
-- (pg_attribute and pg_indexes), not assembled from the code that creates the
-- tables. The first draft of this file *was* assembled by hand and it was
-- wrong: it invented `site_art_form.title` where the database has `name`, and
-- gave serial tables a `text` primary key. Those are the columns the
-- application actually queries, so that draft would have built a database where
-- every art-form page returned an error. The check that caught it is a
-- column-by-column diff against the live schema, and it is worth repeating
-- after any future edit here:
--
--   psql "$DATABASE_URL" -f apps/storefront/db/schema.sql   # into an empty db
--   # then diff pg_attribute for these tables against production
--
-- Column order and types are reproduced exactly, including the mixed id
-- strategies — most tables use `gen_random_uuid()`, while the content tables
-- use SERIAL and two use plain derived ids. That inconsistency is real and
-- predates this file; unifying it would be a migration, not a documentation
-- change, so it is preserved rather than quietly tidied.
--
-- HOW IT IS RUN
--
-- The storefront image applies this file before the server starts
-- (scripts/migrate.mjs, wired into the Dockerfile CMD). The migration runs
-- under a Postgres advisory lock, inside one transaction, and the container
-- exits if it fails — a missing table is a failed deploy, not a 500 the first
-- customer discovers.
--
-- It can also be applied by hand, which is useful against a local database:
--
--   npm run db:migrate                       # uses $DATABASE_URL
--   psql "$DATABASE_URL" -f db/schema.sql    # equivalent
--
-- Idempotent: every statement is IF NOT EXISTS, so running it against an
-- existing database is a no-op and running it twice is safe.
--
-- WHAT THIS FILE DOES NOT DO
--
-- It does not alter existing tables. A database created by an older release
-- keeps whatever columns it had; the application's own
-- `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` calls still add the columns
-- introduced since (the `_hi` translation columns, `journal_posts.art_form`).
-- This file is the baseline for a fresh database, not a migration history.
-- Folding those runtime ALTERs in here would be a real migration system, and
-- is the next step if the schema keeps growing.
--
-- SCOPE
--
-- Only tables the storefront owns. Medusa's tables are created by Medusa's own
-- migrations and must not appear here — the two applications share one
-- database, and a `CREATE TABLE IF NOT EXISTS` for a Medusa table would pin a
-- stale definition instead of letting a Medusa upgrade change it.
--
-- The runtime `CREATE TABLE IF NOT EXISTS` calls in the application are left in
-- place as a fallback for local development. They are no longer the only path.

CREATE TABLE IF NOT EXISTS admin_users (
  id text NOT NULL DEFAULT gen_random_uuid(),
  email text NOT NULL,
  password_hash text NOT NULL,
  role text NOT NULL DEFAULT 'viewer'::text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp without time zone NOT NULL DEFAULT now(),
  updated_at timestamp without time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS app_notifications (
  id text NOT NULL DEFAULT (gen_random_uuid())::text,
  audience text NOT NULL DEFAULT 'admin'::text,
  title text NOT NULL,
  message text NOT NULL,
  type text NOT NULL DEFAULT 'info'::text,
  link text,
  read boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS audit_log (
  id text NOT NULL DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  action text NOT NULL,
  old_values jsonb,
  new_values jsonb,
  user_email text,
  user_role text,
  created_at timestamp without time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS category_translation (
  id SERIAL NOT NULL,
  handle text NOT NULL,
  locale text NOT NULL,
  name text NOT NULL DEFAULT ''::text,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS certificates (
  id SERIAL NOT NULL,
  code text NOT NULL,
  order_id text NOT NULL,
  order_item_id text NOT NULL,
  handle text NOT NULL DEFAULT ''::text,
  title text NOT NULL DEFAULT ''::text,
  artist text NOT NULL DEFAULT ''::text,
  art_form text NOT NULL DEFAULT ''::text,
  dimensions text NOT NULL DEFAULT ''::text,
  edition text NOT NULL DEFAULT '1/1'::text,
  issued_at timestamp with time zone NOT NULL DEFAULT now(),
  revoked_at timestamp with time zone,
  PRIMARY KEY (id),
  UNIQUE (code),
  UNIQUE (order_item_id)
);

CREATE TABLE IF NOT EXISTS commission_payouts (
  id text NOT NULL DEFAULT gen_random_uuid(),
  artist_id text NOT NULL,
  artist_name text NOT NULL,
  amount integer NOT NULL,
  currency_code text NOT NULL DEFAULT 'inr'::text,
  status text NOT NULL DEFAULT 'pending'::text,
  paid_at timestamp without time zone,
  created_at timestamp without time zone NOT NULL DEFAULT now(),
  updated_at timestamp without time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS customer_wishlist (
  id SERIAL NOT NULL,
  customer_id text NOT NULL,
  handle text NOT NULL,
  title text NOT NULL DEFAULT ''::text,
  image text NOT NULL DEFAULT ''::text,
  price numeric,
  currency text NOT NULL DEFAULT ''::text,
  artist text NOT NULL DEFAULT ''::text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (id),
  UNIQUE (customer_id, handle)
);

CREATE TABLE IF NOT EXISTS discount_codes (
  id text NOT NULL DEFAULT gen_random_uuid(),
  code text NOT NULL,
  type text NOT NULL DEFAULT 'percentage'::text,
  value text NOT NULL,
  min_order_amount text DEFAULT '0'::text,
  usage_limit integer DEFAULT 0,
  used_count integer DEFAULT 0,
  starts_at timestamp without time zone,
  ends_at timestamp without time zone,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp without time zone NOT NULL DEFAULT now(),
  updated_at timestamp without time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS journal_posts (
  id text NOT NULL DEFAULT gen_random_uuid(),
  title text NOT NULL,
  slug text NOT NULL,
  content text,
  excerpt text,
  cover_image text,
  author text,
  status text NOT NULL DEFAULT 'draft'::text,
  published_at timestamp without time zone,
  created_at timestamp without time zone NOT NULL DEFAULT now(),
  updated_at timestamp without time zone NOT NULL DEFAULT now(),
  title_hi text NOT NULL DEFAULT ''::text,
  excerpt_hi text NOT NULL DEFAULT ''::text,
  content_hi text NOT NULL DEFAULT ''::text,
  art_form text NOT NULL DEFAULT ''::text,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS work_alerts (
  id SERIAL NOT NULL,
  email text NOT NULL,
  art_form text NOT NULL DEFAULT ''::text,
  price_max numeric,
  locale text NOT NULL DEFAULT 'en'::text,
  source text NOT NULL DEFAULT 'art-form'::text,
  consent_at timestamp with time zone NOT NULL DEFAULT now(),
  notified_at timestamp with time zone,
  unsubscribed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id SERIAL NOT NULL,
  email text NOT NULL,
  locale text NOT NULL DEFAULT 'en'::text,
  source text NOT NULL DEFAULT 'footer'::text,
  consent_at timestamp with time zone NOT NULL DEFAULT now(),
  unsubscribed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (id),
  UNIQUE (email)
);

CREATE TABLE IF NOT EXISTS order_refunds (
  id text NOT NULL DEFAULT gen_random_uuid(),
  order_id text NOT NULL,
  amount integer NOT NULL,
  reason text,
  status text NOT NULL DEFAULT 'pending'::text,
  created_at timestamp without time zone NOT NULL DEFAULT now(),
  updated_at timestamp without time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS order_shipments (
  id text NOT NULL,
  order_id text NOT NULL,
  shiprocket_order_id text,
  shipment_id text,
  awb_code text,
  courier_name text,
  courier_service text,
  tracking_url text,
  label_url text,
  pickup_location text,
  status text NOT NULL DEFAULT 'created'::text,
  raw jsonb,
  created_at timestamp without time zone NOT NULL DEFAULT now(),
  updated_at timestamp without time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS product_translation (
  id SERIAL NOT NULL,
  handle text NOT NULL,
  locale text NOT NULL,
  title text NOT NULL DEFAULT ''::text,
  description text NOT NULL DEFAULT ''::text,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

-- Product reviews.
--
-- Taken from the code that creates it (app/api/admin/reviews/route.ts), not from
-- the database, because this table does not exist in production yet: nothing
-- has posted a review, so nothing ever ran the CREATE. A schema built only from
-- a live database therefore omitted it, and the first review would have created
-- its own table at runtime — the behaviour this file exists to stop.
CREATE TABLE IF NOT EXISTS product_review (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  product_id text NOT NULL,
  variant_id text,
  customer_id text,
  author_name text,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  title text,
  body text NOT NULL,
  verified boolean NOT NULL DEFAULT false,
  verification_order_id text,
  photos jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  admin_note text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

-- Storefront-owned UI strings. Also absent from production, and also read from
-- the code (app/api/store/i18n/route.ts) for the same reason as product_review.
-- The UNIQUE below is what makes its ON CONFLICT (locale, key) upsert work;
-- without it that insert fails at runtime rather than here.
CREATE TABLE IF NOT EXISTS translations (
  id text NOT NULL DEFAULT gen_random_uuid(),
  locale text NOT NULL,
  key text NOT NULL,
  value text NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (locale, key)
);

CREATE TABLE IF NOT EXISTS return_requests (
  id text NOT NULL DEFAULT gen_random_uuid(),
  order_id text NOT NULL,
  customer_id text,
  customer_email text NOT NULL,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'pending'::text,
  items text,
  created_at timestamp without time zone NOT NULL DEFAULT now(),
  updated_at timestamp without time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS site_art_form (
  id SERIAL NOT NULL,
  position integer NOT NULL DEFAULT 0,
  slug text NOT NULL,
  name text NOT NULL,
  description text NOT NULL DEFAULT ''::text,
  image text NOT NULL DEFAULT ''::text,
  published boolean NOT NULL DEFAULT true,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  story text NOT NULL DEFAULT ''::text,
  origin text NOT NULL DEFAULT ''::text,
  materials text NOT NULL DEFAULT ''::text,
  quote text NOT NULL DEFAULT ''::text,
  name_hi text NOT NULL DEFAULT ''::text,
  description_hi text NOT NULL DEFAULT ''::text,
  story_hi text NOT NULL DEFAULT ''::text,
  origin_hi text NOT NULL DEFAULT ''::text,
  materials_hi text NOT NULL DEFAULT ''::text,
  quote_hi text NOT NULL DEFAULT ''::text,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS site_artist (
  id SERIAL NOT NULL,
  position integer NOT NULL DEFAULT 0,
  slug text NOT NULL,
  name text NOT NULL,
  bio text NOT NULL DEFAULT ''::text,
  portrait text NOT NULL DEFAULT ''::text,
  region text NOT NULL DEFAULT ''::text,
  years_active text NOT NULL DEFAULT ''::text,
  published boolean NOT NULL DEFAULT true,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  name_hi text NOT NULL DEFAULT ''::text,
  bio_hi text NOT NULL DEFAULT ''::text,
  region_hi text NOT NULL DEFAULT ''::text,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS site_featured_category (
  id SERIAL NOT NULL,
  position integer NOT NULL DEFAULT 0,
  label text NOT NULL,
  href text NOT NULL,
  image text NOT NULL DEFAULT ''::text,
  published boolean NOT NULL DEFAULT true,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  label_hi text NOT NULL DEFAULT ''::text,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS site_hero_slide (
  id SERIAL NOT NULL,
  position integer NOT NULL DEFAULT 0,
  eyebrow text NOT NULL DEFAULT ''::text,
  title text NOT NULL,
  tagline text NOT NULL DEFAULT ''::text,
  cta_label text NOT NULL DEFAULT ''::text,
  cta_href text NOT NULL DEFAULT '/shop'::text,
  image text NOT NULL DEFAULT ''::text,
  published boolean NOT NULL DEFAULT true,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  eyebrow_hi text NOT NULL DEFAULT ''::text,
  title_hi text NOT NULL DEFAULT ''::text,
  tagline_hi text NOT NULL DEFAULT ''::text,
  cta_label_hi text NOT NULL DEFAULT ''::text,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS site_settings (
  key text NOT NULL,
  value text,
  description text,
  updated_at timestamp without time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (key)
);

CREATE TABLE IF NOT EXISTS site_testimonial (
  id SERIAL NOT NULL,
  position integer NOT NULL DEFAULT 0,
  quote text NOT NULL,
  author text NOT NULL,
  location text NOT NULL DEFAULT ''::text,
  work text NOT NULL DEFAULT ''::text,
  published boolean NOT NULL DEFAULT true,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS support_tickets (
  id text NOT NULL,
  subject text NOT NULL,
  message text NOT NULL,
  email text NOT NULL,
  name text,
  status text NOT NULL DEFAULT 'open'::text,
  priority text NOT NULL DEFAULT 'medium'::text,
  assigned_to text,
  product_handle text NOT NULL DEFAULT ''::text,
  created_at timestamp without time zone NOT NULL DEFAULT now(),
  updated_at timestamp without time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS ticket_replies (
  id text NOT NULL DEFAULT gen_random_uuid(),
  ticket_id text NOT NULL,
  message text NOT NULL,
  author text,
  author_type text,
  created_at timestamp without time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE UNIQUE INDEX IF NOT EXISTS admin_users_email_key ON public.admin_users USING btree (email);
CREATE INDEX IF NOT EXISTS idx_app_notifications_audience ON public.app_notifications USING btree (audience, read);
CREATE INDEX IF NOT EXISTS idx_app_notifications_created ON public.app_notifications USING btree (created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS category_translation_handle_locale_key ON public.category_translation USING btree (handle, locale);
CREATE UNIQUE INDEX IF NOT EXISTS discount_codes_code_key ON public.discount_codes USING btree (code);
CREATE UNIQUE INDEX IF NOT EXISTS journal_posts_slug_key ON public.journal_posts USING btree (slug);
CREATE UNIQUE INDEX IF NOT EXISTS order_shipments_order_id_key ON public.order_shipments USING btree (order_id);
CREATE UNIQUE INDEX IF NOT EXISTS product_translation_handle_locale_key ON public.product_translation USING btree (handle, locale);
CREATE INDEX IF NOT EXISTS product_translation_locale_idx ON public.product_translation USING btree (locale);
CREATE UNIQUE INDEX IF NOT EXISTS site_art_form_slug_key ON public.site_art_form USING btree (slug);