/**
 * GET/PATCH /api/partner/profile
 *
 * Tenant context is derived from the signed cookie only. A partner_id supplied
 * in a request body is rejected, and the update service writes only allow-listed
 * business columns guarded by `WHERE id = ctx.partnerId`.
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
  readProfile,
  updateProfile,
  type ProfilePatch,
} from "@/lib/partner-portal/team";

export const dynamic = "force-dynamic";

const UNAUTH = { ok: false, error: "Not authenticated" };

export async function GET() {
  const ctx = await requirePartnerPermission("profile:read");
  if (!ctx) return NextResponse.json(UNAUTH, { status: 401 });

  const rows = await readProfile(ctx);
  const profile = rows[0];
  if (!profile) {
    return NextResponse.json({ ok: false, error: "Profile not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, profile });
}

export async function PATCH(req: Request) {
  const ctx = await requirePartnerPermission("profile:write");
  if (!ctx) return NextResponse.json(UNAUTH, { status: 401 });

  let body: unknown;
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
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ ok: false, error: "Invalid request body" }, { status: 400 });
  }

  try {
    const profile = await updateProfile(ctx, body as ProfilePatch);
    if (!profile) {
      return NextResponse.json({ ok: false, error: "Profile not found" }, { status: 404 });
    }
    // Record which fields changed, never their values: contact_email is PII and
    // business_profile is free-form caller data. Identity stays server-derived.
    await recordMutationAudit({
      partnerId: ctx.partnerId,
      actorEmail: ctx.email,
      actorRole: ctx.role,
      action: AUDIT_ACTIONS.PROFILE_UPDATED,
      entityType: "partner",
      entityId: ctx.partnerId,
      metadata: auditPayload(AUDIT_ACTIONS.PROFILE_UPDATED, ctx, {
        changedFields: Object.keys(body as Record<string, unknown>),
        requestId: correlationIdFrom(req),
        result: "success",
        at: new Date().toISOString(),
      }),
    });
    return NextResponse.json({ ok: true, profile });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Update rejected" },
      { status: 400 }
    );
  }
}
