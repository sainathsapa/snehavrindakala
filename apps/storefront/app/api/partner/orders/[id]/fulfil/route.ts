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
  AUDIT_ACTIONS,
  auditPayload,
  correlationIdFrom,
  recordMutationAudit,
} from "@/lib/partner-audit/audit";
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
    // All fulfilment steps append one row; the exact step lives in `after.step`
    // so an incident review can reconstruct the packing -> delivered sequence.
    await recordMutationAudit({
      partnerId: ctx.partnerId,
      actorEmail: ctx.email,
      actorRole: ctx.role,
      action: AUDIT_ACTIONS.ORDER_FULFILLED,
      entityType: "fulfilment_group",
      entityId: group.id,
      metadata: auditPayload(AUDIT_ACTIONS.ORDER_FULFILLED, ctx, {
        customerOrderId: group.customer_order_id,
        after: { status: group.status, step: to },
        requestId: correlationIdFrom(req),
        result: "success",
        at: new Date().toISOString(),
      }),
    });
    return NextResponse.json(group);
  } catch (err) {
    const code = err instanceof FulfilmentError ? err.code : "ERROR";
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not fulfil order", code },
      { status: code === "INVALID_TRANSITION" ? 409 : 400 }
    );
  }
}
