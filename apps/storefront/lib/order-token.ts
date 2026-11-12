/**
 * Signed, expiring order access tokens.
 *
 * A guest checks out, pays, and has no account — so `/order/[id]` cannot show
 * them the order they just bought. Instead of exposing the order publicly (the
 * old code did this by calling the admin API) or making the page useless until
 * an email arrives, completion issues a token that grants read access to that
 * one order for a limited time.
 *
 * The token is HMAC-signed with COOKIE_SECRET and travels in the URL, so it
 * works across devices and in an emailed link.
 */

import { createHmac, timingSafeEqual } from "crypto";

export const ORDER_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

function secret(): string {
  const value = process.env.COOKIE_SECRET || process.env.JWT_SECRET;
  if (!value) {
    throw new Error(
      "COOKIE_SECRET or JWT_SECRET is required to sign order access tokens."
    );
  }
  return value;
}

function sign(payload: string): string {
  return createHmac("sha256", secret())
    .update(payload)
    .digest("base64url");
}

/** Issue a token granting read access to `orderId` until `exp`. */
export function issueOrderToken(
  orderId: string,
  ttlSeconds = ORDER_TOKEN_TTL_SECONDS
): string {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const body = Buffer.from(JSON.stringify({ o: orderId, exp })).toString(
    "base64url"
  );
  return `${body}.${sign(body)}`;
}

/** True when `token` is a valid, unexpired grant for `orderId`. */
export function verifyOrderToken(
  token: string | undefined | null,
  orderId: string
): boolean {
  if (!token) return false;

  const [body, signature] = token.split(".");
  if (!body || !signature) return false;

  const expected = sign(body);
  const given = Buffer.from(signature);
  const want = Buffer.from(expected);
  if (given.length !== want.length || !timingSafeEqual(given, want)) {
    return false;
  }

  try {
    const claims = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8")
    ) as { o?: string; exp?: number };

    if (!claims.exp || claims.exp < Math.floor(Date.now() / 1000)) return false;
    return claims.o === orderId;
  } catch {
    return false;
  }
}
