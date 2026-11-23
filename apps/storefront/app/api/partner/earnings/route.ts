/**
 * GET /api/partner/earnings — the authenticated partner's ledger statement.
 *
 * Tenant context comes only from the signed partner session via
 * requirePartnerPermission; no partner_id is read from the request. The read
 * goes through statementForPartner -> tenantQuery, which binds ctx.partnerId
 * and refuses to execute without the {partner} predicate.
 */

import { NextResponse } from "next/server";
import { requirePartnerPermission } from "@/lib/partner/context";
import { statementForPartner } from "@/lib/finance/ledger";

export const dynamic = "force-dynamic";

export async function GET() {
  const ctx = await requirePartnerPermission("earnings:read");
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const entries = await statementForPartner(ctx);
    return NextResponse.json({ partnerId: ctx.partnerId, entries });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
