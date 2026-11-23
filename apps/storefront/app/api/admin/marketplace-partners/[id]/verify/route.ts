/**
 * POST /api/admin/marketplace-partners/[id]/verify — set a partner's verification status.
 *
 * Requires `partners:write`. Verification is NEVER automatic: an explicit
 * admin decision with non-empty notes is required (enforced both here and in
 * the platform library). Status changes and account activation are not part of
 * this route. Actor identity comes from the signed admin session.
 */

import { NextResponse } from "next/server";
import { getAdminIdentity, requirePermission } from "@/app/admin/actions";
import {
  isVerificationStatus,
  PartnerNotFoundError,
  PlatformValidationError,
  setVerification,
} from "@/lib/admin-partners/platform";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await requirePermission("partners:write"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const { status, notes } = body as Record<string, unknown>;
  if (!isVerificationStatus(status)) {
    return NextResponse.json(
      {
        error:
          "status must be one of: unverified, pending, verified, rejected.",
      },
      { status: 400 }
    );
  }
  if (typeof notes !== "string" || !notes.trim()) {
    return NextResponse.json(
      { error: "Verification requires explicit admin notes." },
      { status: 400 }
    );
  }

  const identity = await getAdminIdentity();
  if (!identity) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const partner = await setVerification(id, status, identity.email, {
      notes,
      actorRole: identity.role,
    });
    return NextResponse.json(
      { partner },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err: any) {
    if (err instanceof PlatformValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    if (err instanceof PartnerNotFoundError) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    console.error("Failed to set partner verification status", err);
    return NextResponse.json(
      { error: err?.message || "Failed to update verification status" },
      { status: 500 }
    );
  }
}
