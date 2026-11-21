/**
 * GET /api/admin/config-status — what this deployment can and cannot do.
 *
 * Read-only and presence-only: it reports whether variables are set, never their
 * values, so it is safe to show on a settings page and safe to screenshot.
 */

import { NextResponse } from "next/server";
import { requireAdmin } from "@/app/admin/actions";
import { configurationChecklist } from "@/lib/config-status";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ items: configurationChecklist() });
}
