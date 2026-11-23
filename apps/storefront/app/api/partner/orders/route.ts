/**
 * GET /api/partner/orders — list ONLY the authenticated partner's fulfilment
 * groups. Tenant scoping is enforced in the store via tenantQuery(ctx, ...).
 */

import { NextResponse } from "next/server";
import { requirePartnerPermission } from "@/lib/partner/context";
import { listPartnerGroups } from "@/lib/fulfilment/store";

export async function GET() {
  const ctx = await requirePartnerPermission("orders:read");
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const groups = await listPartnerGroups(ctx);
    return NextResponse.json({ groups, count: groups.length });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not list orders" },
      { status: 500 }
    );
  }
}
