import { NextResponse } from "next/server";
import { query } from "@/lib/db";

/**
 * Liveness and readiness for the storefront.
 *
 * There was no health endpoint at all, which means nothing could answer the two
 * questions an operator actually asks at 3am: "is the site up?" and "is it able
 * to do its job?" Docker's healthcheck, an uptime monitor and nginx all want the
 * same answer, and a page that renders 200 while the database is unreachable is
 * not a healthy site — it is a site that will fail at checkout.
 *
 * Deliberately unauthenticated and deliberately vague: no versions, no hostnames,
 * no counts, nothing that helps someone map the inside. Status codes carry the
 * meaning — 200 ready, 503 not ready — so a monitor needs no parser.
 *
 * `?deep=1` checks the same things and also writes the report. Even then nothing
 * secret is included: only booleans.
 */

export const dynamic = "force-dynamic";

interface Check {
  ok: boolean;
  detail?: string;
}

async function checkDatabase(): Promise<Check> {
  try {
    await query("SELECT 1");
    return { ok: true };
  } catch (error) {
    return { ok: false, detail: (error as Error)?.message?.slice(0, 120) ?? "unreachable" };
  }
}

async function checkBackend(): Promise<Check> {
  const base =
    process.env.MEDUSA_BACKEND_URL ||
    process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ||
    "http://backend:9000";
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const response = await fetch(`${base.replace(/\/$/, "")}/health`, {
      signal: controller.signal,
      cache: "no-store",
    });
    clearTimeout(timer);
    return { ok: response.ok, detail: response.ok ? undefined : `status ${response.status}` };
  } catch (error) {
    return { ok: false, detail: (error as Error)?.name === "AbortError" ? "timeout" : "unreachable" };
  }
}

/**
 * Mail is optional for browsing but not for orders, so it is reported and it
 * counts toward readiness. Checked as a pair of environment values rather than
 * by sending anything: a health probe that sends mail is a health probe that
 * costs money and spams someone every thirty seconds.
 */
function checkMail(): Check {
  const from = String(process.env.FROM_EMAIL || "").trim();
  const key = String(process.env.RESEND_API_KEY || "").trim();
  return from && key
    ? { ok: true }
    : { ok: false, detail: !from ? "FROM_EMAIL missing" : "RESEND_API_KEY missing" };
}

export async function GET(request: Request) {
  const deep = new URL(request.url).searchParams.has("deep");

  const [database, backend] = await Promise.all([checkDatabase(), checkBackend()]);
  const mail = checkMail();

  // Ready means "can take an order". Browsing can survive without mail; paying
  // cannot, so mail is part of readiness. It is not part of liveness.
  const ready = database.ok && backend.ok && mail.ok;

  const body = {
    status: ready ? "ok" : "degraded",
    checks: {
      database: database.ok,
      backend: backend.ok,
      mail: mail.ok,
    },
    ...(deep
      ? {
          detail: {
            database: database.detail ?? null,
            backend: backend.detail ?? null,
            mail: mail.detail ?? null,
          },
        }
      : {}),
  };

  return NextResponse.json(body, {
    status: ready ? 200 : 503,
    headers: { "cache-control": "no-store, max-age=0" },
  });
}
