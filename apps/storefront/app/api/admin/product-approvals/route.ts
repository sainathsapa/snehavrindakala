/**
 * /api/admin/product-approvals
 *
 * GET  — admin queue of partner product submissions (`products:read`).
 * POST — record an approve/reject decision (`products:write`).
 *
 * The reviewer is taken from the signed admin session, never from the body.
 */

import { NextResponse } from "next/server";
import { getAdminIdentity, requirePermission } from "@/app/admin/actions";
import {
  isReviewDecision,
  isSubmissionStatus,
  listSubmissions,
  NotReviewableError,
  ProductApprovalValidationError,
  reviewSubmission,
  SubmissionNotFoundError,
} from "@/lib/admin-marketplace/product-approvals";

export async function GET(req: Request) {
  if (!(await requirePermission("products:read"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") || "all";
  if (status !== "all" && !isSubmissionStatus(status)) {
    return NextResponse.json(
      { error: "Invalid submission status filter." },
      { status: 400 }
    );
  }

  try {
    const submissions = await listSubmissions(undefined, status);
    return NextResponse.json(
      { submissions, count: submissions.length },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err: any) {
    if (err instanceof ProductApprovalValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("Failed to list product submissions", err);
    return NextResponse.json(
      { error: err?.message || "Failed to list submissions" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  if (!(await requirePermission("products:write"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const { id, decision, reason } = body as Record<string, unknown>;
  if (!isReviewDecision(decision)) {
    return NextResponse.json(
      { error: "decision must be one of: approved, rejected." },
      { status: 400 }
    );
  }
  if (typeof id !== "string" || !id.trim()) {
    return NextResponse.json(
      { error: "A valid submission id is required." },
      { status: 400 }
    );
  }

  const identity = await getAdminIdentity();
  if (!identity) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await reviewSubmission(id, {
      decision,
      reason: typeof reason === "string" ? reason : undefined,
      reviewer: identity.email,
    });
    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err: any) {
    if (err instanceof SubmissionNotFoundError) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    if (err instanceof NotReviewableError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    if (err instanceof ProductApprovalValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("Failed to review product submission", err);
    return NextResponse.json(
      { error: err?.message || "Failed to review submission" },
      { status: 500 }
    );
  }
}
