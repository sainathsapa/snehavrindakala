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
import { query as defaultQuery, resolveDatabaseUrl } from "@/lib/db";

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
      connectionString: resolveDatabaseUrl(),
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

  const client = new pg.Client({ connectionString: resolveDatabaseUrl() });
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
 * GAP-05 / GAP-07 — retry scheduling + verified delivery events
 * ------------------------------------------------------------------
 * Everything below is pure or adapter-only (an injectable query/send/cert
 * fetch). It never contacts a mail provider in a test. The SQL lives in migration
 * 005_notification_retry.sql; the HTTP entry point is
 * app/api/webhooks/resend/route.ts. The historical manual retry in lib/outbox.ts
 * is left untouched on purpose (it mints a fresh key and is an operator tool);
 * the automated worker below is a separate, counted, leased state machine.
 *
 * HONEST LIMITATION: the Resend send has no provider-side idempotency token. The
 * guards here are (1) a stable logical event_key, (2) an atomic lease so two
 * workers cannot process one row, and (3) a provider_message_id check so an
 * already-accepted message is never re-sent. An ambiguous timeout where the
 * provider accepted but the receipt was lost cannot be deduped by them — enabling
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
 * Distinguish transient failures (timeout / provider throttling / provider 5xx) from
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

    // IDEMPOTENCY: a recorded provider id means the provider already accepted this
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
      // verified provider event (GAP-07).
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

/** Production send adapter: reuse the backend's templates and the Resend transport. */
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
