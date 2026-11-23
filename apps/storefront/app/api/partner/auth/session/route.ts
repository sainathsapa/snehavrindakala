/**
 * GET /api/partner/auth/session
 *
 * Returns the server-derived partner context for the current signed cookie, or
 * 401. The permission check re-reads membership + partner status from the DB,
 * so a suspended member or revoked session is rejected immediately.
 */

import { NextResponse } from "next/server";
import { requirePartnerPermission } from "@/lib/partner/context";

export const dynamic = "force-dynamic";

export async function GET() {
  const ctx = await requirePartnerPermission("dashboard:read");
  if (!ctx) {
    return NextResponse.json(
      { ok: false, error: "Not authenticated" },
      { status: 401 }
    );
  }
  return NextResponse.json({ ok: true, ...ctx });
}
