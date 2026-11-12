/**
 * One shared Postgres pool for the storefront.
 *
 * Every admin route used to inline the same helper:
 *
 *   const { Pool } = require("pg");
 *   const pool = new Pool({ connectionString: DATABASE_URL });
 *   const client = await pool.connect();
 *   try { ... } finally { client.release(); pool.end(); }
 *
 * Creating and tearing down a pool per request means a fresh TLS handshake and
 * authentication every time, and under concurrency it can exhaust the server's
 * connection slots — the classic "too many clients already" failure. The pool
 * is now created once per process and reused.
 *
 * Cached on `global` so hot reloads in development, and multiple module
 * instances, do not each open their own.
 */

import pg from "pg";
import type { QueryResultRow } from "pg";

const DEFAULT_DATABASE_URL =
  "postgresql://medusa:medusa@localhost:5432/medusa";

declare global {
  // eslint-disable-next-line no-var
  var __svkPgPool: pg.Pool | undefined;
}

export function getPool(): pg.Pool {
  if (!global.__svkPgPool) {
    global.__svkPgPool = new pg.Pool({
      connectionString: process.env.DATABASE_URL || DEFAULT_DATABASE_URL,
      max: Number(process.env.PG_POOL_MAX || 10),
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    });

    // A pool-level error must not crash the process; the pool discards the
    // broken client and issues a new one on the next acquire.
    global.__svkPgPool.on("error", (err) => {
      console.error("[pg] idle client error", err);
    });
  }
  return global.__svkPgPool;
}

/** Run one query and return its rows. */
export async function query<T extends QueryResultRow = any>(
  sql: string,
  params: any[] = []
): Promise<T[]> {
  const result = await getPool().query<T>(sql, params);
  return result.rows;
}

/** Run one query and return the full result (rows, rowCount). */
export async function queryResult<T extends QueryResultRow = any>(
  sql: string,
  params: any[] = []
): Promise<pg.QueryResult<T>> {
  return getPool().query<T>(sql, params);
}

/**
 * Run a set of statements in a transaction. Rolls back on any error, so a
 * partial write cannot be left behind.
 */
export async function transaction<T>(
  fn: (client: pg.PoolClient) => Promise<T>
): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackErr) {
      console.error("[pg] rollback failed", rollbackErr);
    }
    throw err;
  } finally {
    client.release();
  }
}

/** Test helper: drop the cached pool. */
export async function __closePoolForTests(): Promise<void> {
  if (global.__svkPgPool) {
    const pool = global.__svkPgPool;
    global.__svkPgPool = undefined;
    await pool.end().catch(() => {});
  }
}
