/**
 * GET/POST /api/partner/team
 *
 * All membership data is read through the tenant-scoped repository, and new
 * memberships are created with partner_id taken exclusively from the context.
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
  hasTenantIdField,
  inviteMember,
  listMembers,
} from "@/lib/partner-portal/team";

export const dynamic = "force-dynamic";

const UNAUTH = { ok: false, error: "Not authenticated" };

export async function GET() {
  const ctx = await requirePartnerPermission("team:read");
  if (!ctx) return NextResponse.json(UNAUTH, { status: 401 });

  const members = await listMembers(ctx);
  return NextResponse.json({ ok: true, members });
}

export async function POST(req: Request) {
  const ctx = await requirePartnerPermission("team:write");
  if (!ctx) return NextResponse.json(UNAUTH, { status: 401 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body" }, { status: 400 });
  }

  if (hasTenantIdField(body)) {
    return NextResponse.json(
      { ok: false, error: "partner_id cannot be supplied by the client" },
      { status: 400 }
    );
  }

  try {
    const result = await inviteMember(ctx, {
      email: body?.email,
      fullName: body?.fullName,
      role: body?.role,
    });
    // A108: the invitee's email / one-time password never enter the audit row —
    // auditPayload redacts email-like keys and all secrets. Identity (partnerId,
    // actor email/role) comes from the verified session context, never the body.
    await recordMutationAudit({
      partnerId: ctx.partnerId,
      actorEmail: ctx.email,
      actorRole: ctx.role,
      action: AUDIT_ACTIONS.MEMBER_INVITED,
      entityType: "partner_membership",
      entityId: result.member?.id ?? null,
      metadata: auditPayload(AUDIT_ACTIONS.MEMBER_INVITED, ctx, {
        membershipId: result.member?.id ?? null,
        after: { role: result.member?.role ?? null, status: result.member?.status ?? null },
        requestId: correlationIdFrom(req),
        result: "success",
        at: new Date().toISOString(),
      }),
    });
    return NextResponse.json({ ok: true, ...result }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invite failed";
    const status = /duplicate|unique/i.test(message) ? 409 : 400;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
