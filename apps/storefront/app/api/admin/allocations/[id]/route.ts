/**
 * GET   /api/admin/allocations/[id] — one fulfilment group (platform view).
 * PATCH /api/admin/allocations/[id] — reassign to another partner or cancel.
 * Admin-only; partner routes must never call these platform helpers.
 */

import { NextResponse } from "next/server";
import { requirePermission, getAdminIdentity } from "@/app/admin/actions";
import {
  getGroupById,
  reassignGroup,
  cancelGroupAsAdmin,
  FulfilmentError,
} from "@/lib/fulfilment/store";

function errorResponse(err: unknown) {
  const code = err instanceof FulfilmentError ? err.code : "ERROR";
  const status = code === "INVALID_TRANSITION" ? 409 : 400;
  return NextResponse.json(
    { error: err instanceof Error ? err.message : "Invalid request", code },
    { status }
  );
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await requirePermission("orders:read"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const group = await getGroupById(id);
  if (!group) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(group);
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await requirePermission("orders:write"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
  const { id } = await params;
  try {
    const body = await req.json().catch(() => ({}));
    const identity = await getAdminIdentity();
    const actor = identity?.email ?? "platform-admin";
    const action = body?.action;

    if (action === "reassign") {
      const newPartnerId =
        typeof body.partnerId === "string" ? body.partnerId.trim() : "";
      if (!newPartnerId) {
        return NextResponse.json(
          { error: "partnerId is required to reassign" },
          { status: 400 }
        );
      }
      const updated = await reassignGroup(id, newPartnerId, actor);
      if (!updated) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      return NextResponse.json(updated);
    }

    if (action === "cancel") {
      const reason =
        typeof body.reason === "string" && body.reason.trim()
          ? body.reason.trim()
          : null;
      const updated = await cancelGroupAsAdmin(id, actor, reason);
      if (!updated) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      return NextResponse.json(updated);
    }

    return NextResponse.json(
      { error: "action must be 'reassign' or 'cancel'" },
      { status: 400 }
    );
  } catch (err) {
    return errorResponse(err);
  }
}
