/**
 * Provider event intake — the dedupe boundary for every webhook.
 *
 * A payment provider will redeliver an event when our endpoint is slow or times
 * out. If each redelivery is allowed to "do the thing" (create an order, post a
 * ledger row, release stock) we get two of everything. The UNIQUE
 * (provider, provider_event_id) constraint on `payment_event` is the one place
 * that decides who got there first: the INSERT either claims the event or it
 * does not. Callers must gate their side effect on `isNew`.
 *
 * Signature verification lives here too so no route can skip it with a
 * home-grown string comparison: it fails closed when the secret is missing.
 */

import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { query as defaultQuery } from "@/lib/db";

export type DbExecutor = (sql: string, params?: any[]) => Promise<any[]>;

export type PaymentEventStatus =
  | "received"
  | "processing"
  | "processed"
  | "failed"
  | "ignored";

export interface ProviderEventInput {
  /** Defaults to `razorpay`, matching the migration's column default. */
  provider?: string;
  providerEventId: string;
  eventType: string;
  orderId?: string | null;
  paymentId?: string | null;
  /** Precomputed hash. When absent it is derived deterministically from `payload`. */
  payloadHash?: string;
  payload?: unknown;
  status?: PaymentEventStatus;
}

export interface RecordProviderEventResult {
  /** True only for the first delivery. A side effect is allowed only when true. */
  isNew: boolean;
  eventId: string;
}

/** Stable stringify so key order in a JSON payload cannot change its hash. */
function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  const obj = value as Record<string, unknown>;
  return `{${Object.keys(obj)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonical(obj[key])}`)
    .join(",")}}`;
}

export function hashEventPayload(payload: unknown): string {
  return createHash("sha256").update(canonical(payload ?? null)).digest("hex");
}

/**
 * Record a provider event exactly once.
 *
 * The INSERT uses ON CONFLICT DO NOTHING, so a redelivery never updates a row
 * and never returns an id from the insert. We then read the id that the first
 * delivery claimed so the caller can still correlate (and log) the duplicate
 * without repeating its effect.
 */
export async function recordProviderEvent(
  event: ProviderEventInput,
  executor: DbExecutor = defaultQuery
): Promise<RecordProviderEventResult> {
  const provider = (event.provider || "razorpay").trim() || "razorpay";
  const payloadHash =
    event.payloadHash ??
    hashEventPayload(
      event.payload ?? {
        provider,
        providerEventId: event.providerEventId,
        eventType: event.eventType,
      }
    );
  const status = event.status ?? "received";

  const inserted = await executor(
    `INSERT INTO payment_event
       (provider, provider_event_id, event_type, order_id, payment_id, payload_hash, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (provider, provider_event_id) DO NOTHING
     RETURNING id`,
    [
      provider,
      event.providerEventId,
      event.eventType,
      event.orderId ?? null,
      event.paymentId ?? null,
      payloadHash,
      status,
    ]
  );

  if (inserted.length > 0) {
    return { isNew: true, eventId: inserted[0].id };
  }

  const existing = await executor(
    `SELECT id FROM payment_event WHERE provider = $1 AND provider_event_id = $2 LIMIT 1`,
    [provider, event.providerEventId]
  );

  return {
    isNew: false,
    // A deterministic fallback keeps logging useful even if the row was removed
    // by a retention job between the conflict and the read.
    eventId:
      existing[0]?.id ?? `duplicate:${provider}:${event.providerEventId}`,
  };
}

/**
 * Verify a provider webhook signature in constant time.
 *
 * Accepts a raw hex digest or the `sha256=`-prefixed form Razorpay also sends.
 * A missing/blank secret, a missing header, or a malformed digest all return
 * false — an unconfigured endpoint must never treat traffic as trusted.
 */
export function verifyWebhookSignature(
  secret: string | undefined | null,
  rawBody: string | Buffer,
  header: string | undefined | null
): boolean {
  if (!secret || !secret.trim()) return false;
  if (typeof header !== "string" || !header.trim()) return false;

  const presented = header.trim().replace(/^sha256=/i, "").toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(presented)) return false;

  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  const presentedBuffer = Buffer.from(presented, "hex");
  if (expectedBuffer.length !== presentedBuffer.length) return false;
  return timingSafeEqual(expectedBuffer, presentedBuffer);
}
