/**
 * GET /api/admin/marketplace/overview
 *
 * Platform-wide marketplace view. No tenant id is ever read from the request;
 * the caller's admin identity (and explicit permission) is the only gate.
 */

import { NextResponse } from "next/server";
import { getAdminIdentity, requirePermission } from "@/app/admin/actions";
import { getMarketplaceOverview } from "@/lib/admin-marketplace/overview";

export const dynamic = "force-dynamic";

export async function GET() {
  // getAdminIdentity distinguishes "not signed in" (401) from "signed in but
  // lacks the marketplace permission" (403). A partner-scoped admin role is
  // deliberately denied: this endpoint sees every tenant.
  const identity = await getAdminIdentity();
  if (!identity) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (identity.role === "partner") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!(await requirePermission("partners:read"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const overview = await getMarketplaceOverview();
    return NextResponse.json(overview);
  } catch (error) {
    console.error("Could not load the marketplace overview", error);
    return NextResponse.json(
      { error: "Could not load the marketplace overview." },
      { status: 500 }
    );
  }
}
