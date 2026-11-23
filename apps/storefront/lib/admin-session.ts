/**
 * Signed admin session cookie for the SnehaVrinda Kala admin panel.
 *
 * Uses an HMAC-SHA256 signature so the cookie cannot be forged. The role is
 * embedded so the layout can render role-appropriate navigation without an
 * extra round-trip.
 */

import { createHmac, timingSafeEqual } from "crypto";
import { getAdminSessionSecret } from "./session-secret";

export const ADMIN_SESSION_COOKIE = "svk_admin_session";
export const ADMIN_SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export interface AdminSession {
  email: string;
  role: string;
  exp: number;
}

/** Uses the same chain as the Edge middleware verifier. Never a hardcoded prod fallback. */
function getSecret(): string {
  return getAdminSessionSecret();
}

function sign(payload: string): string {
  return createHmac("sha256", getSecret()).update(payload).digest("base64url");
}

export function signAdminSession(input: {
  email: string;
  role: string;
}): string {
  const session: AdminSession = {
    email: input.email,
    role: input.role,
    exp: Math.floor(Date.now() / 1000) + ADMIN_SESSION_MAX_AGE,
  };
  const body = Buffer.from(JSON.stringify(session)).toString("base64url");
  return `${body}.${sign(body)}`;
}

export function verifyAdminSession(token: string): AdminSession | null {
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;

  const expected = sign(body);
  const given = Buffer.from(signature);
  const want = Buffer.from(expected);
  if (given.length !== want.length || !timingSafeEqual(given, want)) {
    return null;
  }

  try {
    const session = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8")
    ) as AdminSession;
    if (!session.exp || session.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    if (!session.email || !session.role) return null;
    return session;
  } catch {
    return null;
  }
}
