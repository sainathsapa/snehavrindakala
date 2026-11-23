/**
 * Partner password-reset tokens and confirmation.
 *
 * The token primitives are pure (no DB): an HMAC-signed `{mid, exp}` body with
 * its own namespace, so a partner session token can never be replayed as a
 * reset token. The two DB-backed helpers take an injectable executor so the
 * whole flow can be tested without a live database.
 *
 * Delivery of the token is deliberately NOT implemented here. Sending mail is
 * an owner-gated integration that needs configured SES; in development the API
 * hands the token to the caller for manual testing, and in production it only
 * acknowledges the request. No credentials are invented or assumed.
 */

import { createHmac, timingSafeEqual } from "crypto";
import { query as defaultQuery } from "@/lib/db";
import { hashPassword } from "@/lib/partner/password";
import {
  findMembershipByEmail,
  findMembershipById,
  type QueryExecutor,
} from "@/lib/partner/repository";

export const RESET_TOKEN_MAX_AGE = 60 * 60; // 1 hour

const NAMESPACE = "svk:partner-reset:v1";

function getSecret(): string {
  const secret =
    process.env.PARTNER_RESET_SECRET ||
    process.env.COOKIE_SECRET ||
    process.env.JWT_SECRET ||
    "";
  if (secret.length > 0) return `${secret}\u0000${NAMESPACE}`;
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "Partner reset secret is not configured. Set PARTNER_RESET_SECRET or COOKIE_SECRET."
    );
  }
  return `svk-dev-only-partner-reset-secret\u0000${NAMESPACE}`;
}

function sign(body: string): string {
  return createHmac("sha256", getSecret()).update(body).digest("base64url");
}

/** Issue a short-lived, signed reset token bound to one membership id. */
export function signResetToken(membershipId: string): string {
  if (typeof membershipId !== "string" || membershipId.length === 0) {
    throw new Error("A membership id is required to issue a reset token");
  }
  const body = Buffer.from(
    JSON.stringify({
      mid: membershipId,
      exp: Math.floor(Date.now() / 1000) + RESET_TOKEN_MAX_AGE,
    })
  ).toString("base64url");
  return `${body}.${sign(body)}`;
}

/** Verify signature, shape and expiry. Returns the membership id or null. */
export function verifyResetToken(token: string): string | null {
  if (typeof token !== "string") return null;
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;

  try {
    const expected = sign(body);
    const givenBuf = Buffer.from(signature);
    const expectedBuf = Buffer.from(expected);
    if (
      givenBuf.length !== expectedBuf.length ||
      !timingSafeEqual(givenBuf, expectedBuf)
    ) {
      return null;
    }

    const payload = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8")
    ) as { mid?: unknown; exp?: unknown };
    if (
      !payload ||
      typeof payload.mid !== "string" ||
      payload.mid.length === 0 ||
      typeof payload.exp !== "number"
    ) {
      return null;
    }
    if (payload.exp <= Math.floor(Date.now() / 1000)) return null;
    return payload.mid;
  } catch {
    return null;
  }
}

/**
 * Look up an active membership by email and mint a reset token for it.
 * Returns null for unknown, invited or suspended members — the route must give
 * the same outward answer either way so this endpoint is not an account oracle.
 */
export async function issueResetToken(
  email: string,
  executor?: QueryExecutor
): Promise<string | null> {
  if (typeof email !== "string") return null;
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;

  const run: QueryExecutor = executor ?? defaultQuery;
  const membership = await findMembershipByEmail(normalized, run);
  if (!membership || membership.status !== "active" || !membership.id) {
    return null;
  }
  return signResetToken(String(membership.id));
}

/**
 * Complete a reset: verify the token, hash the new password, store it and bump
 * token_version so every previously issued session for that member is revoked.
 * Returns false on a bad/expired token, a weak password or a missing member.
 */
export async function confirmPartnerPasswordReset(
  token: string,
  newPassword: string,
  executor?: QueryExecutor
): Promise<boolean> {
  const membershipId = verifyResetToken(token);
  if (!membershipId || typeof newPassword !== "string") return false;

  let passwordHash: string;
  try {
    passwordHash = hashPassword(newPassword);
  } catch {
    return false;
  }

  const run: QueryExecutor = executor ?? defaultQuery;
  const membership = await findMembershipById(membershipId, run);
  if (!membership || membership.status !== "active") return false;

  await run(
    "UPDATE partner_membership SET password_hash = $1, token_version = token_version + 1, updated_at = now() WHERE id = $2",
    [passwordHash, membershipId]
  );
  return true;
}
