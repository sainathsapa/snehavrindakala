/**
 * GET /api/admin/marketplace/finance — read-only operational view of payment
 * reconciliation and provider refund execution.
 *
 * Gated on `refunds:read` and on a platform admin identity. A partner-tenant
 * role is denied outright: these queries see every order on the platform.
 *
 * This endpoint is deliberately READ-ONLY. It takes no request body, reads no
 * query parameters and never reads an approver / approval decision from the
 * client. Approving a refund is a separate, server-gated action
 * (`/api/admin/refunds` and `/api/admin/refunds/execute`) where the requester
 * comes from the stored approval and the approver from the signed session —
 * never from a request. Showing that state here cannot authorise it.
 *
 * NOTE: pure label helpers and row shapes live in `lib/admin/finance-view.ts`.
 * Next.js validates Route module exports and rejects named helper exports.
 */

import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import {
  sandboxPaymentConfig,
  type ReconciliationIssueRow,
  type RefundExecutionRow,
  type AwaitingApprovalRefund,
} from "@/lib/admin/finance-view";

export const dynamic = "force-dynamic";

/* ── Gated, read-only handler ───────────────────────────────────────────── */

export async function GET() {
  // Imported inside the handler so this module (and its pure helpers) stay
  // importable in unit tests without pulling request-bound Next.js context.
  const { getAdminIdentity, requirePermission } = await import(
    "@/app/admin/actions"
  );

  const identity = await getAdminIdentity();
  if (!identity) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (identity.role === "partner") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!(await requirePermission("refunds:read"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const [issues, executions, awaitingApproval] = await Promise.all([
      query(
        `SELECT id, order_id, payment_id, issue_type, status, attempts,
                next_attempt_at, last_error
           FROM payment_reconciliation_issue
          ORDER BY next_attempt_at ASC, created_at ASC
          LIMIT 200`
      ) as Promise<ReconciliationIssueRow[]>,
      query(
        `SELECT id, refund_request_id, order_id, amount, currency, status,
                requested_by, approved_by, provider, provider_refund_id,
                failure_reason, created_at
           FROM refund_execution
          ORDER BY created_at DESC
          LIMIT 200`
      ) as Promise<RefundExecutionRow[]>,
      query(
        `SELECT id, order_id, amount, reason, requested_by, created_at
           FROM order_refunds
          WHERE status = 'pending'
            AND requested_by IS NOT NULL
            AND approved_by IS NULL
          ORDER BY created_at ASC
          LIMIT 200`
      ) as Promise<AwaitingApprovalRefund[]>,
    ]);

    return NextResponse.json({
      issues,
      executions,
      awaitingApproval,
      config: sandboxPaymentConfig(),
      note:
        "Read-only. Issues are worked by the scheduled reconciler; a refund is money moved only at provider_confirmed. Requester and approver are always derived server-side and must differ.",
    });
  } catch (error) {
    console.error("Could not load marketplace finance data", error);
    return NextResponse.json(
      { error: "Could not load marketplace finance data." },
      { status: 500 }
    );
  }
}
