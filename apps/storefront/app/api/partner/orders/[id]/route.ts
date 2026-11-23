/**
 * GET /api/partner/orders/[id] — a single group. A foreign id returns 404:
 * getPartnerGroup scopes by id AND ctx.partner_id, so no cross-tenant read and
 * no customer/payment data is exposed (items + status + customer order id only).
 */

import { NextResponse } from "next/server";
import { requirePartnerPermission } from "@/lib/partner/context";
import { getPartnerGroup } from "@/lib/fulfilment/store";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requirePartnerPermission("orders:read");
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const group = await getPartnerGroup(ctx, id);
  if (!group) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(group);
}
