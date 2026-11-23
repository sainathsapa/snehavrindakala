/**
 * GET  /api/partner/data — a partner exports its own business data.
 * POST /api/partner/data — a partner records a request for erasure.
 *
 * Tenant context comes only from the signed partner session via
 * requirePartnerPermission; no partner_id is read from the request. GET is
 * gated on `profile:read`, POST on `profile:write`.
 *
 * POST deliberately does NOT erase anything: business, membership and financial
 * records must be retained, so the request is stored as an explicit, auditable
 * row for the studio owner to action. No deletion promise is invented here.
 */

import { NextResponse } from "next/server";
import { requirePartnerPermission } from "@/lib/partner/context";
import { buildErasureRequest, exportPartnerData } from "@/lib/partner-portal/data";
import { hasTenantIdField } from "@/lib/partner-portal/team";

export const dynamic = "force-dynamic";

const UNAUTH = { error: "Unauthorized" };

export async function GET() {
  const ctx = await requirePartnerPermission("profile:read");
  if (!ctx) return NextResponse.json(UNAUTH, { status: 401 });

  const data = await exportPartnerData(ctx);
  return NextResponse.json(data);
}

export async function POST(req: Request) {
  const ctx = await requirePartnerPermission("profile:write");
  if (!ctx) return NextResponse.json(UNAUTH, { status: 401 });

  const body = await req.json().catch(() => ({}));
  if (hasTenantIdField(body)) {
    return NextResponse.json(
      { error: "partner_id cannot be supplied by the client" },
      { status: 400 }
    );
  }

  const reason = typeof body?.reason === "string" ? body.reason : null;
  const result = await buildErasureRequest(ctx, reason);

  return NextResponse.json(
    {
      request: result,
      status: "pending",
      message: result.message,
    },
    { status: 202 }
  );
}
