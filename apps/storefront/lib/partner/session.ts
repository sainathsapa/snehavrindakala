/**
 * Signed partner session cookie. This is a DIFFERENT context from the admin
 * session: a separate cookie name and a namespaced HMAC key mean a partner token
 * can never be mistaken for an admin token, even though both derive from the
 * same deployment secret.
 *
 * The role and token version in the cookie are advisory; `requirePartnerContext`
 * re-reads the membership from the database on every request, so a suspended
 * member or a revoked session (bumped token_version) is rejected immediately.
 *
 * Namespace awareness: only partner roles (`partner_*`, or legacy bare partner
 * names during the transition) pass `isPartnerRole` here. A platform role —
 * bare or `platform_*` — fails verification, so a platform identity can never
 * be minted as a partner session. `resolvePartnerContext` canonicalises the
 * claim to the stable `partner_*` value before any permission check.
 */

import { createHmac, timingSafeEqual } from "crypto";
import {
  isPartnerRole,
  type PartnerRole,
  type PartnerSessionPayload,
} from "./types";

export const PARTNER_SESSION_COOKIE = "svk_partner_session";
export const PARTNER_SESSION_MAX_AGE = 60 * 60 * 12; // 12 hours

const NAMESPACE = "svk:partner-session:v1";

function getSecret(): string {
  const secret =
    process.env.PARTNER_SESSION_SECRET ||
    process.env.COOKIE_SECRET ||
    process.env.JWT_SECRET ||
    "";
  if (secret.length > 0) return `${secret}\u0000${NAMESPACE}`;
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "Partner session secret is not configured. Set PARTNER_SESSION_SECRET or COOKIE_SECRET."
    );
  }
  return `svk-dev-only-partner-secret\u0000${NAMESPACE}`;
}

function sign(body: string): string {
  return createHmac("sha256", getSecret()).update(body).digest("base64url");
}

export function signPartnerSession(input: {
  partnerId: string;
  membershipId: string;
  role: PartnerRole;
  tokenVersion: number;
  email: string;
}): string {
  const payload: PartnerSessionPayload = {
    pid: input.partnerId,
    mid: input.membershipId,
    role: input.role,
    ver: input.tokenVersion,
    email: input.email,
    exp: Math.floor(Date.now() / 1000) + PARTNER_SESSION_MAX_AGE,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

/** Pure verification: signature, expiry and shape. Does not touch the DB. */
export function verifyPartnerToken(token: string): PartnerSessionPayload | null {
  if (typeof token !== "string") return null;
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;

  const expected = sign(body);
  const givenBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expected);
  if (
    givenBuf.length !== expectedBuf.length ||
    !timingSafeEqual(givenBuf, expectedBuf)
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8")
    ) as PartnerSessionPayload;
    if (
      !payload ||
      typeof payload.pid !== "string" ||
      typeof payload.mid !== "string" ||
      typeof payload.ver !== "number" ||
      typeof payload.email !== "string" ||
      typeof payload.exp !== "number" ||
      !isPartnerRole(payload.role)
    ) {
      return null;
    }
    if (payload.exp <= Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}
