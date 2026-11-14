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
import pg from "pg";

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

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS app_notifications (
    id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
    audience text NOT NULL DEFAULT 'admin',
    title text NOT NULL,
    message text NOT NULL,
    type text NOT NULL DEFAULT 'info',
    link text,
    read boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS idx_app_notifications_created
    ON app_notifications (created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_app_notifications_audience
    ON app_notifications (audience, read);
`;

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

/** Idempotent: creates the table once per process. */
export async function ensureSchema(): Promise<void> {
  if (!global.__svkNotificationSchemaReady) {
    global.__svkNotificationSchemaReady = pool()
      .query(SCHEMA)
      .then(() => undefined)
      .catch((err) => {
        // Let the next caller retry rather than caching a failure forever.
        global.__svkNotificationSchemaReady = undefined;
        throw err;
      });
  }
  return global.__svkNotificationSchemaReady;
}

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
