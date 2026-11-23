/**
 * GET /api/admin/notification-retries — notification retry queue observability.
 *
 * Read-only view over the retry/dead-letter lifecycle that A03 added to
 * `app_notification`. It never sends a message or mutates a row; the worker is
 * the CRON_SECRET-guarded `/api/cron/notification-retries` route. Counts make a
 * stuck retry queue, a growing dead-letter set and missing delivery events
 * visible without hand-written SQL.
 */

import { NextResponse } from "next/server";
import { requireAdmin } from "@/app/admin/actions";
import { notificationRetryStats } from "@/lib/notifications";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const stats = await notificationRetryStats();
    return NextResponse.json({ stats });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
