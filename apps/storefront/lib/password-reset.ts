/**
 * Password resets, honestly.
 *
 * The previous endpoint was a stub: it answered "Reset link sent if account
 * exists" and sent nothing, created nothing, and told no one. A locked-out
 * customer waited for a letter that was never going to arrive, and the studio
 * never learned they were waiting.
 *
 * There are two ways out of that. The first is to build a token flow — issue a
 * single-use token, mail it, let the customer set a new password. That cannot be
 * exercised on this deployment, because the email transport is not configured
 * (see `lib/config-status.ts`); building it now would mean shipping an
 * untestable path and still telling the reader to wait.
 *
 * The second is to make the request real without email: record it, let the
 * studio see it in the admin, and have the studio reset the password by hand.
 * That works today, and it degrades into the first once SES is set up. This
 * file is the second.
 *
 * Nothing here reveals whether an account exists — the caller gets the same
 * answer either way, and the row is written regardless of whether the address
 * matches a customer, because checking would be an enumeration oracle.
 */

import { query, queryResult } from "@/lib/db";

export interface ResetRequest {
  id: number;
  email: string;
  requested_at: string;
  handled_at: string | null;
  handled_by: string | null;
}

/** Cheap shape check — the same one the other forms use. */
export function looksLikeEmail(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  return trimmed.length >= 5 && trimmed.length <= 254 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(trimmed);
}

/**
 * Records one request per address until the studio marks it done, so a person
 * clicking twice does not create two rows for the studio to reconcile.
 */
export async function recordResetRequest(
  email: string,
  now?: Date
): Promise<{ recorded: boolean; id: number | null }> {
  if (!looksLikeEmail(email)) return { recorded: false, id: null };
  const result = await queryResult<{ id: number }>(
    `INSERT INTO password_reset_requests (email, requested_at)
     VALUES (lower($1), $2)
     ON CONFLICT (lower(email)) WHERE handled_at IS NULL
     DO NOTHING
     RETURNING id`,
    [email.trim(), (now ?? new Date()).toISOString()]
  );
  return { recorded: true, id: result.rows[0]?.id ?? null };
}

export async function listResetRequests(): Promise<ResetRequest[]> {
  return query<ResetRequest>(
    `SELECT id, email, requested_at, handled_at, handled_by
       FROM password_reset_requests
      ORDER BY handled_at IS NOT NULL, requested_at DESC
      LIMIT 100`
  );
}

export async function markResetHandled(
  id: number,
  by: string | null
): Promise<boolean> {
  const result = await queryResult(
    `UPDATE password_reset_requests
        SET handled_at = now(), handled_by = $2
      WHERE id = $1 AND handled_at IS NULL`,
    [id, by]
  );
  return (result.rowCount ?? 0) > 0;
}

/**
 * What the reader should be told. This depends only on shop configuration,
 * never on whether the address is on file.
 */
export function resetOutcome(emailConfigured: boolean): "sent" | "studio" {
  return emailConfigured ? "sent" : "studio";
}
