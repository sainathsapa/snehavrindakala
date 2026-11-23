/** POST /api/partner/orders/[id]/accept — assigned -> accepted. */

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
    const group = await updateGroupStatus(ctx, id, "accepted", ctx.email);
    if (!group) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(group);
  } catch (err) {
    const code = err instanceof FulfilmentError ? err.code : "ERROR";
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not accept order", code },
      { status: code === "INVALID_TRANSITION" ? 409 : 400 }
    );
  }
}
