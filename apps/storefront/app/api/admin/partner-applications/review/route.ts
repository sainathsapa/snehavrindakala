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
import { recordAdminAction } from "@/lib/audit";
import {
  correlationIdFrom,
  redactAuditText,
} from "@/lib/partner-audit/audit";
import {
  AlreadyReviewedError,
  ApplicationNotFoundError,
  getApplication,
  isReviewDecision,
  reviewApplication,
  ReviewValidationError,
  type ReviewDecision,
} from "@/lib/partner-onboarding/review";

/** Stable admin audit action per review decision (incl. request-for-info). */
const DECISION_ACTIONS: Record<ReviewDecision, string> = {
  pending: "partner_application.reviewed",
  more_info: "partner_application.info_requested",
  approved: "partner_application.approved",
  rejected: "partner_application.rejected",
};

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
    const before = await getApplication(id);
    const result = await reviewApplication({
      id,
      decision,
      reviewerId: identity.email,
      notes: typeof notes === "string" ? notes : null,
    });
    // A108: every review decision is audited. The generated one-time password,
    // applicant contact details and business documents are NEVER copied here —
    // only ids, the decision, the new review status and a redacted note.
    await recordAdminAction({
      actorEmail: identity.email,
      actorRole: identity.role,
      action: DECISION_ACTIONS[decision],
      entityType: "partner_onboarding_application",
      entityId: result.application.id,
      oldValues: { reviewStatus: before?.review_status ?? null },
      newValues: {
        decision,
        reviewStatus: result.application.review_status,
        partnerId: result.partnerId,
        notes: redactAuditText(notes),
        requestId: correlationIdFrom(req),
        result: "success",
      },
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
