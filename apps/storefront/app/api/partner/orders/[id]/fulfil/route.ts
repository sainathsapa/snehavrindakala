/**
 * POST /api/partner/orders/[id]/fulfil — advance an accepted group through
 * packing -> ready_for_dispatch -> dispatched -> delivered.
 *
 * ONLY operational fields (`to`, `shipment_id`) are accepted. Any payment,
 * refund, price, commission, payout or status-spoofing field is rejected by
 * `assertNoForbiddenFulfilmentFields` before any database call.
 */

import { NextResponse } from "next/server";
import { requirePartnerPermission } from "@/lib/partner/context";
import {
  updateGroupStatus,
  assertNoForbiddenFulfilmentFields,
  FulfilmentError,
} from "@/lib/fulfilment/store";
import type { FulfilmentStatus } from "@/lib/fulfilment/types";

const FULFIL_TARGETS = new Set<FulfilmentStatus>([
  "packing",
  "ready_for_dispatch",
  "dispatched",
  "delivered",
]);

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requirePartnerPermission("orders:write");
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  try {
    const body = await req.json().catch(() => ({}));
    assertNoForbiddenFulfilmentFields(body);
    const to = body?.to as FulfilmentStatus;
    if (!to || !FULFIL_TARGETS.has(to)) {
      return NextResponse.json(
        { error: "to must be a fulfilment step (packing|ready_for_dispatch|dispatched|delivered)" },
        { status: 400 }
      );
    }
    const extra =
      typeof body.shipment_id === "string" && body.shipment_id.trim()
        ? { shipment_id: body.shipment_id.trim() }
        : {};
    const group = await updateGroupStatus(ctx, id, to, ctx.email, extra);
    if (!group) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(group);
  } catch (err) {
    const code = err instanceof FulfilmentError ? err.code : "ERROR";
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not fulfil order", code },
      { status: code === "INVALID_TRANSITION" ? 409 : 400 }
    );
  }
}
