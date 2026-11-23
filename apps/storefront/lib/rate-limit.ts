/**
 * A small, database-backed rate limiter for the public forms.
 *
 * The storefront had three unauthenticated POST endpoints — newsletter signup,
 * work alerts, and the inquiry form — and nothing between the internet and the
 * `INSERT`. Anyone could fill the subscriber table, and once SES is configured
 * a loop could send mail from the shop's domain. That is a reputational problem
 * before it is a cost problem.
 *
 * Postgres rather than memory: the storefront may run more than one process, and
 * an in-memory counter per process is a limit that multiplies by the number of
 * processes. A fixed window is enough here — this exists to stop scripts, not to
 * meter a customer.
 *
 * Failing open is deliberate. If the database is briefly unavailable the form
 * should still work; losing a real signup to protect against a hypothetical
 * script is the wrong trade for a shop this size.
 */

import { queryResult } from "@/lib/db";

/** Start of the fixed window containing `now`, in milliseconds. */
export function windowStart(now: number, windowSeconds: number): number {
  const size = Math.max(windowSeconds, 1) * 1000;
  return Math.floor(now / size) * size;
}

/** Seconds until the current window rolls over — the `Retry-After` value. */
export function secondsUntilReset(
  now: number,
  windowSeconds: number
): number {
  const size = Math.max(windowSeconds, 1) * 1000;
  const resetAt = windowStart(now, windowSeconds) + size;
  return Math.max(1, Math.ceil((resetAt - now) / 1000));
}

/** Pure, so the limit itself can be read and tested without a database. */
export function isLimited(count: number, limit: number): boolean {
  return count > limit;
}

/**
 * A key must not contain the raw IP in a way that is readable at a glance in a
 * database dump, but it does have to be stable, so it is salted-hashed.
 */
export function rateLimitKey(
  route: string,
  ip: string,
  secret: string | undefined
): string {
  const salt = (secret ?? "").trim() || "svk-rate-limit";
  // FNV-1a: enough to stop a casual reader of the table, and dependency-free.
  const input = `${salt}:${ip}`;
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index++) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `${route}:${hash.toString(16)}`;
}

export interface RateLimitResult {
  allowed: boolean;
  /** Seconds to wait, for the Retry-After header. */
  retryAfter: number;
  remaining: number;
}

export async function checkRateLimit(params: {
  route: string;
  ip: string | null;
  limit: number;
  windowSeconds: number;
  now?: number;
}): Promise<RateLimitResult> {
  const now = params.now ?? Date.now();
  const retryAfter = secondsUntilReset(now, params.windowSeconds);

  // No identity to count against: allow, because a missing header behind a
  // proxy must not lock real visitors out.
  if (!params.ip) {
    return { allowed: true, retryAfter, remaining: params.limit };
  }

  const key = rateLimitKey(params.route, params.ip, process.env.CRON_SECRET);
  const start = new Date(windowStart(now, params.windowSeconds)).toISOString();

  try {
    const result = await queryResult<{ count: number }>(
      `INSERT INTO rate_limit_hits (key, window_start, count)
       VALUES ($1, $2, 1)
       ON CONFLICT (key, window_start)
       DO UPDATE SET count = rate_limit_hits.count + 1
       RETURNING count`,
      [key, start]
    );
    const count = Number(result.rows[0]?.count ?? 1);

    // Occasional cleanup, so the table cannot grow without bound. Cheap, and it
    // only runs on ~1 in 200 requests.
    if (Math.random() < 0.005) {
      await queryResult(
        `DELETE FROM rate_limit_hits WHERE window_start < now() - interval '1 day'`
      );
    }

    return {
      allowed: !isLimited(count, params.limit),
      retryAfter,
      remaining: Math.max(0, params.limit - count),
    };
  } catch (error) {
    console.error("[rate-limit] check failed, allowing the request", error);
    return { allowed: true, retryAfter, remaining: params.limit };
  }
}

/**
 * Client address. Behind Caddy the first `x-forwarded-for` entry is the real
 * client; the `x-real-ip` header is set by some proxies instead.
 */
export function clientIp(headers: Headers): string | null {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = headers.get("x-real-ip")?.trim();
  return real || null;
}
