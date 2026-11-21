/**
 * "Tell me when a work like this arrives."
 *
 * Every work here is one of one, so a stock alert is meaningless — a sold piece
 * will never come back. What a buyer actually wants is the next one: another
 * Madhubani, under a certain budget. That is what this stores.
 *
 * There is no sender. Outbound mail stays a no-op until SES is configured
 * (docs/DEPLOY.md), so an alert is a promise the shop keeps by hand: the admin
 * page shows who is waiting and which works have arrived since they asked.
 * Recording `notified_at` is how the owner marks a letter as written, and
 * nothing here claims one was sent.
 */

import { query, queryResult } from "@/lib/db";

let schemaReady: Promise<void> | null = null;

async function createTable(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS work_alerts (
      id SERIAL PRIMARY KEY,
      email TEXT NOT NULL,
      art_form TEXT NOT NULL DEFAULT '',
      price_max NUMERIC,
      locale TEXT NOT NULL DEFAULT 'en',
      source TEXT NOT NULL DEFAULT 'art-form',
      consent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      notified_at TIMESTAMPTZ,
      unsubscribed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await query(
    `CREATE INDEX IF NOT EXISTS work_alerts_waiting_idx
       ON work_alerts (created_at DESC)
      WHERE unsubscribed_at IS NULL`
  );
}

export function ensureWorkAlertsTable(): Promise<void> {
  if (!schemaReady) {
    schemaReady = createTable().catch((err) => {
      schemaReady = null;
      throw err;
    });
  }
  return schemaReady;
}

/**
 * A budget is optional. Blank means "any price", not "free", so it is stored as
 * NULL rather than 0 — a zero budget would silently match nothing.
 */
export function parsePriceMax(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  const value = typeof raw === "number" ? raw : Number(String(raw).replace(/[^\d.]/g, ""));
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.round(value);
}

/** Art-form slugs are lowercase and hyphenated; anything else is not an art form. */
export function normaliseArtForm(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw.trim().toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 60);
}

export async function createWorkAlert(input: {
  email: unknown;
  artForm?: unknown;
  priceMax?: unknown;
  locale?: string;
  source?: string;
}): Promise<{ ok: boolean; reason: string }> {
  const { isValidEmail, normalizeEmail } = await import("@/lib/newsletter");
  const email = normalizeEmail(input.email);
  if (!isValidEmail(email)) return { ok: false, reason: "invalid" };

  await ensureWorkAlertsTable();

  const artForm = normaliseArtForm(input.artForm);
  const priceMax = parsePriceMax(input.priceMax);

  // One live alert per address and tradition: asking twice is not a second
  // request, and duplicate rows would mean duplicate letters later.
  const existing = await queryResult<{ id: number }>(
    `SELECT id FROM work_alerts
      WHERE email=$1 AND art_form=$2 AND unsubscribed_at IS NULL
      LIMIT 1`,
    [email, artForm]
  );
  if (existing.rows.length > 0) return { ok: true, reason: "already" };

  await query(
    `INSERT INTO work_alerts (email, art_form, price_max, locale, source)
     VALUES ($1,$2,$3,$4,$5)`,
    [email, artForm, priceMax, input.locale || "en", input.source || "art-form"]
  );
  return { ok: true, reason: "created" };
}

export interface WorkAlert {
  id: number;
  email: string;
  art_form: string;
  price_max: string | null;
  locale: string;
  source: string;
  notified_at: string | null;
  created_at: string;
}

export async function listWorkAlerts(limit = 200): Promise<WorkAlert[]> {
  await ensureWorkAlertsTable();
  const result = await queryResult<WorkAlert>(
    `SELECT id, email, art_form, price_max, locale, source, notified_at, created_at
       FROM work_alerts
      WHERE unsubscribed_at IS NULL
      ORDER BY created_at DESC, id DESC
      LIMIT $1`,
    [limit]
  );
  return result.rows;
}

export async function markWorkAlertNotified(id: number): Promise<void> {
  await ensureWorkAlertsTable();
  await query(`UPDATE work_alerts SET notified_at=NOW() WHERE id=$1`, [id]);
}

export async function deleteWorkAlert(id: number): Promise<void> {
  await ensureWorkAlertsTable();
  await query(`DELETE FROM work_alerts WHERE id=$1`, [id]);
}

/**
 * Which waiting alerts a newly published work satisfies.
 *
 * Kept pure so the matching rule can be tested without a catalogue or a
 * database: an empty art form means "anything", and an empty budget means "no
 * limit". A budget excludes a work rather than rounding it in, because telling
 * someone about a piece they cannot afford is not a service.
 */
export function matchesWork(
  alert: { art_form: string; price_max: number | null },
  work: { artForms: string[]; price: number | null }
): boolean {
  if (alert.art_form && !work.artForms.includes(alert.art_form)) return false;
  if (alert.price_max === null) return true;
  if (work.price === null) return false;
  return work.price <= alert.price_max;
}
