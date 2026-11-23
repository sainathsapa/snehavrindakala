/**
 * POST /api/admin/marketplace-partners/[id]/status — change a partner's account status.
 *
 * Requires `partners:write`. The only accepted status is a validated enum;
 * there is no generic profile-update path to `account_status`. The actor email
 * and role are taken from the signed admin session, never from the request
 * body. The partner id comes from the URL path only.
 */

import { NextResponse } from "next/server";
import { getAdminIdentity, requirePermission } from "@/app/admin/actions";
import {
  isAccountStatus,
  PartnerNotFoundError,
  PlatformValidationError,
  setAccountStatus,
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
  if (!isAccountStatus(status)) {
    return NextResponse.json(
      {
        error:
          "status must be one of: pending, active, suspended, rejected.",
      },
      { status: 400 }
    );
  }

  const identity = await getAdminIdentity();
  if (!identity) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const partner = await setAccountStatus(id, status, identity.email, {
      notes: typeof notes === "string" ? notes : null,
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
    console.error("Failed to set partner account status", err);
    return NextResponse.json(
      { error: err?.message || "Failed to update account status" },
      { status: 500 }
    );
  }
}
