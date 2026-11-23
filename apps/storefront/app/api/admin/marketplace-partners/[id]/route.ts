/**
 * GET /api/admin/marketplace-partners/[id] — one platform partner.
 *
 * Read access is gated by `partners:read`. The partner id comes only from the
 * URL path; a partner id supplied in the body/query/header is never read.
 */

import { NextResponse } from "next/server";
import { requirePermission } from "@/app/admin/actions";
import {
  getPartner,
  PartnerNotFoundError,
  PlatformValidationError,
} from "@/lib/admin-partners/platform";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await requirePermission("partners:read"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  try {
    const partner = await getPartner(id);
    if (!partner) {
      return NextResponse.json(
        { error: "Partner not found" },
        { status: 404 }
      );
    }
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
    console.error("Failed to load platform partner", err);
    return NextResponse.json(
      { error: err?.message || "Failed to load partner" },
      { status: 500 }
    );
  }
}
