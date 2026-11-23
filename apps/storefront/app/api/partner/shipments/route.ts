/**
 * GET /api/partner/shipments
 *
 * Returns only the shipments joined to fulfilment groups owned by the
 * authenticated partner. The tenant id is taken exclusively from the verified
 * server-side context — no partner id is read from the request.
 */

import { NextResponse } from "next/server";
import { requirePartnerPermission } from "@/lib/partner/context";
import { listPartnerShipments } from "@/lib/partner-portal/shipments";

export const dynamic = "force-dynamic";

export async function GET() {
  const ctx = await requirePartnerPermission("shipments:read");
  if (!ctx) {
    return NextResponse.json(
      { ok: false, error: "Not authenticated" },
      { status: 401 }
    );
  }

  const shipments = await listPartnerShipments(ctx);
  return NextResponse.json({ ok: true, shipments });
}
