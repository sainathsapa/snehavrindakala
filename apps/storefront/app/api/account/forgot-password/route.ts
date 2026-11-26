/**
 * POST /api/account/forgot-password
 *
 * Records a reset request so the studio can act on it, and answers the same way
 * whether or not the address belongs to an account — anything else would let
 * someone use this form to test which emails are customers.
 *
 * The answer tells the truth about what will happen next: on a deployment with
 * no email transport, no link is coming, and saying otherwise is how the
 * previous placeholder wasted a customer's afternoon.
 */

import { NextResponse } from "next/server";
import { recordResetRequest, looksLikeEmail } from "@/lib/password-reset";
import { medusa } from "@/lib/medusa";
import { emailStatus } from "@/lib/config-status";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const wantsJson =
    (req.headers.get("accept") || "").includes("application/json") ||
    req.headers.get("x-requested-with") === "fetch";

  const limit = await checkRateLimit({
    route: "forgot-password",
    ip: clientIp(req.headers),
    limit: 5,
    windowSeconds: 3600,
  });
  if (!limit.allowed) {
    return NextResponse.json(
      { ok: false, error: "Too many attempts from this connection. Please try again later." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } }
    );
  }

  let email: unknown;
  const contentType = req.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    email = body.email;
  } else {
    const form = await req.formData().catch(() => null);
    email = form?.get("email");
  }

  const emailConfigured = emailStatus().level === "ready";

  try {
    // Recorded even if the address is not a customer: the row is harmless, and
    // checking first would turn this endpoint into an account oracle.
    await recordResetRequest(typeof email === "string" ? email : "");
  } catch (error) {
    console.error("[forgot-password] could not record the request", error);
    if (wantsJson) {
      return NextResponse.json(
        { ok: false, error: "Something went wrong. Please write to the studio directly." },
        { status: 500 }
      );
    }
    const origin = new URL(req.url).origin;
    return NextResponse.redirect(`${origin}/en/account/forgot-password?error=failed`, 303);
  }

  // Step two: ask Medusa to mint a single-use reset token. It never returns the
  // token over HTTP — the `auth.password_reset` subscriber mails it — so an
  // unknown address simply produces nothing, which is also the non-enumerable
  // answer. Failure here is not surfaced either: a "that address exists but mail
  // failed" response would be an oracle.
  if (emailConfigured && typeof email === "string" && looksLikeEmail(email)) {
    try {
      await medusa.requestPasswordReset(email.trim());
    } catch (error) {
      console.error("[forgot-password] reset request did not go through", error);
    }
  }

  if (wantsJson) {
    return NextResponse.json({
      ok: true,
      // Which of the two honest answers to give. Not a signal about the account.
      outcome: emailConfigured ? "sent" : "studio",
    });
  }

  const origin = new URL(req.url).origin;
  const query = emailConfigured ? "sent=1" : "sent=studio";
  return NextResponse.redirect(`${origin}/en/account/forgot-password?${query}`, 303);
}
