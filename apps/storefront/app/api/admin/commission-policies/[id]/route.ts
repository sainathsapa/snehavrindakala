/**
 * GET   /api/admin/commission-policies/[id]
 * PATCH /api/admin/commission-policies/[id] — approve / activate / archive only.
 *
 * Rates can never be patched in place; changing a rate means creating a new
 * versioned policy. Activation requires a prior approval with an approver.
 */

import { NextResponse } from "next/server";
import { getAdminIdentity, requirePermission } from "@/app/admin/actions";
import { query } from "@/lib/db";
import {
  activatePolicy,
  auditFinanceAction,
  policyConfigured,
  validatePolicy,
} from "@/lib/finance/commission-policy";
import type { CommissionPolicy } from "@/lib/finance/types";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: RouteContext) {
  if (!(await requirePermission("finance:read"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  try {
    const rows = (await query(
      "SELECT * FROM commission_policy WHERE id = $1 LIMIT 1",
      [id]
    )) as CommissionPolicy[];
    const policy = rows[0];
    if (!policy) {
      return NextResponse.json({ error: "Policy not found" }, { status: 404 });
    }
    return NextResponse.json({
      policy,
      configured: policyConfigured([policy]),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: RouteContext) {
  if (!(await requirePermission("settlements:write"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const body: any = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "A JSON body is required" }, { status: 400 });
  }

  if (
    "rate_percent" in body ||
    "fixed_amount" in body ||
    "rate_basis" in body
  ) {
    return NextResponse.json(
      { error: "Rates cannot be patched in place; create a new versioned policy" },
      { status: 400 }
    );
  }

  try {
    const existing = (
      (await query("SELECT * FROM commission_policy WHERE id = $1 LIMIT 1", [
        id,
      ])) as CommissionPolicy[]
    )[0];
    if (!existing) {
      return NextResponse.json({ error: "Policy not found" }, { status: 404 });
    }

    const identity = await getAdminIdentity();
    const actorEmail = identity?.email ?? "unknown";
    const actorRole = identity?.role ?? "unknown";
    let updated: CommissionPolicy | undefined;
    let auditAction = "";

    if (body.action === "approve") {
      if (existing.status !== "draft") {
        return NextResponse.json(
          { error: "Only a draft policy can be approved" },
          { status: 409 }
        );
      }
      const validation = validatePolicy(existing);
      if (!validation.valid) {
        return NextResponse.json(
          { error: "Invalid policy", errors: validation.errors },
          { status: 400 }
        );
      }
      updated = (
        (await query(
          "UPDATE commission_policy SET status='approved', approved_by=$2, " +
            "approved_at=now(), updated_at=now() WHERE id=$1 RETURNING *",
          [id, actorEmail]
        )) as CommissionPolicy[]
      )[0];
      auditAction = "commission_policy.approved";
    } else if (body.action === "activate") {
      if (existing.status !== "approved") {
        return NextResponse.json(
          { error: "Only an approved policy can be activated" },
          { status: 409 }
        );
      }
      try {
        activatePolicy(existing);
      } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      updated = (
        (await query(
          "UPDATE commission_policy SET status='active', updated_at=now() " +
            "WHERE id=$1 RETURNING *",
          [id]
        )) as CommissionPolicy[]
      )[0];
      auditAction = "commission_policy.activated";
    } else if (body.action === "archive") {
      updated = (
        (await query(
          "UPDATE commission_policy SET status='archived', updated_at=now() " +
            "WHERE id=$1 RETURNING *",
          [id]
        )) as CommissionPolicy[]
      )[0];
      auditAction = "commission_policy.archived";
    } else {
      return NextResponse.json(
        { error: "Unsupported action — use approve, activate or archive" },
        { status: 400 }
      );
    }

    await auditFinanceAction({
      actorEmail,
      actorRole,
      action: auditAction,
      entityType: "commission_policy",
      entityId: id,
      metadata: { status: updated?.status ?? null },
    });
    return NextResponse.json({
      policy: updated,
      configured: policyConfigured(updated ? [updated] : []),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
