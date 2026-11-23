/**
 * GET /api/admin/owner-input-status — owner-input readiness report.
 *
 * Presence-only and read-only. It returns the validation result from
 * `lib/config/owner-inputs`, which names missing fields and environment
 * variables but NEVER their values, so it is safe to show on a settings page or
 * paste into a ticket. Requires the `settings:read` permission.
 */

import { NextResponse } from "next/server";
import { requirePermission } from "@/app/admin/actions";
import { validateOwnerInputs } from "@/lib/config/owner-inputs";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await requirePermission("settings:read"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = validateOwnerInputs();
  // `result` contains names only (missing/present/configuredGroups); no values.
  return NextResponse.json(result);
}
