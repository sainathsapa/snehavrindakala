/**
 * The letter list.
 *
 * The footer has always offered "Letters from the art house" and posted to
 * `/api/newsletter` — a route that did not exist. Every address typed there
 * got a 404 and was lost, which on a shop where each work is sold once is the
 * only way a visitor can ask to hear about the next one.
 *
 * Storage is deliberately boring: one row per address, with the locale it was
 * given in and when consent was recorded. The consent checkbox is required by
 * the form, so a row without `consent_at` would be a bug, not a default.
 */

import { query, queryResult } from "@/lib/db";

let schemaReady: Promise<void> | null = null;

async function createTable(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS newsletter_subscribers (
      id SERIAL PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      locale TEXT NOT NULL DEFAULT 'en',
      source TEXT NOT NULL DEFAULT 'footer',
      consent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      unsubscribed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await query(
    `CREATE INDEX IF NOT EXISTS newsletter_subscribers_active_idx
       ON newsletter_subscribers (created_at DESC)
      WHERE unsubscribed_at IS NULL`
  );
}

export function ensureNewsletterTable(): Promise<void> {
  if (!schemaReady) {
    schemaReady = createTable().catch((err) => {
      schemaReady = null;
      throw err;
    });
  }
  return schemaReady;
}

export type SubscribeOutcome = "subscribed" | "already" | "resubscribed" | "invalid";

/** Lowercased and trimmed — `Sneha@Example.com` and `sneha@example.com` are one person. */
export function normalizeEmail(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw.trim().toLowerCase();
}

/**
 * Deliberately strict about shape and lenient about everything else: the job is
 * to catch typos, not to decide which addresses are legal. Anything beyond a
 * single `@`, a dot in the domain and no whitespace is a rabbit hole, and
 * rejecting a real address is worse than accepting a dead one.
 */
export function isValidEmail(email: string): boolean {
  if (!email || email.length > 254) return false;
  if (/\s/.test(email)) return false;
  return /^[^@]+@[^@.]+(\.[^@.]+)+$/.test(email);
}

/**
 * Add an address. Re-subscribing after an unsubscribe clears the flag rather
 * than failing, because that is what the person just asked for.
 */
export async function subscribeEmail(input: {
  email: unknown;
  locale?: string;
  source?: string;
}): Promise<SubscribeOutcome> {
  const email = normalizeEmail(input.email);
  if (!isValidEmail(email)) return "invalid";

  await ensureNewsletterTable();

  const existing = await queryResult<{ id: number; unsubscribed_at: string | null }>(
    `SELECT id, unsubscribed_at FROM newsletter_subscribers WHERE email=$1`,
    [email]
  );

  if (existing.rows.length > 0) {
    if (existing.rows[0].unsubscribed_at === null) return "already";
    await query(
      `UPDATE newsletter_subscribers
          SET unsubscribed_at=NULL, consent_at=NOW(), locale=$2, source=$3
        WHERE id=$1`,
      [existing.rows[0].id, input.locale || "en", input.source || "footer"]
    );
    return "resubscribed";
  }

  await query(
    `INSERT INTO newsletter_subscribers (email, locale, source)
     VALUES ($1,$2,$3) ON CONFLICT (email) DO NOTHING`,
    [email, input.locale || "en", input.source || "footer"]
  );
  return "subscribed";
}

export interface Subscriber {
  id: number;
  email: string;
  locale: string;
  source: string;
  consent_at: string;
  created_at: string;
}

export async function listSubscribers(limit = 500): Promise<Subscriber[]> {
  await ensureNewsletterTable();
  const result = await queryResult<Subscriber>(
    `SELECT id, email, locale, source, consent_at, created_at
       FROM newsletter_subscribers
      WHERE unsubscribed_at IS NULL
      ORDER BY created_at DESC, id DESC
      LIMIT $1`,
    [limit]
  );
  return result.rows;
}

export async function countSubscribers(): Promise<{ active: number; total: number }> {
  await ensureNewsletterTable();
  const result = await queryResult<{ active: string; total: string }>(
    `SELECT COUNT(*) FILTER (WHERE unsubscribed_at IS NULL) AS active,
            COUNT(*) AS total
       FROM newsletter_subscribers`
  );
  const row = result.rows[0];
  return { active: Number(row?.active ?? 0), total: Number(row?.total ?? 0) };
}

/** Erasure, not unsubscription: the row is gone, so nothing can be mailed later. */
export async function deleteSubscriber(id: number): Promise<boolean> {
  await ensureNewsletterTable();
  const result = await queryResult(
    `DELETE FROM newsletter_subscribers WHERE id=$1`,
    [id]
  );
  return (result.rowCount ?? 0) > 0;
}

export async function unsubscribeEmail(raw: unknown): Promise<boolean> {
  const email = normalizeEmail(raw);
  if (!isValidEmail(email)) return false;
  await ensureNewsletterTable();
  const result = await queryResult(
    `UPDATE newsletter_subscribers SET unsubscribed_at=NOW()
      WHERE email=$1 AND unsubscribed_at IS NULL`,
    [email]
  );
  return (result.rowCount ?? 0) > 0;
}
