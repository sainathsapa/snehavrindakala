/**
 * POST /api/partner/auth/logout
 *
 * Clears the partner session cookie. The token is stateless, so revocation on
 * the server side is handled by token_version bumps; clearing the cookie ends
 * this browser's session.
 */

import { NextResponse } from "next/server";
import { PARTNER_SESSION_COOKIE } from "@/lib/partner/session";

export const dynamic = "force-dynamic";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(PARTNER_SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return res;
}
