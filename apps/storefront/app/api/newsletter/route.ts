/**
 * POST /api/newsletter — join the letter list.
 *
 * The footer form works without JavaScript, so this answers two ways: JSON for
 * the enhanced submit, and a redirect back to the page the form was on for a
 * plain form post. A 404 was the previous behaviour, so the important part is
 * that anything at all is returned.
 */

import { NextResponse } from "next/server";
import { subscribeEmail } from "@/lib/newsletter";

export const dynamic = "force-dynamic";

const MESSAGES: Record<string, string> = {
  subscribed: "Thank you — your first letter will find you.",
  already: "You are already on the list.",
  resubscribed: "Welcome back. The letters will resume.",
  invalid: "That email address does not look complete.",
};

/** Same-origin only: a redirect target from a form must never leave the site. */
function backTo(req: Request): string {
  const referer = req.headers.get("referer");
  const origin = new URL(req.url).origin;
  if (referer) {
    try {
      const url = new URL(referer);
      if (url.origin === origin) {
        url.searchParams.delete("letter");
        return `${url.toString()}#letters`;
      }
    } catch {
      // Malformed referer — fall through to the home page.
    }
  }
  return `${origin}/#letters`;
}

export async function POST(req: Request) {
  const wantsJson =
    (req.headers.get("accept") || "").includes("application/json") ||
    req.headers.get("x-requested-with") === "fetch";

  let email: unknown;
  let locale: string | undefined;
  let source: string | undefined;
  let consent: unknown = "on";

  const contentType = req.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    email = body.email;
    locale = typeof body.locale === "string" ? body.locale : undefined;
    source = typeof body.source === "string" ? body.source : undefined;
    consent = body.consent;
  } else {
    const form = await req.formData().catch(() => null);
    email = form?.get("email");
    locale = (form?.get("locale") as string) || undefined;
    source = (form?.get("source") as string) || undefined;
    consent = form?.get("consent");
  }

  // The checkbox is required in the markup; checked here too, because a request
  // can be made without the form. No consent, no row.
  if (consent !== null && consent !== undefined && consent !== "on" && consent !== true) {
    if (wantsJson) {
      return NextResponse.json({ ok: false, reason: "invalid" }, { status: 400 });
    }
    return NextResponse.redirect(backTo(req), 303);
  }

  let outcome: string;
  try {
    outcome = await subscribeEmail({ email, locale, source });
  } catch (error) {
    console.error("newsletter signup failed", error);
    if (wantsJson) {
      return NextResponse.json({ ok: false, reason: "error" }, { status: 500 });
    }
    return NextResponse.redirect(backTo(req), 303);
  }

  if (wantsJson) {
    return NextResponse.json(
      { ok: outcome !== "invalid", reason: outcome, message: MESSAGES[outcome] },
      { status: outcome === "invalid" ? 400 : 200 }
    );
  }

  return NextResponse.redirect(backTo(req), 303);
}
