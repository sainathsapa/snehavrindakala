/**
 * GET  /api/admin/refunds — refunds waiting for a second signature.
 * POST /api/admin/refunds — approve or reject one.
 *
 * Both go through `lib/refund-approvals`, so the rule (the requester cannot be
 * the approver) holds even if a future client calls this directly.
 */

import { NextResponse } from "next/server";
import { getAdminIdentity, requireAdmin } from "@/app/admin/actions";
import {
  canDecide,
  decideRefund,
  getRefund,
  listPendingRefunds,
} from "@/lib/refund-approvals";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const identity = await getAdminIdentity();
    const refunds = await listPendingRefunds();
    return NextResponse.json({
      refunds,
      // The UI greys out its own requests using this, but the server enforces it.
      viewer: identity?.email ?? null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load refunds";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const identity = await getAdminIdentity();
  if (!identity) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const refundId = typeof body.refund_id === "string" ? body.refund_id : "";
  const decision = body.decision === "reject" ? "reject" : "approve";
  const note = typeof body.note === "string" ? body.note : "";

  if (!refundId) {
    return NextResponse.json({ error: "Missing refund_id" }, { status: 400 });
  }

  const refund = await getRefund(refundId);
  if (!refund) {
    return NextResponse.json({ error: "Refund not found" }, { status: 404 });
  }

  const allowed = canDecide({
    status: refund.status,
    requestedBy: refund.requested_by,
    actor: identity.email,
  });
  if (!allowed.ok) {
    return NextResponse.json({ error: allowed.error }, { status: 403 });
  }

  const result = await decideRefund({
    refundId,
    decision,
    actor: identity.email,
    note,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 409 });
  }

  return NextResponse.json({
    refund: result.refund,
    note:
      decision === "approve"
        ? "Approved. Release the money from the payments dashboard."
        : "Rejected. The requester keeps the record.",
  });
}
