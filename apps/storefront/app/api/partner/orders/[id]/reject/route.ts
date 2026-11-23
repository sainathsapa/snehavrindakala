/** POST /api/partner/orders/[id]/reject — assigned -> rejected (with reason). */

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
    const reason =
      typeof body.reason === "string" && body.reason.trim()
        ? body.reason.trim()
        : "";
    if (!reason) {
      return NextResponse.json(
        { error: "A rejection reason is required" },
        { status: 400 }
      );
    }
    const group = await updateGroupStatus(ctx, id, "rejected", ctx.email, {
      rejection_reason: reason,
    });
    if (!group) return NextResponse.json({ error: "Not found" }, { status: 404 });
    // The free-text reason is deliberately NOT copied into the audit row: it is
    // caller-controlled prose that may contain customer PII. We record that a
    // reason was supplied plus the sanctioned status change.
    await recordMutationAudit({
      partnerId: ctx.partnerId,
      actorEmail: ctx.email,
      actorRole: ctx.role,
      action: AUDIT_ACTIONS.ORDER_REJECTED,
      entityType: "fulfilment_group",
      entityId: group.id,
      metadata: auditPayload(AUDIT_ACTIONS.ORDER_REJECTED, ctx, {
        customerOrderId: group.customer_order_id,
        reasonProvided: true,
        after: { status: group.status },
        requestId: correlationIdFrom(req),
        result: "success",
        at: new Date().toISOString(),
      }),
    });
    return NextResponse.json(group);
  } catch (err) {
    const code = err instanceof FulfilmentError ? err.code : "ERROR";
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not reject order", code },
      { status: code === "INVALID_TRANSITION" ? 409 : 400 }
    );
  }
}
