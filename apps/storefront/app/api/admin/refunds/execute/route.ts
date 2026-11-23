/**
 * POST /api/admin/refunds/execute — release an approved refund to the provider.
 *
 * Two independent controls are enforced here, server-side:
 *   1. `refunds:approve` permission and a signed-in identity.
 *   2. Dual control: the requester is read from the approval row and the
 *      approver from the session — neither is trusted from the request body.
 *      They must be different people.
 *
 * The provider adapter comes from configuration; with no credentials in
 * production it throws rather than moving money through a test/fake adapter.
 */

import { NextResponse } from "next/server";
import { getAdminIdentity, requirePermission } from "@/app/admin/actions";
import { getRefund } from "@/lib/refund-approvals";
import { recordAdminAction } from "@/lib/audit";
import { getRefundProvider } from "@/lib/payments/refund-provider";
import {
  DualControlError,
  executeRefund,
  RefundExecutionError,
} from "@/lib/payments/refund-execution";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!(await requirePermission("refunds:approve"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const identity = await getAdminIdentity();
  if (!identity) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const refundRequestId =
    typeof body.refund_request_id === "string" ? body.refund_request_id.trim() : "";
  if (!refundRequestId) {
    return NextResponse.json({ error: "Missing refund_request_id" }, { status: 400 });
  }

  const approval = await getRefund(refundRequestId);
  if (!approval) {
    return NextResponse.json({ error: "Refund approval not found" }, { status: 404 });
  }

  // Server-side truth: requester from the approval, approver from the session.
  const requester = (approval.requested_by ?? "").trim();
  const approver = identity.email.trim();
  if (
    !requester ||
    requester.toLowerCase() === approver.toLowerCase()
  ) {
    return NextResponse.json(
      {
        error:
          "You requested this refund, so someone else has to execute it. That is the point of the second signature.",
      },
      { status: 403 }
    );
  }

  // A stable default keeps retries idempotent even if a client omits the key.
  const idempotencyKey =
    typeof body.idempotency_key === "string" && body.idempotency_key.trim()
      ? body.idempotency_key.trim()
      : `refund-exec:${refundRequestId}`;

  try {
    const provider = getRefundProvider();
    const result = await executeRefund(
      {
        refundRequestId,
        orderId: approval.order_id,
        amount: approval.amount,
        requester,
        approver,
        idempotencyKey,
        paymentId:
          typeof body.payment_id === "string" && body.payment_id.trim()
            ? body.payment_id.trim()
            : undefined,
      },
      provider
    );

    await recordAdminAction({
      actorEmail: identity.email,
      actorRole: identity.role,
      action: "refund.execute",
      entityType: "refund_execution",
      entityId: result.execution.id,
      newValues: {
        refundRequestId,
        status: result.execution.status,
        reused: result.reused,
        providerRefundId: result.execution.provider_refund_id,
      },
    });

    return NextResponse.json({
      execution: result.execution,
      reused: result.reused,
      note:
        result.execution.status === "provider_confirmed"
          ? "The provider confirmed this refund; money has moved."
          : "The provider has not confirmed this refund yet; nothing is final.",
    });
  } catch (error) {
    if (error instanceof DualControlError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof RefundExecutionError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    const message =
      error instanceof Error ? error.message : "Refund execution failed";
    console.error("[admin] refund execution failed", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
