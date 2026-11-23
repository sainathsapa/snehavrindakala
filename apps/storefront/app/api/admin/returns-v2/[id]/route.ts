/**
 * POST/PATCH /api/admin/returns-v2/[id] — decide a return request.
 *
 * Writes are gated by `orders:write`; the actor comes from the admin session,
 * never from the request body. The decision rule, the eligibility window and
 * the persistence (including audit metadata) all live in lib/returns/process,
 * so this route only wires them together.
 */

import { NextResponse } from "next/server";
import {
  getAdminIdentity,
  requirePermission,
} from "@/app/admin/actions";
import {
  configuredReturnWindowDays,
  decideReturn,
  getReturn,
  isReturnEligible,
  linkRefund,
  ReturnError,
  updateReturn,
} from "@/lib/returns/process";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

async function decide(req: Request, ctx: RouteContext) {
  if (!(await requirePermission("orders:write"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const identity = await getAdminIdentity();
  if (!identity) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await ctx.params;
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const decision = typeof body.decision === "string" ? body.decision : "";
    const reason = typeof body.reason === "string" ? body.reason : "";
    const refundRequestId =
      typeof body.refund_request_id === "string" && body.refund_request_id.trim()
        ? body.refund_request_id.trim()
        : null;

    const current = await getReturn(id);
    if (!current) {
      return NextResponse.json(
        { error: "Return request not found" },
        { status: 404 }
      );
    }

    // `reason` here is the admin's decision reason, not the customer's return
    // reason. We pass only status + decision reason into the pure rule.
    const outcome = decideReturn(
      { status: current.status, reason },
      decision,
      identity.email
    );
    if (!outcome.ok) {
      const status = /status/i.test(outcome.error ?? "") ? 409 : 400;
      return NextResponse.json(
        { error: outcome.error, code: outcome.error?.includes("reason") ? "REASON_REQUIRED" : "INVALID_DECISION" },
        { status }
      );
    }

    // Approval is the only decision that releases value, so it is the only one
    // that needs the configured window. No window value is fabricated here.
    if (outcome.decision === "approve") {
      const windowDays = configuredReturnWindowDays();
      if (windowDays === null) {
        return NextResponse.json(
          {
            error:
              "Return window is not configured. Owner decision required: set RETURN_WINDOW_DAYS.",
            code: "UNCONFIGURED_RETURN_WINDOW",
          },
          { status: 409 }
        );
      }
      const rawDays = body.days_since_delivery;
      if (rawDays !== undefined && rawDays !== null && rawDays !== "") {
        const days = Number(rawDays);
        // We do not have the order's delivery status in return_requests, so the
        // order argument is empty: the check is purely the configured window.
        if (!isReturnEligible({}, days, windowDays)) {
          return NextResponse.json(
            {
              error: "Return is outside the configured return window.",
              code: "INELIGIBLE",
              window_days: windowDays,
              days_since_delivery: days,
            },
            { status: 409 }
          );
        }
      }
    }

    // Validate/link the refund before changing status, so a bad refund id
    // cannot leave a decided return with a broken link.
    if (refundRequestId) {
      try {
        await linkRefund(id, refundRequestId);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to link refund";
        return NextResponse.json({ error: message }, { status: 400 });
      }
    }

    const updated = await updateReturn(
      id,
      {
        status: outcome.status,
        decision: outcome.decision,
        decision_reason: outcome.reason,
        actor_role: identity.role,
      },
      identity.email
    );
    if (!updated) {
      return NextResponse.json(
        { error: "Return request not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      return: updated,
      decision: outcome.decision,
      decision_reason: outcome.reason,
      linked_refund_id: refundRequestId,
    });
  } catch (error) {
    if (error instanceof ReturnError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: 400 }
      );
    }
    const message =
      error instanceof Error ? error.message : "Failed to decide return";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request, ctx: RouteContext) {
  return decide(req, ctx);
}

export async function PATCH(req: Request, ctx: RouteContext) {
  return decide(req, ctx);
}
