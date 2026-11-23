/**
 * GET  /api/admin/settlements/[id] — batch + line items.
 * POST /api/admin/settlements/[id] — approve / initiate / confirm / fail.
 *
 * Every transition is finance-permission gated and audited. A batch can only
 * become payment_completed via `confirm` with real provider confirmation.
 */

import { NextResponse } from "next/server";
import { getAdminIdentity, requirePermission } from "@/app/admin/actions";
import { auditFinanceAction } from "@/lib/finance/commission-policy";
import {
  approveBatch,
  confirmPayment,
  failPayment,
  getBatch,
  getBatchItems,
  markPaymentInitiated,
} from "@/lib/finance/settlement";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: RouteContext) {
  if (!(await requirePermission("finance:read"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  try {
    const batch = await getBatch(id);
    if (!batch) {
      return NextResponse.json({ error: "Batch not found" }, { status: 404 });
    }
    const items = await getBatchItems(id);
    return NextResponse.json({ batch, items });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: RouteContext) {
  if (!(await requirePermission("settlements:write"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const body: any = await req.json().catch(() => null);
  const identity = await getAdminIdentity();
  const actor = identity?.email ?? "";

  try {
    let batch;
    let auditAction = "";

    if (body?.action === "approve") {
      batch = await approveBatch(id, actor);
      auditAction = "settlement.approved";
    } else if (body?.action === "initiate") {
      batch = await markPaymentInitiated(id, actor, String(body?.provider ?? ""));
      auditAction = "settlement.payment_initiated";
    } else if (body?.action === "confirm") {
      batch = await confirmPayment(
        id,
        String(body?.provider_ref ?? ""),
        body?.confirmation
      );
      auditAction = "settlement.payment_completed";
    } else if (body?.action === "fail") {
      batch = await failPayment(id, String(body?.reason ?? ""));
      auditAction = "settlement.payment_failed";
    } else {
      return NextResponse.json(
        { error: "Unsupported action — use approve, initiate, confirm or fail" },
        { status: 400 }
      );
    }

    await auditFinanceAction({
      actorEmail: identity?.email ?? "unknown",
      actorRole: identity?.role ?? "unknown",
      action: auditAction,
      entityType: "settlement_batch",
      entityId: id,
      metadata: { status: batch.status },
    });
    return NextResponse.json({ batch });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
