/**
 * GET  /api/partner/notifications — list this partner's notifications
 * POST /api/partner/notifications — mark one of this partner's notifications read
 *
 * Tenant context comes ONLY from `requirePartnerPermission`, which re-resolves
 * the signed partner session against the database. No `partner_id` /
 * `partnerId` from a query string, body or header is ever read or forwarded —
 * the tenant scope is derived server-side and passed to `tenantQuery`.
 */

import { NextResponse } from "next/server";
import { requirePartnerPermission } from "@/lib/partner/context";
import {
  listPartnerNotifications,
  markRead,
} from "@/lib/partner-portal/notifications";

export const dynamic = "force-dynamic";

export async function GET() {
  const ctx = await requirePartnerPermission("dashboard:read");
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const notifications = await listPartnerNotifications(ctx);
    return NextResponse.json({ notifications });
  } catch (err) {
    console.error("[partner notifications] list failed", err);
    return NextResponse.json(
      { error: "Could not load notifications" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  const ctx = await requirePartnerPermission("dashboard:read");
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  // Only the audit-row id is accepted. Any tenant identifier in the body is
  // deliberately ignored.
  const id = typeof body?.id === "string" ? body.id.trim() : "";
  if (!id) {
    return NextResponse.json({ error: "Notification id is required" }, { status: 400 });
  }

  try {
    const notification = await markRead(ctx, id);
    if (!notification) {
      return NextResponse.json({ error: "Notification not found" }, { status: 404 });
    }
    return NextResponse.json({ notification });
  } catch (err) {
    console.error("[partner notifications] mark-read failed", err);
    return NextResponse.json(
      { error: "Could not update notification" },
      { status: 500 }
    );
  }
}
