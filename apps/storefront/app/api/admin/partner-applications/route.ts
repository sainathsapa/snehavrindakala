/**
 * GET /api/admin/partner-applications — admin queue of submitted partner
 * onboarding applications. Read access is gated by `partners:read`.
 */

import { NextResponse } from "next/server";
import { requirePermission } from "@/app/admin/actions";
import {
  isReviewDecision,
  listApplications,
  ReviewValidationError,
} from "@/lib/partner-onboarding/review";

export async function GET(req: Request) {
  if (!(await requirePermission("partners:read"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") || "all";
  if (status !== "all" && !isReviewDecision(status)) {
    return NextResponse.json(
      { error: "Invalid review status filter." },
      { status: 400 }
    );
  }

  try {
    const result = await listApplications({
      status,
      q: searchParams.get("q") || "",
      limit: Number(searchParams.get("limit") ?? 20),
      offset: Number(searchParams.get("offset") ?? 0),
    });
    return NextResponse.json(result);
  } catch (err: any) {
    if (err instanceof ReviewValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("Failed to list partner applications", err);
    return NextResponse.json(
      { error: err?.message || "Failed to list applications" },
      { status: 500 }
    );
  }
}
