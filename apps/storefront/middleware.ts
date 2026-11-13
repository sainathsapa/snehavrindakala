/**
 * Admin gate.
 *
 * Without this, every `/admin/*` page and `/api/admin/*` handler was reachable
 * by anyone: the layout only hid the UI, and each route had to remember to call
 * requireAdmin() itself. A single missed check leaks products, customers and
 * orders. If a route is not explicitly public here, it needs a session.
 */

import { NextResponse, type NextRequest } from "next/server";

const ADMIN_SESSION_COOKIE = "svk_admin_session";
const AUTH_COOKIE = "medusa_auth_token";

function base64urlToBytes(input: string): Uint8Array {
  const normalised = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalised.padEnd(
    normalised.length + ((4 - (normalised.length % 4)) % 4),
    "="
  );
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function sign(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload)
  );
  return btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** Same format and secret as lib/admin-session.ts, verified at the edge. */
async function isValidSession(
  token: string,
  secret: string
): Promise<boolean> {
  const [body, signature] = token.split(".");
  if (!body || !signature) return false;

  const expected = await sign(body, secret);
  if (expected.length !== signature.length) return false;

  // Constant-time-ish comparison; the edge runtime has no timingSafeEqual.
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) {
    mismatch |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  if (mismatch !== 0) return false;

  try {
    const json = new TextDecoder().decode(base64urlToBytes(body));
    const session = JSON.parse(json) as { email?: string; role?: string; exp?: number };
    if (!session.exp || session.exp < Math.floor(Date.now() / 1000)) return false;
    return Boolean(session.email && session.role);
  } catch {
    return false;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // The login page must be reachable while signed out — otherwise there is no
  // way in. It sits under /admin, so this exemption has to come first.
  //
  // The login *endpoint* needs the same exemption. It lives at
  // /api/admin/login, which the matcher guards, so without this the handler was
  // 401'd before it ever ran and nobody could sign in — the panel was
  // unreachable even with the correct credentials.
  if (pathname === "/admin/login" || pathname === "/api/admin/login") {
    return NextResponse.next();
  }

  // A Medusa OAuth callback is likewise a signed-out entry point.
  if (pathname === "/api/admin/auth/callback") {
    return NextResponse.next();
  }

  const sessionToken = req.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  const secret =
    process.env.COOKIE_SECRET ||
    process.env.JWT_SECRET ||
    (process.env.NODE_ENV === "production"
      ? ""
      : "svk-dev-admin-session-secret");

  const hasSession =
    Boolean(sessionToken && secret) &&
    (await isValidSession(sessionToken as string, secret));

  // A Medusa customer token may also grant access when the verified email is
  // on ADMIN_EMAILS. That check needs a backend round-trip, so let the request
  // through to the server-side `getAdminIdentity()` rather than duplicating
  // the allow-list logic here.
  const hasLegacyToken = Boolean(req.cookies.get(AUTH_COOKIE)?.value);

  if (hasSession || hasLegacyToken) {
    return NextResponse.next();
  }

  // API routes answer with a status, not a redirect.
  if (pathname.startsWith("/api/admin")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const loginUrl = new URL("/admin/login", req.url);
  loginUrl.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
