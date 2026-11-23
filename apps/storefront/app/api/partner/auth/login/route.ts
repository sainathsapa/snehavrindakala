/**
 * POST /api/partner/auth/login
 *
 * Authenticates a partner membership in its own auth context and sets the
 * signed partner session cookie. One generic error covers every failure so the
 * endpoint cannot be used to enumerate members or reveal account status.
 */

import { NextResponse } from "next/server";
import { authenticatePartnerMember } from "@/lib/partner-auth/login";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";
import {
  PARTNER_SESSION_COOKIE,
  PARTNER_SESSION_MAX_AGE,
  verifyPartnerToken,
} from "@/lib/partner/session";

export const dynamic = "force-dynamic";

const GENERIC_ERROR = "Invalid email or password";

export async function POST(req: Request) {
  const limit = await checkRateLimit({
    route: "partner-login",
    ip: clientIp(req.headers),
    limit: 8,
    windowSeconds: 15 * 60,
  });
  if (!limit.allowed) {
    return NextResponse.json(
      {
        ok: false,
        error: `Too many sign-in attempts. Please try again in ${limit.retryAfter} second(s).`,
      },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } }
    );
  }

  let body: { email?: unknown; password?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid request body" },
      { status: 400 }
    );
  }

  const email = typeof body.email === "string" ? body.email.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!email || !password) {
    return NextResponse.json(
      { ok: false, error: "Email and password are required" },
      { status: 400 }
    );
  }

  const token = await authenticatePartnerMember(email, password);
  if (!token) {
    return NextResponse.json({ ok: false, error: GENERIC_ERROR }, { status: 401 });
  }

  // The role is advisory in the cookie; requirePartnerPermission re-reads the
  // membership on every request and is the real gate.
  const role = verifyPartnerToken(token)?.role ?? "viewer";

  const res = NextResponse.json({ ok: true, role });
  res.cookies.set(PARTNER_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: PARTNER_SESSION_MAX_AGE,
  });
  return res;
}
