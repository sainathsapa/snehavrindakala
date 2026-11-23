/**
 * GET /api/admin/partners-v2 — platform-admin list of first-class partners.
 *
 * Distinct from the legacy `/api/admin/partners` artist screens. Read access is
 * gated by `partners:read`. This is a read-only endpoint: lifecycle changes go
 * through the dedicated status/verify/link-artist routes, never through a
 * generic profile payload.
 */

import { NextResponse } from "next/server";
import { requirePermission } from "@/app/admin/actions";
import {
  isAccountStatus,
  listPartners,
  PlatformValidationError,
} from "@/lib/admin-partners/platform";

export async function GET(req: Request) {
  if (!(await requirePermission("partners:read"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") || "all";
  if (status !== "all" && !isAccountStatus(status)) {
    return NextResponse.json(
      {
        error:
          "Invalid account status filter. Expected one of: pending, active, suspended, rejected.",
      },
      { status: 400 }
    );
  }

  try {
    // Filter values are read from the query string only for filtering, never
    // treated as a partner id. No partner id is accepted from the request.
    const result = await listPartners(undefined, {
      status,
      q: searchParams.get("q") || "",
      limit: Number(searchParams.get("limit") ?? 20),
      offset: Number(searchParams.get("offset") ?? 0),
    });
    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err: any) {
    if (err instanceof PlatformValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("Failed to list platform partners", err);
    return NextResponse.json(
      { error: err?.message || "Failed to list partners" },
      { status: 500 }
    );
  }
}
