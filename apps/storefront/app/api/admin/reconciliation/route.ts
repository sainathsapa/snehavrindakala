/**
 * GET /api/admin/reconciliation — read the payment reconciliation queue.
 *
 * Read-only and gated on `refunds:read`. Issue state is written only by the
 * cron reconciler and the refund execution path, never by this endpoint.
 */

import { NextResponse } from "next/server";
import { requirePermission } from "@/app/admin/actions";
import { listReconciliationIssues } from "@/lib/payments/reconciliation";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!(await requirePermission("refunds:read"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const status = url.searchParams.get("status") || undefined;
  const rawLimit = Number(url.searchParams.get("limit") || 200);
  const limit = Number.isFinite(rawLimit)
    ? Math.max(1, Math.min(500, Math.floor(rawLimit)))
    : 200;

  try {
    const issues = await listReconciliationIssues({ status, limit });
    return NextResponse.json({ issues });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load reconciliation issues";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
