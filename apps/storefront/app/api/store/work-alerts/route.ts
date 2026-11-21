/**
 * POST /api/store/work-alerts — ask to hear about the next work of a kind.
 *
 * Same two-response shape as the letter signup: JSON for the enhanced form and
 * a redirect for the plain one, because the form must work without JavaScript.
 */

import { NextResponse } from "next/server";
import { createWorkAlert } from "@/lib/work-alerts";

export const dynamic = "force-dynamic";

function backTo(req: Request): string {
  const referer = req.headers.get("referer");
  const origin = new URL(req.url).origin;
  if (referer) {
    try {
      const url = new URL(referer);
      if (url.origin === origin) return `${url.toString()}#work-alert`;
    } catch {
      // Fall through.
    }
  }
  return `${origin}/#work-alert`;
}

export async function POST(req: Request) {
  const wantsJson =
    (req.headers.get("accept") || "").includes("application/json") ||
    req.headers.get("x-requested-with") === "fetch";

  let payload: Record<string, unknown> = {};
  const contentType = req.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    payload = ((await req.json().catch(() => ({}))) ?? {}) as Record<string, unknown>;
  } else {
    const form = await req.formData().catch(() => null);
    payload = {
      email: form?.get("email"),
      artForm: form?.get("artForm"),
      priceMax: form?.get("priceMax"),
      locale: form?.get("locale"),
      consent: form?.get("consent"),
    };
  }

  const consent = payload.consent;
  const consented =
    consent === undefined || consent === "on" || consent === true || consent === "true";
  if (!consented) {
    if (wantsJson) {
      return NextResponse.json({ ok: false, reason: "consent" }, { status: 400 });
    }
    return NextResponse.redirect(backTo(req), 303);
  }

  let result: { ok: boolean; reason: string };
  try {
    result = await createWorkAlert({
      email: payload.email,
      artForm: payload.artForm,
      priceMax: payload.priceMax,
      locale: typeof payload.locale === "string" ? payload.locale : undefined,
      source: "art-form",
    });
  } catch (error) {
    console.error("work alert failed", error);
    if (wantsJson) {
      return NextResponse.json({ ok: false, reason: "error" }, { status: 500 });
    }
    return NextResponse.redirect(backTo(req), 303);
  }

  if (wantsJson) {
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  }
  return NextResponse.redirect(backTo(req), 303);
}
