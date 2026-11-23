/**
 * POST /api/partner/security/password
 *
 * Change the current member's password: verify the existing password, hash the
 * new one, and bump token_version so every existing session is revoked.
 * `security:write` is reserved for owners in the partner RBAC matrix.
 */

import { NextResponse } from "next/server";
import { requirePartnerPermission } from "@/lib/partner/context";
import { changeOwnPassword, hasTenantIdField } from "@/lib/partner-portal/team";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const ctx = await requirePartnerPermission("security:write");
  if (!ctx) {
    return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
  }

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

  const ok = await changeOwnPassword(
    ctx,
    body?.currentPassword,
    body?.newPassword
  );
  if (!ok) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Current password is incorrect, or the new password is missing or too short (12+ characters).",
      },
      { status: 400 }
    );
  }

  return NextResponse.json({
    ok: true,
    message: "Password changed. All existing sessions were revoked; please sign in again.",
  });
}
