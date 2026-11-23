/**
 * GET /api/admin/partner-applications/[id] — one submitted application for the
 * admin review screen. Read access is gated by `partners:read`.
 */

import { NextResponse } from "next/server";
import { requirePermission } from "@/app/admin/actions";
import {
  getApplication,
  ReviewValidationError,
} from "@/lib/partner-onboarding/review";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await requirePermission("partners:read"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  try {
    const application = await getApplication(id);
    if (!application) {
      return NextResponse.json(
        { error: "Application not found" },
        { status: 404 }
      );
    }
    return NextResponse.json({ application });
  } catch (err: any) {
    if (err instanceof ReviewValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("Failed to load partner application", err);
    return NextResponse.json(
      { error: err?.message || "Failed to load application" },
      { status: 500 }
    );
  }
}
