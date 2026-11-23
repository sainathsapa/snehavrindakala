/**
 * POST /api/admin/notifications/retry — re-send one undelivered notification.
 *
 * Deliberately narrow: an admin session AND settings:write permission, a single
 * row id, and no way to retry an already-delivered message. The whole outbox is
 * read-only in the UI; this is the one explicit write, with the outcome recorded
 * back on the row it acted on.
 */

import { NextResponse } from "next/server";
import { requireAdmin, requirePermission } from "@/app/admin/actions";
import { retryUndeliveredNotification } from "@/lib/outbox";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!(await requirePermission("settings:write"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let id = "";
  try {
    const body = await req.json();
    id = String(body?.id || "").trim();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!id) {
    return NextResponse.json({ error: "`id` is required" }, { status: 400 });
  }

  try {
    const result = await retryUndeliveredNotification(id);
    if (result.status === "failed" && !result.ok && /not found/i.test(result.detail)) {
      return NextResponse.json({ error: "Notification not found" }, { status: 404 });
    }
    return NextResponse.json(result, { status: result.ok ? 200 : 502 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const status = /not found/i.test(message) ? 404 : 500;
    console.error("[admin/notifications/retry] failed", err);
    return NextResponse.json({ error: message }, { status });
  }
}
