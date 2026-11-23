/**
 * /api/admin/product-approvals/[id]
 *
 * GET  — one product submission for the admin review screen (`products:read`).
 * POST — record an approve/reject decision for that submission (`products:write`).
 *
 * The id is taken from the route params and the reviewer from the signed admin
 * session; neither is trusted from a request body.
 */

import { NextResponse } from "next/server";
import { getAdminIdentity, requirePermission } from "@/app/admin/actions";
import {
  getSubmission,
  isReviewDecision,
  NotReviewableError,
  ProductApprovalValidationError,
  reviewSubmission,
  SubmissionNotFoundError,
} from "@/lib/admin-marketplace/product-approvals";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_req: Request, { params }: RouteContext) {
  if (!(await requirePermission("products:read"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  try {
    const submission = await getSubmission(id);
    if (!submission) {
      return NextResponse.json(
        { error: "Product submission not found" },
        { status: 404 }
      );
    }
    return NextResponse.json({ submission });
  } catch (err: any) {
    if (err instanceof ProductApprovalValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("Failed to load product submission", err);
    return NextResponse.json(
      { error: err?.message || "Failed to load submission" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request, { params }: RouteContext) {
  if (!(await requirePermission("products:write"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const { decision, reason } = body as Record<string, unknown>;
  if (!isReviewDecision(decision)) {
    return NextResponse.json(
      { error: "decision must be one of: approved, rejected." },
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
