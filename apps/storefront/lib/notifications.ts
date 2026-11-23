/**
 * Notification store + realtime fan-out.
 *
 * Replaces the previous /api/notifications implementation, which had three
 * defects that made it unusable:
 *
 *   - `await requireAdmin()` discarded the result, so both GET and POST were
 *     effectively unauthenticated.
 *   - The INSERT named an `updated_at` column that the CREATE TABLE never
 *     defined, so every insert failed.
 *   - Nothing ever connected to the stream, and the in-process client Map only
 *     worked with a single server instance.
 *
 * Design: Postgres is the source of truth. Realtime delivery uses Postgres
 * LISTEN/NOTIFY so any number of storefront instances see the same events —
 * an in-memory Map cannot do that behind a load balancer.
 */

import { EventEmitter } from "events";
import { createPublicKey, createVerify, X509Certificate } from "node:crypto";
import pg from "pg";
import { query as defaultQuery } from "@/lib/db";

const DATABASE_URL =
  process.env.DATABASE_URL ||
  "postgresql://medusa:medusa@localhost:5432/medusa";

const CHANNEL = "svk_notifications";

export interface StoredNotification {
  id: string;
  audience: string;
  title: string;
  message: string;
  type: string;
  link: string | null;
  read: boolean;
  created_at: string;
}

/** Audiences: "admin" plus any role name. `*` matches everyone. */
export type Audience = "admin" | "super_admin" | "manager" | "support" | "viewer" | string;

/* ------------------------------------------------------------------ *
 * Pool
 *
 * One shared pool for the whole process. The previous code opened a new Pool
 * per request and called pool.end() — that is both slow and a connection
 * exhaustion risk under load.
 * ------------------------------------------------------------------ */

declare global {
   
  var __svkNotificationPool: pg.Pool | undefined;
   
  var __svkNotificationSchemaReady: Promise<void> | undefined;
}

function pool(): pg.Pool {
  if (!global.__svkNotificationPool) {
    global.__svkNotificationPool = new pg.Pool({
      connectionString: DATABASE_URL,
      max: 5,
      idleTimeoutMillis: 30_000,
    });
  }
  return global.__svkNotificationPool;
}

/**
 * Kept as a no-op for callers. `app_notifications` and its indexes are created
 * by db/schema.sql before the server starts, so no request handler needs to
 * initialise them at runtime.
 */
export async function ensureSchema(): Promise<void> {}

/* ------------------------------------------------------------------ *
 * Realtime fan-out (LISTEN/NOTIFY)
 * ------------------------------------------------------------------ */

declare global {
   
  var __svkNotificationBus: EventEmitter | undefined;
   
  var __svkNotificationListener: pg.Client | undefined;
}

function bus(): EventEmitter {
  if (!global.__svkNotificationBus) {
    const emitter = new EventEmitter();
    emitter.setMaxListeners(0);
    global.__svkNotificationBus = emitter;
  }
  return global.__svkNotificationBus;
}

/** Attach the LISTEN client once per process. */
async function ensureListener(): Promise<void> {
  if (global.__svkNotificationListener) return;

  const client = new pg.Client({ connectionString: DATABASE_URL });
  await client.connect();
  await client.query(`LISTEN ${CHANNEL}`);

  client.on("notification", (msg) => {
    if (!msg.payload) return;
    try {
      bus().emit("notification", JSON.parse(msg.payload));
    } catch (err) {
      console.error("[notifications] bad payload", err);
    }
  });

  // A dropped listener must not silently stop realtime updates.
  client.on("error", (err) => {
    console.error("[notifications] listener error, reconnecting", err);
    global.__svkNotificationListener = undefined;
    setTimeout(() => {
      ensureListener().catch((e) =>
        console.error("[notifications] reconnect failed", e)
      );
    }, 1000);
  });

  global.__svkNotificationListener = client;
}

/**
 * Subscribe to realtime notifications. Returns an unsubscribe function that
 * the caller MUST invoke when the stream closes.
 */
export async function subscribe(
  handler: (notification: StoredNotification) => void
): Promise<() => void> {
  try {
    await ensureListener();
  } catch (err) {
    console.error("[notifications] cannot listen; realtime disabled", err);
    return () => {};
  }

  const wrapped = (notification: StoredNotification) => handler(notification);
  bus().on("notification", wrapped);

  return () => {
    bus().off("notification", wrapped);
  };
}

/* ------------------------------------------------------------------ *
 * Reads and writes
 * ------------------------------------------------------------------ */

export async function listNotifications(options: {
  audience?: Audience;
  unreadOnly?: boolean;
  limit?: number;
} = {}): Promise<StoredNotification[]> {
  await ensureSchema();

  const { audience, unreadOnly = false, limit = 50 } = options;

  const where: string[] = [];
  const params: any[] = [];

  if (audience) {
    params.push(audience);
    // `*` rows are visible to every audience.
    where.push(`(audience = $${params.length} OR audience = '*')`);
  }
  if (unreadOnly) where.push("read = false");

  const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
  params.push(Math.min(Math.max(limit, 1), 200));

  const result = await pool().query(
    `SELECT id, audience, title, message, type, link, read, created_at
       FROM app_notifications
       ${clause}
       ORDER BY created_at DESC
       LIMIT $${params.length}`,
    params
  );

  return result.rows.map((row) => ({
    ...row,
    created_at:
      row.created_at instanceof Date
        ? row.created_at.toISOString()
        : String(row.created_at),
  }));
}

export async function createNotification(input: {
  audience?: Audience;
  title: string;
  message: string;
  type?: string;
  link?: string | null;
}): Promise<StoredNotification> {
  await ensureSchema();

  const { audience = "admin", title, message, type = "info", link = null } = input;

  const result = await pool().query(
    `INSERT INTO app_notifications (audience, title, message, type, link)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, audience, title, message, type, link, read, created_at`,
    [audience, title, message, type, link]
  );

  const row = result.rows[0];
  const notification: StoredNotification = {
    ...row,
    created_at:
      row.created_at instanceof Date
        ? row.created_at.toISOString()
        : String(row.created_at),
  };

  // Notify every connected instance. Deliberately not awaited as a promise
  // chain with the insert: the row is already committed, and a failed notify
  // should not fail the caller.
  try {
    await pool().query("SELECT pg_notify($1, $2)", [
      CHANNEL,
      JSON.stringify(notification),
    ]);
  } catch (err) {
    console.error("[notifications] pg_notify failed", err);
  }

  return notification;
}

export async function markRead(
  id: string,
  read = true
): Promise<StoredNotification | null> {
  await ensureSchema();

  const result = await pool().query(
    `UPDATE app_notifications
        SET read = $2
      WHERE id = $1
      RETURNING id, audience, title, message, type, link, read, created_at`,
    [id, read]
  );

  if (result.rowCount === 0) return null;

  const row = result.rows[0];
  return {
    ...row,
    created_at:
      row.created_at instanceof Date
        ? row.created_at.toISOString()
        : String(row.created_at),
  };
}

export async function markAllRead(audience?: Audience): Promise<number> {
  await ensureSchema();

  const params: any[] = [];
  let clause = "";
  if (audience) {
    params.push(audience);
    clause = `WHERE (audience = $1 OR audience = '*')`;
  }

  const result = await pool().query(
    `UPDATE app_notifications SET read = true ${clause} AND read = false`,
    params
  );
  return result.rowCount ?? 0;
}

export async function unreadCount(audience?: Audience): Promise<number> {
  await ensureSchema();

  const params: any[] = [];
  let clause = "WHERE read = false";
  if (audience) {
    params.push(audience);
    clause += ` AND (audience = $1 OR audience = '*')`;
  }

  const result = await pool().query(
    `SELECT count(*)::int AS count FROM app_notifications ${clause}`,
    params
  );
  return result.rows[0]?.count ?? 0;
}

/** Reset module state — tests only. */
export function __resetForTests(): void {
  global.__svkNotificationPool = undefined;
  global.__svkNotificationSchemaReady = undefined;
  global.__svkNotificationBus = undefined;
  global.__svkNotificationListener = undefined;
}

/* ================================================================== *
 * GAP-05 / GAP-07 — retry scheduling + verified SES delivery events
 * ------------------------------------------------------------------
 * Everything below is pure or adapter-only (an injectable query/send/cert
 * fetch). It never contacts SES/SNS in a test. The SQL lives in migration
 * 005_notification_retry.sql; the HTTP entry point is
 * app/api/webhooks/ses/route.ts. The historical manual retry in lib/outbox.ts
 * is left untouched on purpose (it mints a fresh key and is an operator tool);
 * the automated worker below is a separate, counted, leased state machine.
 *
 * HONEST LIMITATION: SES SendEmail has no provider-side idempotency token. The
 * guards here are (1) a stable logical event_key, (2) an atomic lease so two
 * workers cannot process one row, and (3) a provider_message_id check so an
 * already-accepted message is never re-sent. An ambiguous timeout where SES
 * accepted but the receipt was lost cannot be deduped by SES itself — enabling
 * automated retries in production is owner-gated and should be paired with
 * delivery-event reconciliation. This is never presented as a PASS.
 * ================================================================== */

export type QueryExecutor = <T extends Record<string, any> = any>(
  sql: string,
  params?: any[]
) => Promise<T[]>;

const runQuery: QueryExecutor = ((sql: string, params?: any[]) =>
  defaultQuery(sql, params)) as QueryExecutor;

/* ── Retry policy (pure) ───────────────────────────────────────────────────── */

export const NOTIFICATION_MAX_ATTEMPTS_DEFAULT = 5;
export const NOTIFICATION_MAX_ATTEMPTS_CAP = 50;
export const NOTIFICATION_BASE_DELAY_MS = 60_000;
export const NOTIFICATION_MAX_DELAY_MS = 3_600_000;

/** Owner-configurable via NOTIFICATION_MAX_ATTEMPTS; always fail-safe bounded. */
export function notificationMaxAttempts(env: NodeJS.ProcessEnv = process.env): number {
  const parsed = Number.parseInt(String(env.NOTIFICATION_MAX_ATTEMPTS ?? ""), 10);
  if (!Number.isFinite(parsed) || parsed < 1) return NOTIFICATION_MAX_ATTEMPTS_DEFAULT;
  return Math.min(parsed, NOTIFICATION_MAX_ATTEMPTS_CAP);
}

/** Exponential backoff with a bounded ceiling (mirrors payment reconciliation). */
export function notificationBackoffDelayMs(attempt: number): number {
  const a = Math.max(0, Math.floor(Number(attempt) || 0));
  return Math.min(NOTIFICATION_MAX_DELAY_MS, NOTIFICATION_BASE_DELAY_MS * 2 ** a);
}

export type NotificationErrorKind = "retryable" | "terminal";

export interface ClassifiedNotificationError {
  kind: NotificationErrorKind;
  retryable: boolean;
  /** Short, PII-free classification label for the outbox/observability view. */
  reason: string;
}

const TERMINAL_ERROR_PATTERNS: Array<[RegExp, string]> = [
  [/invalid\s*(recipient|address|email|sender|to)\b/i, "invalid_recipient"],
  [/permanent\s*(failure|rejection|error|bounce)/i, "permanent_rejection"],
  [/authentication|unauthorized|access\s*denied|forbidden|invalid\s*credential/i, "authentication_failure"],
  [/sender\s*not\s*verified|email\s*address\s*not\s*verified|domain\s*not\s*verified/i, "unverified_sender"],
  [/suppressed\s*(address|recipient)/i, "suppressed_recipient"],
  [/message\s*rejected:\s*address\s*(is\s*)?(invalid|blacklisted|blocked)/i, "permanent_rejection"],
];

const RETRYABLE_ERROR_PATTERNS: Array<[RegExp, string]> = [
  [/timed?\s*out|timeout|etimedout/i, "timeout"],
  [/econnreset|econnrefused|epipe|enotfound|eai_again|network|socket\s*hang\s*up/i, "network_error"],
  [/throttl|rate\s*limit|too\s*many\s*requests/i, "throttling"],
  [/service\s*unavailable|temporarily\s*unavailable|internal\s*server\s*error|bad\s*gateway/i, "provider_5xx"],
];

/**
 * Distinguish transient failures (timeout / SES throttling / provider 5xx) from
 * terminal ones (invalid recipient, auth failure, permanent rejection).
 * Unknown errors default to RETRYABLE — never discard a message on a guess.
 */
export function classifyNotificationError(error: unknown): ClassifiedNotificationError {
  const text = String(
    error instanceof Error ? error.message : error != null ? (error as any).message || error : ""
  );

  for (const [re, reason] of TERMINAL_ERROR_PATTERNS) {
    if (re.test(text)) return { kind: "terminal", retryable: false, reason };
  }

  const statusMatch = text.match(/\b([45]\d{2})\b/);
  if (statusMatch) {
    const status = Number(statusMatch[1]);
    if (status === 408 || status === 429 || status >= 500) {
      return { kind: "retryable", retryable: true, reason: status === 429 ? "throttling" : status === 408 ? "timeout" : "provider_5xx" };
    }
    return { kind: "terminal", retryable: false, reason: "http_4xx" };
  }

  for (const [re, reason] of RETRYABLE_ERROR_PATTERNS) {
    if (re.test(text)) return { kind: "retryable", retryable: true, reason };
  }
  return { kind: "retryable", retryable: true, reason: "unknown_retryable" };
}

/** Keep recipient addresses out of stored error text and logs. */
export function redactPii(text: string): string {
  return String(text || "").replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g, "[redacted]");
}

export interface NotificationRetryPlan {
  attempts: number;
  status: "failed";
  delivery_status: "retrying" | "dead_lettered" | "failed_terminal";
  next_attempt_at: string | null;
  last_error: string;
  error_kind: NotificationErrorKind;
  terminal_reason: string | null;
  dead_lettered_at: string | null;
  ok: boolean;
}

/**
 * Pure transition for one failed attempt. Terminal errors go straight to a
 * terminal state; transient errors get a scheduled retry until the configured
 * maximum is reached, at which point the row is dead-lettered (never discarded).
 */
export function planNotificationRetry(params: {
  attempts: number;
  error: unknown;
  now?: Date;
  maxAttempts?: number;
  env?: NodeJS.ProcessEnv;
}): NotificationRetryPlan {
  const now = params.now ?? new Date();
  const info = classifyNotificationError(params.error);
  const attempts = Math.max(0, Math.floor(Number(params.attempts) || 0)) + 1;
  const max = params.maxAttempts ?? notificationMaxAttempts(params.env);
  const rawError = String(
    params.error instanceof Error ? params.error.message : params.error ?? ""
  );
  const last_error = redactPii(rawError).slice(0, 2000) || info.reason;
  const base = {
    attempts,
    status: "failed" as const,
    last_error,
    error_kind: info.kind,
    ok: false,
  };

  if (info.kind === "terminal") {
    return {
      ...base,
      delivery_status: "failed_terminal",
      terminal_reason: info.reason,
      dead_lettered_at: null,
      next_attempt_at: null,
    };
  }
  if (attempts >= max) {
    return {
      ...base,
      delivery_status: "dead_lettered",
      terminal_reason: "max_attempts_reached",
      dead_lettered_at: now.toISOString(),
      next_attempt_at: null,
    };
  }
  const delay = notificationBackoffDelayMs(attempts - 1);
  return {
    ...base,
    delivery_status: "retrying",
    terminal_reason: null,
    dead_lettered_at: null,
    next_attempt_at: new Date(now.getTime() + delay).toISOString(),
  };
}

/* ── Claim / lease + worker (adapters) ────────────────────────────────────── */

export interface NotificationRetryRow {
  id: string;
  recipient: string | null;
  template: string;
  data: unknown;
  attempts: number;
  max_attempts: number;
  provider_message_id: string | null;
  event_key: string | null;
  error_kind: string | null;
}

export interface WorkerDeps {
  query?: QueryExecutor;
  workerId?: string;
  leaseMs?: number;
  limit?: number;
}

function workerIdFor(deps: WorkerDeps): string {
  return deps.workerId || `svk-retry-${process.pid}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Atomically claim due rows with a short lease. FOR UPDATE SKIP LOCKED means two
 * workers never pick the same row; an expired lease (e.g. after a process died
 * mid-send) makes the row claimable again on the next run — this is the
 * shutdown-safety / restart-recovery path.
 */
export async function claimDueRetries(deps: WorkerDeps = {}): Promise<NotificationRetryRow[]> {
  const run = deps.query ?? runQuery;
  const leaseMs = Math.max(1000, Number(deps.leaseMs) || 60_000);
  const limit = Math.max(1, Math.min(200, Number(deps.limit) || 50));
  return run<NotificationRetryRow>(
    `UPDATE "app_notification"
        SET "lease_owner" = $1,
            "lease_until" = now() + ($2::text || ' milliseconds')::interval
      WHERE "id" IN (
        SELECT "id" FROM "app_notification"
         WHERE "delivery_status" = 'retrying'
           AND "next_attempt_at" <= now()
           AND ("lease_until" IS NULL OR "lease_until" < now())
           AND "deleted_at" IS NULL
         ORDER BY "next_attempt_at" ASC, "created_at" ASC
         LIMIT $3
         FOR UPDATE SKIP LOCKED
      )
     RETURNING "id", "recipient", "template", "data", "attempts",
               "max_attempts", "provider_message_id", "event_key", "error_kind"`,
    [workerIdFor(deps), String(leaseMs), limit]
  );
}

/** Release a lease only if this worker still owns it. */
export async function releaseLease(
  id: string,
  owner: string,
  deps: { query?: QueryExecutor } = {}
): Promise<void> {
  const run = deps.query ?? runQuery;
  await run(
    `UPDATE "app_notification"
        SET "lease_owner" = NULL, "lease_until" = NULL
      WHERE "id" = $1 AND "lease_owner" = $2`,
    [id, owner]
  );
}

export interface RetrySendPayload {
  id: string;
  to: string;
  template: string;
  data: Record<string, any>;
  /** Stable logical key derived from the original event_key; never a random key. */
  eventKey: string;
  attempt: number;
}

export interface RetrySendResult {
  status: "sent" | "skipped" | "failed";
  messageId?: string | null;
  error?: string;
}

export interface RetryWorkerDeps extends WorkerDeps {
  send?: (payload: RetrySendPayload) => Promise<RetrySendResult>;
  env?: NodeJS.ProcessEnv;
  now?: () => Date;
}

export interface RetryBatchResult {
  claimed: number;
  sent: number;
  scheduled: number;
  deadLettered: number;
  terminal: number;
  skipped: number;
}

async function patchClaimedRow(
  run: QueryExecutor,
  id: string,
  owner: string,
  patch: Record<string, any>
): Promise<void> {
  const columns = Object.keys(patch);
  const assignments = columns
    .map((column, index) => `"${column}" = $${index + 3}`)
    .join(", ");
  await run(
    `UPDATE "app_notification"
        SET ${assignments},
            "lease_owner" = NULL, "lease_until" = NULL,
            "updated_at" = now()
      WHERE "id" = $1 AND "lease_owner" = $2`,
    [id, owner, ...columns.map((column) => patch[column])]
  );
}

/**
 * Work one batch of due retries. A send adapter is injected in tests; the
 * production adapter posts through the same backend templates/transport with a
 * retry-scoped key. Counts are returned for admin observability.
 */
export async function processNotificationRetries(
  deps: RetryWorkerDeps = {}
): Promise<RetryBatchResult> {
  const run = deps.query ?? runQuery;
  const send = deps.send ?? sendRetryViaBackend;
  const now = deps.now ?? (() => new Date());
  const owner = workerIdFor(deps);
  const result: RetryBatchResult = {
    claimed: 0, sent: 0, scheduled: 0, deadLettered: 0, terminal: 0, skipped: 0,
  };

  const rows = await claimDueRetries({ ...deps, workerId: owner });
  result.claimed = rows.length;

  for (const row of rows) {
    const attempts = Math.max(0, Number(row.attempts) || 0);

    // IDEMPOTENCY: a recorded provider id means SES already accepted this
    // message. Re-sending would risk a duplicate customer email, so we only
    // reconcile the row and release the lease.
    if (row.provider_message_id) {
      await patchClaimedRow(run, row.id, owner, {
        status: "sent",
        delivery_status: "accepted",
        error_message: null,
        last_error: null,
        next_attempt_at: null,
        last_attempt_at: now().toISOString(),
      });
      result.skipped += 1;
      continue;
    }

    const eventKey = String(
      row.event_key || `${row.template}:${row.id}`
    );
    const data = (row.data || {}) as Record<string, any>;
    let outcome: RetrySendResult;
    try {
      if (!row.recipient) {
        throw new Error("Notification has no recipient address");
      }
      outcome = await send({
        id: row.id,
        to: row.recipient,
        template: row.template,
        data: { ...data, eventKey },
        eventKey,
        attempt: attempts + 1,
      });
    } catch (err) {
      outcome = {
        status: "failed",
        error: err instanceof Error ? err.message : String(err),
      };
    }

    if (outcome.status === "sent") {
      // "accepted by the provider", NOT delivered — delivery is only set by a
      // verified SES event (GAP-07).
      await patchClaimedRow(run, row.id, owner, {
        status: "sent",
        delivery_status: "accepted",
        provider_message_id: outcome.messageId ?? null,
        error_message: null,
        last_error: null,
        error_kind: null,
        terminal_reason: null,
        next_attempt_at: null,
        attempts: attempts + 1,
        last_attempt_at: now().toISOString(),
      });
      result.sent += 1;
      continue;
    }

    if (outcome.status === "skipped") {
      // No transport configured: do not burn an attempt or schedule a retry.
      await patchClaimedRow(run, row.id, owner, {
        status: "skipped",
        delivery_status: "skipped",
        last_error: null,
        next_attempt_at: null,
      });
      result.skipped += 1;
      continue;
    }

    const plan = planNotificationRetry({
      attempts,
      error: outcome.error || "Retry failed without an error message",
      now: now(),
      maxAttempts: Number(row.max_attempts) || undefined,
      env: deps.env,
    });
    await patchClaimedRow(run, row.id, owner, {
      status: plan.status,
      delivery_status: plan.delivery_status,
      attempts: plan.attempts,
      last_error: plan.last_error,
      error_message: plan.last_error,
      error_kind: plan.error_kind,
      terminal_reason: plan.terminal_reason,
      dead_lettered_at: plan.dead_lettered_at,
      next_attempt_at: plan.next_attempt_at,
      last_attempt_at: now().toISOString(),
    });
    if (plan.delivery_status === "retrying") result.scheduled += 1;
    else if (plan.delivery_status === "dead_lettered") result.deadLettered += 1;
    else result.terminal += 1;
  }

  return result;
}

/** Production send adapter: reuse the backend's templates and SES transport. */
async function sendRetryViaBackend(payload: RetrySendPayload): Promise<RetrySendResult> {
  const backendUrl = (
    process.env.MEDUSA_BACKEND_URL ||
    process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ||
    "http://localhost:9000"
  ).replace(/\/+$/, "");
  const publishableKey =
    process.env.MEDUSA_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY ||
    "";
  const retryKey = `${payload.eventKey}:retry-attempt-${payload.attempt}`;

  const res = await fetch(`${backendUrl}/store/notifications/send`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-publishable-api-key": publishableKey,
    },
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
    body: JSON.stringify({
      to: payload.to,
      template: payload.template,
      data: { ...payload.data, eventKey: retryKey },
    }),
  });
  const text = await res.text().catch(() => "");
  if (!res.ok) {
    throw new Error(`Notification service returned ${res.status}: ${text.slice(0, 300)}`);
  }
  const body = JSON.parse(text || "{}") as {
    status?: string;
    id?: string;
    error?: string;
  };
  // The backend maps a provider acceptance to status "sent". MessageId is read
  // back from the attempt row so the original can guard against a re-send.
  let messageId: string | null = null;
  if (body.id) {
    const rows = await runQuery<{ provider_message_id: string | null }>(
      `SELECT "provider_message_id" FROM "app_notification" WHERE "id" = $1 LIMIT 1`,
      [body.id]
    );
    messageId = rows[0]?.provider_message_id ?? null;
  }
  return {
    status: body.status === "sent" ? "sent" : body.status === "skipped" ? "skipped" : "failed",
    messageId,
    error: body.error ?? undefined,
  };
}

/* ── Admin observability (adapter) ────────────────────────────────────────── */

export interface NotificationRetryStats {
  total: number;
  queued: number;
  retrying: number;
  dueNow: number;
  deadLettered: number;
  terminalFailed: number;
  accepted: number;
  delivered: number;
  suppressed: number;
}

/** Counts for the admin outbox dashboard; reads only, no recipient PII. */
export async function notificationRetryStats(
  deps: { query?: QueryExecutor } = {}
): Promise<NotificationRetryStats> {
  const run = deps.query ?? runQuery;
  const rows = await run<Record<string, number>>(
    `SELECT
       count(*)::int AS "total",
       count(*) FILTER (WHERE "delivery_status" = 'queued')::int AS "queued",
       count(*) FILTER (WHERE "delivery_status" = 'retrying')::int AS "retrying",
       count(*) FILTER (WHERE "delivery_status" = 'retrying' AND "next_attempt_at" <= now())::int AS "dueNow",
       count(*) FILTER (WHERE "delivery_status" = 'dead_lettered')::int AS "deadLettered",
       count(*) FILTER (WHERE "delivery_status" = 'failed_terminal')::int AS "terminalFailed",
       count(*) FILTER (WHERE "delivery_status" = 'accepted')::int AS "accepted",
       count(*) FILTER (WHERE "delivery_status" = 'delivered')::int AS "delivered",
       count(*) FILTER (WHERE "suppressed")::int AS "suppressed"
     FROM "app_notification" WHERE "deleted_at" IS NULL`
  );
  const r = rows[0] || ({} as Record<string, number>);
  return {
    total: Number(r.total || 0),
    queued: Number(r.queued || 0),
    retrying: Number(r.retrying || 0),
    dueNow: Number(r.dueNow || 0),
    deadLettered: Number(r.deadLettered || 0),
    terminalFailed: Number(r.terminalFailed || 0),
    accepted: Number(r.accepted || 0),
    delivered: Number(r.delivered || 0),
    suppressed: Number(r.suppressed || 0),
  };
}

/* ── SNS signature verification (pure) ────────────────────────────────────── */

export interface SnsMessage {
  Type?: string;
  MessageId?: string;
  Token?: string;
  TopicArn?: string;
  Subject?: string;
  Message?: string;
  Timestamp?: string;
  SignatureVersion?: string;
  Signature?: string;
  SigningCertURL?: string;
  SubscribeURL?: string;
  [key: string]: any;
}

export function isSnsMessage(value: unknown): value is SnsMessage {
  if (!value || typeof value !== "object") return false;
  const m = value as SnsMessage;
  return (
    typeof m.Type === "string" &&
    typeof m.MessageId === "string" &&
    typeof m.Message === "string" &&
    typeof m.Timestamp === "string" &&
    typeof m.TopicArn === "string" &&
    typeof m.Signature === "string" &&
    typeof m.SigningCertURL === "string"
  );
}

/** Reject SSRF: only SNS's own HTTPS certificate host and path are trusted. */
export function isTrustedSnsCertUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:" || u.username || u.password || u.search || u.hash) return false;
    const host = u.hostname.toLowerCase();
    if (!/^sns\.[a-z0-9-]+\.amazonaws\.com(\.cn)?$/.test(host) && host !== "sns.amazonaws.com") {
      return false;
    }
    return /^\/SimpleNotificationService\/[0-9a-f]+\.pem$/.test(u.pathname);
  } catch {
    return false;
  }
}

/** Subscription confirmation must call SNS itself, never an arbitrary URL. */
export function isTrustedSnsSubscribeUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:" || u.username || u.password) return false;
    const host = u.hostname.toLowerCase();
    if (!/^sns\.[a-z0-9-]+\.amazonaws\.com(\.cn)?$/.test(host) && host !== "sns.amazonaws.com") {
      return false;
    }
    return /Action=ConfirmSubscription/i.test(u.search);
  } catch {
    return false;
  }
}

/** The exact signed string for SNS SignatureVersion 1 and 2. */
export function snsCanonicalString(message: SnsMessage, version: string): string | null {
  const v = String(version || "").trim();
  if (v !== "1" && v !== "2") return null;
  const type = message.Type;
  if (
    type !== "Notification" &&
    type !== "SubscriptionConfirmation" &&
    type !== "UnsubscribeConfirmation"
  ) {
    return null;
  }
  const body = message.Message;
  const id = message.MessageId;
  const timestamp = message.Timestamp;
  const topicArn = message.TopicArn;
  if (typeof body !== "string" || !id || !timestamp || !topicArn) return null;

  if (v === "1") {
    if (type === "Notification") {
      const subject = message.Subject;
      return typeof subject === "string" && subject.length
        ? `Message\n${body}\nMessageId\n${id}\nSubject\n${subject}\nTimestamp\n${timestamp}\nTopicArn\n${topicArn}\n`
        : `Message\n${body}\nMessageId\n${id}\nTimestamp\n${timestamp}\nTopicArn\n${topicArn}\n`;
    }
    if (!message.Token) return null;
    return `Message\n${body}\nMessageId\n${id}\nTimestamp\n${timestamp}\nTopicArn\n${topicArn}\nToken\n${message.Token}\n`;
  }

  // Version 2: name/value pairs in SNS's documented order, each newline-ended.
  const fields: string[] = ["Message", body, "MessageId", id];
  if (type === "Notification" && typeof message.Subject === "string" && message.Subject.length) {
    fields.push("Subject", message.Subject);
  }
  fields.push("Timestamp", timestamp, "TopicArn", topicArn);
  if (type !== "Notification") {
    if (!message.Token) return null;
    fields.push("Token", message.Token);
  }
  fields.push("Type", type);
  return fields.map((field) => `${field}\n`).join("");
}

/** Verify the SNS signature against a trusted certificate. Never trust raw JSON. */
export function verifySnsSignature(message: SnsMessage, certPem: string): boolean {
  try {
    if (!isSnsMessage(message) || typeof certPem !== "string" || !certPem.trim()) return false;
    const version = String(message.SignatureVersion || "").trim();
    const canonical = snsCanonicalString(message, version);
    if (!canonical || typeof message.Signature !== "string" || !message.Signature.trim()) {
      return false;
    }
    let key;
    try {
      key = new X509Certificate(certPem).publicKey;
    } catch {
      key = createPublicKey(certPem);
    }
    const verifier = createVerify(version === "1" ? "RSA-SHA1" : "RSA-SHA256");
    verifier.update(canonical, "utf8");
    verifier.end();
    const signature = Buffer.from(message.Signature, "base64");
    return signature.length > 0 && verifier.verify(key, signature);
  } catch {
    return false;
  }
}

/** Cheap fail-closed checks before paying the cost of fetching a certificate. */
export function precheckSnsMessage(
  message: unknown,
  options: { topicArn?: string; headerType?: string } = {}
): { ok: boolean; reason?: string } {
  if (!isSnsMessage(message)) return { ok: false, reason: "malformed_envelope" };
  if (options.headerType && message.Type !== options.headerType) {
    return { ok: false, reason: "type_mismatch" };
  }
  if (options.topicArn && message.TopicArn !== options.topicArn) {
    return { ok: false, reason: "topic_mismatch" };
  }
  if (!isTrustedSnsCertUrl(message.SigningCertURL || "")) {
    return { ok: false, reason: "untrusted_cert_url" };
  }
  return { ok: true };
}

/** Fetch and cache an SNS signing certificate; only trusted URLs are fetched. */
const snsCertCache = new Map<string, { pem: string; fetchedAt: number }>();

async function fetchSnsCertificate(url: string): Promise<string | null> {
  if (!isTrustedSnsCertUrl(url)) return null;
  const cached = snsCertCache.get(url);
  if (cached && Date.now() - cached.fetchedAt < 3_600_000) return cached.pem;
  const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(10_000) });
  if (!res.ok) return null;
  const pem = await res.text();
  if (!pem || pem.length > 100_000 || !/BEGIN CERTIFICATE/.test(pem)) return null;
  snsCertCache.set(url, { pem, fetchedAt: Date.now() });
  return pem;
}

/* ── SES event mapping + suppression policy (pure) ────────────────────────── */

export type SesEventType = "delivery" | "bounce" | "complaint" | "reject" | "delivery_delay";

export interface SesEvent {
  eventType: SesEventType;
  /** SES MessageId — joined to app_notification.provider_message_id. */
  messageId: string | null;
  bounceType: string | null;
  timestamp: string | null;
  snsMessageId: string;
}

const SES_EVENT_TYPES: Record<string, SesEventType> = {
  Delivery: "delivery",
  Bounce: "bounce",
  Complaint: "complaint",
  Reject: "reject",
  DeliveryDelay: "delivery_delay",
};

/** Parse an SES event from an SNS Notification. No recipient address is kept. */
export function parseSesEvent(message: SnsMessage): SesEvent | null {
  if (!message || message.Type !== "Notification" || typeof message.Message !== "string") {
    return null;
  }
  let payload: any;
  try {
    payload = JSON.parse(message.Message);
  } catch {
    return null;
  }
  const eventType = SES_EVENT_TYPES[String(payload?.eventType || "").trim()];
  if (!eventType) return null;
  return {
    eventType,
    messageId: typeof payload?.mail?.messageId === "string" ? payload.mail.messageId : null,
    bounceType: typeof payload?.bounce?.bounceType === "string" ? payload.bounce.bounceType : null,
    timestamp:
      typeof payload?.mail?.timestamp === "string"
        ? payload.mail.timestamp
        : typeof payload?.bounce?.timestamp === "string"
          ? payload.bounce.timestamp
          : null,
    snsMessageId: String(message.MessageId || ""),
  };
}

export function sesEventDeliveryStatus(type: SesEventType): string {
  switch (type) {
    case "delivery": return "delivered";
    case "bounce": return "bounced";
    case "complaint": return "complained";
    case "reject": return "rejected";
    case "delivery_delay": return "delivery_delayed";
  }
}

/**
 * Only delivery/bounce fit the legacy six-value `status` CHECK; the other
 * events are recorded in `delivery_status` without rewriting `status`.
 */
export function sesEventLegacyStatus(type: SesEventType): "delivered" | "bounced" | null {
  if (type === "delivery") return "delivered";
  if (type === "bounce") return "bounced";
  return null;
}

export interface SuppressionDecision {
  suppress: boolean;
  reason: "hard_bounce" | "complaint" | null;
}

/**
 * Conservative DEFAULT policy — no external business rules invented:
 *   - hard bounce (bounceType "Permanent") → suppress
 *   - complaint → suppress
 *   - soft bounce, delivery delay, reject, delivery → no suppression
 * Owner-configurable with SES_SUPPRESS_ON_BOUNCE / SES_SUPPRESS_ON_COMPLAINT
 * ("false" disables each). This is a default, not a legal/compliance decision.
 */
export function shouldSuppressSesEvent(
  event: SesEvent,
  env: NodeJS.ProcessEnv = process.env
): SuppressionDecision {
  const bounceEnabled = String(env.SES_SUPPRESS_ON_BOUNCE ?? "true").toLowerCase() !== "false";
  const complaintEnabled = String(env.SES_SUPPRESS_ON_COMPLAINT ?? "true").toLowerCase() !== "false";
  if (
    event.eventType === "bounce" &&
    bounceEnabled &&
    /^permanent$/i.test(event.bounceType || "")
  ) {
    return { suppress: true, reason: "hard_bounce" };
  }
  if (event.eventType === "complaint" && complaintEnabled) {
    return { suppress: true, reason: "complaint" };
  }
  return { suppress: false, reason: null };
}

/* ── Verified event application (adapter) ─────────────────────────────────── */

export interface SesEventApplyResult {
  applied: boolean;
  reason?: string;
  notificationId?: string | null;
  deliveryStatus?: string;
  suppressed?: boolean;
}

/**
 * Apply ONE verified SES event. The caller MUST have verified the SNS signature
 * first; this function never parses or trusts raw request JSON. Dedupe is by
 * SNS MessageId, so a redelivered event cannot write a second effect.
 */
export async function applyVerifiedSesEvent(
  event: SesEvent,
  deps: { query?: QueryExecutor; env?: NodeJS.ProcessEnv } = {}
): Promise<SesEventApplyResult> {
  const run = deps.query ?? runQuery;
  const env = deps.env ?? process.env;
  if (!event.snsMessageId) return { applied: false, reason: "missing_event_id" };

  const inserted = await run<{ id: string }>(
    `INSERT INTO "notification_event"
       ("provider", "provider_event_id", "event_type", "message_id", "bounce_type")
     VALUES ('ses', $1, $2, $3, $4)
     ON CONFLICT ("provider", "provider_event_id") DO NOTHING
     RETURNING "id"`,
    [event.snsMessageId, event.eventType, event.messageId, event.bounceType]
  );
  if (inserted.length === 0) return { applied: false, reason: "duplicate_event" };

  let notificationId: string | null = null;
  if (event.messageId) {
    const rows = await run<{ id: string }>(
      `SELECT "id" FROM "app_notification"
        WHERE "provider_message_id" = $1 AND "deleted_at" IS NULL
        ORDER BY "created_at" DESC LIMIT 1`,
      [event.messageId]
    );
    notificationId = rows[0]?.id ?? null;
  }

  const decision = shouldSuppressSesEvent(event, env);
  const deliveryStatus = sesEventDeliveryStatus(event.eventType);
  const legacy = sesEventLegacyStatus(event.eventType);

  if (notificationId) {
    const assignments: string[] = [
      '"delivery_status" = $2',
      '"last_delivery_event_at" = now()',
      '"updated_at" = now()',
    ];
    const params: any[] = [notificationId, deliveryStatus];
    if (legacy) {
      assignments.push('"status" = $3');
      params.push(legacy);
    }
    if (decision.suppress) assignments.push('"suppressed" = true');
    await run(
      `UPDATE "app_notification" SET ${assignments.join(", ")} WHERE "id" = $1`,
      params
    );

    if (decision.suppress && decision.reason) {
      // The recipient is selected inside SQL and is never logged here.
      await run(
        `INSERT INTO "notification_suppression" ("recipient", "reason")
         SELECT "recipient", $2 FROM "app_notification"
          WHERE "id" = $1 AND "recipient" IS NOT NULL
         ON CONFLICT DO NOTHING`,
        [notificationId, decision.reason]
      ).catch(() => undefined);
    }
  }

  await run(
    `UPDATE "notification_event" SET "notification_id" = $2, "received_at" = now() WHERE "id" = $1`,
    [inserted[0].id, notificationId]
  );

  return {
    applied: true,
    notificationId,
    deliveryStatus,
    suppressed: decision.suppress,
  };
}

/** Verify + apply an SNS delivery notification end to end (route helper). */
export async function processVerifiedSnsNotification(
  message: SnsMessage,
  certPem: string,
  deps: { query?: QueryExecutor; env?: NodeJS.ProcessEnv } = {}
): Promise<SesEventApplyResult> {
  if (!precheckSnsMessage(message, { topicArn: deps.env?.SES_SNS_TOPIC_ARN }).ok) {
    return { applied: false, reason: "untrusted_envelope" };
  }
  if (!verifySnsSignature(message, certPem)) {
    return { applied: false, reason: "invalid_signature" };
  }
  const event = parseSesEvent(message);
  if (!event) return { applied: false, reason: "unrecognised_event" };
  return applyVerifiedSesEvent(event, deps);
}

/** The running webhook needs the certificate bytes; kept as an injectable seam. */
export async function getSnsCertificate(url: string): Promise<string | null> {
  return fetchSnsCertificate(url);
}

/** Confirm an SNS subscription only after its signature and URL are verified. */
export async function confirmSnsSubscription(
  message: SnsMessage,
  certPem: string,
  fetchImpl: typeof fetch = fetch
): Promise<boolean> {
  if (message.Type !== "SubscriptionConfirmation" || !message.Token) return false;
  if (!isTrustedSnsCertUrl(message.SigningCertURL || "")) return false;
  if (!verifySnsSignature(message, certPem)) return false;
  const url = message.SubscribeURL || "";
  if (!isTrustedSnsSubscribeUrl(url)) return false;
  const res = await fetchImpl(url, { signal: AbortSignal.timeout(10_000) });
  return res.ok;
}
