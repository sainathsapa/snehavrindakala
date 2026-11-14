import createIntlMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "./i18n/routing";

/**
 * Locale routing, plus the admin gate.
 *
 * Two jobs, and order matters.
 *
 * 1. ADMIN GATE — runs first and is matched only by the admin paths below.
 *    Every `/admin/*` page and `/api/admin/*` handler was reachable by anyone
 *    before this existed: the layout only hid the UI, and each route had to
 *    remember to call requireAdmin() itself. If a route is not explicitly
 *    public here, it needs a session.
 *
 * 2. LOCALE — next-intl rewrites and redirects so `/shop` (English) and
 *    `/hi/shop` (Hindi) both resolve to the same route tree. English keeps bare
 *    URLs so nothing already indexed has to move.
 *
 * The admin area is deliberately outside the locale tree: the panel is used by
 * one person, in one language, and translating it would be pure overhead.
 */

const intlMiddleware = createIntlMiddleware(routing);

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

/** Constant-time compare so a wrong cookie cannot be found by timing. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function verifyAdminSession(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) return false;

  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const [payloadB64, signatureB64] = parts;

  try {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const expected = new Uint8Array(
      await crypto.subtle.sign(
        "HMAC",
        key,
        new TextEncoder().encode(payloadB64)
      )
    );

    const givenB64 = signatureB64.replace(/-/g, "+").replace(/_/g, "/");
    const given = base64urlToBytes(signatureB64);
    if (given.length !== expected.length) return false;
    if (
      !timingSafeEqual(
        Array.from(expected).join(","),
        Array.from(given).join(",")
      )
    ) {
      return false;
    }

    const payload = JSON.parse(
      new TextDecoder().decode(base64urlToBytes(payloadB64))
    );
    if (typeof payload?.exp === "number" && payload.exp < Date.now()) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Stamp the resolved locale onto the request the renderer will see.
 *
 * The header has to be on the *request*, because a server component reading
 * `headers()` never sees response headers — a response-only value left every
 * reader falling back to English.
 *
 * Crucially this mutates next-intl's own response rather than building a new
 * one. That response carries the internal rewrite that maps `/shop` onto the
 * `[locale]` route; replacing it with `NextResponse.next()` discarded the
 * rewrite and rendered an empty page. `NextResponse.next({request})` is used
 * only to carry the headers, and its `x-middleware-rewrite` is then pointed
 * back at intl's own target so the routing decision survives.
 */
function withLocaleHeader(
  response: NextResponse,
  locale: string,
  request: NextRequest
) {
  // A redirect must stay a redirect. next-intl answers `/shop` with a 307 to
  // `/hi/shop` when the NEXT_LOCALE cookie disagrees with the URL; rebuilding
  // that as a passthrough returned 200 with an empty body instead of sending
  // the browser to the right page. Redirects carry no body to render, so the
  // header is added to the existing response and returned untouched.
  if (response.status >= 300 && response.status < 400) {
    response.headers.set("x-locale", locale);
    return response;
  }

  const forwarded = new Headers(request.headers);
  forwarded.set("x-locale", locale);
  // The pre-rewrite pathname, so readers can tell `/shop` from `/en/shop`.
  forwarded.set("x-pathname", request.nextUrl.pathname);

  const passThrough = NextResponse.next({ request: { headers: forwarded } });
  const rewriteTarget = response.headers.get("x-middleware-rewrite");
  if (rewriteTarget) {
    passThrough.headers.set("x-middleware-rewrite", rewriteTarget);
  }

  // Keep intl's own hints (locale cookie, alternates, middleware-override).
  response.headers.forEach((value, key) => {
    const k = key.toLowerCase();
    if (k === "content-length") return;
    if (k === "x-middleware-rewrite") return;
    passThrough.headers.set(key, value);
  });
  passThrough.headers.set("x-locale", locale);
  return passThrough;
}

/** Pull the locale off a pathname, defaulting to English. */
function localeFromPath(pathname: string): string {
  const first = pathname.split("/")[1];
  return first && (routing.locales as readonly string[]).includes(first)
    ? first
    : routing.defaultLocale;
}

export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── Admin gate ──────────────────────────────────────────────────────────
  // Only admin paths reach this branch; everything else falls through to the
  // locale handler below.
  if (pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) {
    // The sign-in page and its handler are the only signed-out entry points.
    // Without these exceptions the login form 401'd before it ever ran and
    // nobody could reach the panel even with correct credentials.
    if (pathname === "/admin/login" || pathname === "/api/admin/login") {
      return NextResponse.next();
    }

    // A Medusa OAuth callback is likewise a signed-out entry point.
    if (pathname === "/api/admin/auth/callback") {
      return NextResponse.next();
    }

    const sessionToken = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
    const hasSession = await verifyAdminSession(sessionToken);
    const hasMedusaAuth = Boolean(request.cookies.get(AUTH_COOKIE)?.value);

    if (!hasSession && !hasMedusaAuth) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json(
          { error: "Unauthorized" },
          { status: 401 }
        );
      }
      const loginUrl = new URL("/admin/login", request.url);
      loginUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(loginUrl);
    }

    return NextResponse.next();
  }

  // ── Locale ──────────────────────────────────────────────────────────────
  const response = intlMiddleware(request);
  return withLocaleHeader(response, localeFromPath(pathname), request);
}

export const config = {
  // Everything except the admin gate (handled above and excluded so the two
  // matchers cannot both run), Next internals, static files and API routes
  // that are not admin.
  matcher: [
    "/admin/:path*",
    "/api/admin/:path*",
    "/((?!admin|api|_next|_vercel|uploads|.*\\..*).*)",
  ],
};
