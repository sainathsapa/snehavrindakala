/**
 * PATCH/POST/DELETE /api/partner/team/[id]
 *
 *   PATCH  { role }        -> change a member's role
 *   POST   {}              -> revoke all sessions for that member
 *   DELETE                 -> suspend the member
 *
 * The id from the URL is always checked together with the context's partner_id
 * in the update statement, so a foreign id is a no-op.
 */

import { NextResponse } from "next/server";
import { requirePartnerPermission } from "@/lib/partner/context";
import {
  changeMemberRole,
  hasTenantIdField,
  revokeMemberSessions,
  suspendMember,
} from "@/lib/partner-portal/team";

export const dynamic = "force-dynamic";

const UNAUTH = { ok: false, error: "Not authenticated" };
type RouteContext = { params: Promise<{ id: string }> };

async function memberIdOf(context: RouteContext): Promise<string> {
  const { id } = await context.params;
  return typeof id === "string" ? id : "";
}

export async function PATCH(req: Request, context: RouteContext) {
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

  const memberId = await memberIdOf(context);
  try {
    const member = await changeMemberRole(ctx, memberId, body?.role);
    if (!member) {
      return NextResponse.json({ ok: false, error: "Member not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, member });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Update rejected" },
      { status: 400 }
    );
  }
}

/** Revoke every active session for a member (bump token_version). */
export async function POST(_req: Request, context: RouteContext) {
  const ctx = await requirePartnerPermission("team:write");
  if (!ctx) return NextResponse.json(UNAUTH, { status: 401 });

  const memberId = await memberIdOf(context);
  const member = await revokeMemberSessions(ctx, memberId);
  if (!member) {
    return NextResponse.json({ ok: false, error: "Member not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, member });
}

export async function DELETE(_req: Request, context: RouteContext) {
  const ctx = await requirePartnerPermission("team:write");
  if (!ctx) return NextResponse.json(UNAUTH, { status: 401 });

  const memberId = await memberIdOf(context);
  try {
    const member = await suspendMember(ctx, memberId);
    if (!member) {
      return NextResponse.json({ ok: false, error: "Member not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, member });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Suspend rejected" },
      { status: 400 }
    );
  }
}
