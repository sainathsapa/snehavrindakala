/**
 * POST /api/admin/partner-applications/review — record an admin decision.
 *
 * Requires `partners:write`. The reviewer identity is taken from the signed
 * admin session, never from the request body. On approval the response carries
 * the generated temporary owner password exactly once; it is never persisted
 * in plaintext and is not echoed on later reads.
 */

import { NextResponse } from "next/server";
import { getAdminIdentity, requirePermission } from "@/app/admin/actions";
import {
  AlreadyReviewedError,
  ApplicationNotFoundError,
  isReviewDecision,
  reviewApplication,
  ReviewValidationError,
} from "@/lib/partner-onboarding/review";

export async function POST(req: Request) {
  if (!(await requirePermission("partners:write"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const { id, decision, notes } = body as Record<string, unknown>;
  if (!isReviewDecision(decision)) {
    return NextResponse.json(
      {
        error:
          "decision must be one of: pending, more_info, approved, rejected.",
      },
      { status: 400 }
    );
  }
  if (typeof id !== "string" || !id.trim()) {
    return NextResponse.json(
      { error: "A valid application id is required." },
      { status: 400 }
    );
  }

  const identity = await getAdminIdentity();
  if (!identity) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await reviewApplication({
      id,
      decision,
      reviewerId: identity.email,
      notes: typeof notes === "string" ? notes : null,
    });
    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err: any) {
    if (err instanceof ApplicationNotFoundError) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    if (err instanceof AlreadyReviewedError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    if (err instanceof ReviewValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("Failed to review partner application", err);
    return NextResponse.json(
      { error: err?.message || "Failed to review application" },
      { status: 500 }
    );
  }
}
