/**
 * GET /api/admin/return-decisions — return queue for the admin decision workflow.
 *
 * Read-only. The response also reports whether the return window has been
 * configured by the owner: we never substitute a default window, so an
 * unconfigured value is reported rather than silently assumed.
 */

import { NextResponse } from "next/server";
import { requirePermission } from "@/app/admin/actions";
import {
  configuredReturnWindowDays,
  listReturns,
} from "@/lib/returns/process";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await requirePermission("orders:read"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const returns = await listReturns();
    const windowDays = configuredReturnWindowDays();
    return NextResponse.json({
      returns,
      count: returns.length,
      return_window_days: windowDays,
      return_window_configured: windowDays !== null,
      config_note:
        windowDays === null
          ? "RETURN_WINDOW_DAYS is not configured. Owner decision required."
          : null,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load return requests";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
