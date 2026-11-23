/**
 * POST /api/partner/auth/reset
 *
 * Two actions in one endpoint:
 *   { action: "request", email }                  -> accept a reset request
 *   { action: "confirm", token, password }        -> set a new password
 *
 * Actual email delivery is owner-gated: it requires a configured SES transport,
 * which this deployment does not wire up. In production we only acknowledge the
 * request (202) and say so honestly — no credentials are invented and no mail
 * is sent. In development the token is returned so the flow is testable without
 * an email provider; that token is never handed out in production.
 */

import { NextResponse } from "next/server";
import { emailStatus } from "@/lib/config-status";
import {
  confirmPartnerPasswordReset,
  issueResetToken,
} from "@/lib/partner-auth/reset-token";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const IS_DEVELOPMENT = process.env.NODE_ENV !== "production";

export async function POST(req: Request) {
  const limit = await checkRateLimit({
    route: "partner-reset",
    ip: clientIp(req.headers),
    limit: 5,
    windowSeconds: 60 * 60,
  });
  if (!limit.allowed) {
    return NextResponse.json(
      {
        ok: false,
        error: "Too many attempts from this connection. Please try again later.",
      },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } }
    );
  }

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid request body" },
      { status: 400 }
    );
  }

  const isConfirm =
    body.action === "confirm" ||
    (typeof body.token === "string" && typeof body.password === "string");

  if (isConfirm) {
    const token = typeof body.token === "string" ? body.token : "";
    const password = typeof body.password === "string" ? body.password : "";
    if (!token || !password) {
      return NextResponse.json(
        { ok: false, error: "A reset token and a new password are required." },
        { status: 400 }
      );
    }
    const ok = await confirmPartnerPasswordReset(token, password);
    if (!ok) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "This reset link is invalid or expired, or the password is too short. Request a new one.",
        },
        { status: 400 }
      );
    }
    return NextResponse.json({
      ok: true,
      message:
        "Password updated. Existing sessions have been revoked. Please sign in again.",
    });
  }

  const email = typeof body.email === "string" ? body.email.trim() : "";
  if (!email) {
    return NextResponse.json(
      { ok: false, error: "An email address is required." },
      { status: 400 }
    );
  }

  if (!IS_DEVELOPMENT) {
    // No mail is sent from this build. Report the real configuration state, but
    // always answer the same way regardless of whether the address is a member.
    const status = emailStatus();
    return NextResponse.json(
      {
        ok: true,
        status: "accepted",
        delivery: "requires-ses",
        emailConfigured: status.level === "ready",
        message:
          "If an active partner membership uses that address, the reset request was accepted. Email delivery requires a configured SES transport; this deployment does not send email.",
      },
      { status: 202 }
    );
  }

  // Development-only affordance: expose a usable token for manual testing.
  let token: string | null = null;
  try {
    token = await issueResetToken(email);
  } catch (error) {
    console.error("[partner-reset] could not issue a development token", error);
  }

  return NextResponse.json({
    ok: true,
    mode: "development",
    token,
    message:
      "Email delivery requires configured SES. In development, use the returned token with action 'confirm' to finish the reset.",
  });
}
