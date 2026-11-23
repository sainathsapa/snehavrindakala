/**
 * POST /api/admin/partners-v2/[id]/link-artist — admin-assisted artist↔partner
 * mapping.
 *
 * Requires `partners:write`. Linking an artist does NOT activate or verify a
 * partner and does not create a new partner; it only records the mapping in
 * `approval_history` plus the audit log. The partner id comes from the URL
 * path; the artist id is validated from the body. Actor email from the session.
 */

import { NextResponse } from "next/server";
import { getAdminIdentity, requirePermission } from "@/app/admin/actions";
import {
  ArtistNotFoundError,
  linkArtist,
  PartnerNotFoundError,
  PlatformValidationError,
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
  const { artistId, notes } = body as Record<string, unknown>;
  if (typeof artistId !== "string" || !/^\d{1,20}$/.test(artistId.trim())) {
    return NextResponse.json(
      { error: "A valid numeric artistId is required." },
      { status: 400 }
    );
  }

  const identity = await getAdminIdentity();
  if (!identity) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const partner = await linkArtist(id, artistId.trim(), identity.email, {
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
    if (err instanceof ArtistNotFoundError) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    if (err instanceof PartnerNotFoundError) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    console.error("Failed to link artist to partner", err);
    return NextResponse.json(
      { error: err?.message || "Failed to link artist" },
      { status: 500 }
    );
  }
}
