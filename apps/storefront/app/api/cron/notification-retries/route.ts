/**
 * GET|POST /api/cron/notification-retries
 *
 * Works one bounded batch of due notification retries. Without a scheduled
 * caller, `app_notification` rows that failed transiently would sit in
 * `retrying` forever — the retry state machine existed but never advanced.
 * This is that caller: it invokes the same `processNotificationRetries()` the
 * notification module exposes, so backoff, leases, dead-lettering and
 * idempotency rules are identical wherever the work is triggered from.
 *
 * Guarded by CRON_SECRET. Unset => 503 (configuration problem), wrong => 401.
 * The batch cap keeps a provider outage from turning into a huge burst; the
 * next scheduled run picks up whatever remains.
 */

import { NextResponse } from "next/server";
import { authoriseCron } from "@/lib/cron-auth";
import { processNotificationRetries } from "@/lib/notifications";

export const dynamic = "force-dynamic";

/** A cap per run keeps one unlucky interval from resending a large backlog. */
const MAX_PER_RUN = 100;

async function handle(req: Request) {
  const url = new URL(req.url);
  const auth = authoriseCron({
    secret: process.env.CRON_SECRET,
    authorization: req.headers.get("authorization"),
    querySecret: url.searchParams.get("secret"),
  });
  if (!auth.ok) {
    const status = process.env.CRON_SECRET ? 401 : 503;
    return NextResponse.json({ error: auth.reason }, { status });
  }

  try {
    const result = await processNotificationRetries({ limit: MAX_PER_RUN });
    return NextResponse.json({ ...result, limit: MAX_PER_RUN });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Notification retry run failed";
    console.error("[cron] notification-retries failed", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
