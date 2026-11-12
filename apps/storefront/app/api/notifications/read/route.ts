/**
 * POST /api/notifications/read — mark notifications read.
 * Body: { id } for one, or { all: true } for every visible notification.
 */

import { NextResponse } from "next/server";
import { getAdminIdentity } from "@/app/admin/actions";
import { markAllRead, markRead } from "@/lib/notifications";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const identity = await getAdminIdentity();
  if (!identity) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const audience = body.audience || "admin";

    if (body.all) {
      const updated = await markAllRead(audience);
      return NextResponse.json({ ok: true, updated });
    }

    const id = String(body.id || "").trim();
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const notification = await markRead(id, body.read !== false);
    if (!notification) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, notification });
  } catch (err) {
    console.error("[notifications] mark read failed", err);
    return NextResponse.json({ error: "Could not update" }, { status: 500 });
  }
}
