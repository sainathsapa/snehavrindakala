/** POST /api/partner/orders/[id]/reject — assigned -> rejected (with reason). */

import { NextResponse } from "next/server";
import { requirePartnerPermission } from "@/lib/partner/context";
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
    return NextResponse.json(group);
  } catch (err) {
    const code = err instanceof FulfilmentError ? err.code : "ERROR";
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not reject order", code },
      { status: code === "INVALID_TRANSITION" ? 409 : 400 }
    );
  }
}
