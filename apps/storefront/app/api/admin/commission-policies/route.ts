/**
 * GET  /api/admin/commission-policies — list policies + configured flag.
 * POST /api/admin/commission-policies — create a DRAFT policy (never active).
 *
 * No rate is ever defaulted: the body must supply exactly one explicit rate
 * and all business fields, validated before anything is written.
 */

import { NextResponse } from "next/server";
import { getAdminIdentity, requirePermission } from "@/app/admin/actions";
import { query } from "@/lib/db";
import {
  auditFinanceAction,
  policyConfigured,
  validatePolicy,
} from "@/lib/finance/commission-policy";
import type { CommissionPolicy } from "@/lib/finance/types";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await requirePermission("finance:read"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const policies = (await query(
      "SELECT * FROM commission_policy ORDER BY created_at DESC LIMIT 200"
    )) as CommissionPolicy[];
    return NextResponse.json({
      policies,
      configured: policyConfigured(policies),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  if (!(await requirePermission("settlements:write"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body: any = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "A JSON body is required" }, { status: 400 });
  }

  const identity = await getAdminIdentity();
  const actorEmail = identity?.email ?? "unknown";
  const actorRole = identity?.role ?? "unknown";

  // Business fields pass through untouched. Missing fields fail validation
  // rather than being silently invented. Creation can only produce a draft.
  const policy: CommissionPolicy = {
    name: body.name,
    scope: body.scope,
    scope_ref: body.scope_ref ?? null,
    rate_basis: body.rate_basis,
    tax_included: body.tax_included,
    shipping_included: body.shipping_included,
    rate_percent: body.rate_percent ?? null,
    fixed_amount: body.fixed_amount ?? null,
    currency: body.currency,
    refund_effect: body.refund_effect,
    payable_when: body.payable_when,
    status: "draft",
    version: 1,
    effective_from: body.effective_from ?? null,
    effective_to: body.effective_to ?? null,
    approved_by: null,
    approved_at: null,
    created_by: actorEmail,
  };

  const validation = validatePolicy(policy);
  if (!validation.valid) {
    return NextResponse.json(
      {
        error: "Invalid commission policy — no rate or business field is invented",
        errors: validation.errors,
        configured: false,
      },
      { status: 400 }
    );
  }

  try {
    const rows = (await query(
      "INSERT INTO commission_policy " +
        "(name, scope, scope_ref, rate_basis, tax_included, shipping_included, " +
        "rate_percent, fixed_amount, currency, refund_effect, payable_when, " +
        "status, version, effective_from, effective_to, approved_by, created_by) " +
        "VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) " +
        "RETURNING *",
      [
        policy.name,
        policy.scope,
        policy.scope_ref,
        policy.rate_basis,
        policy.tax_included,
        policy.shipping_included,
        policy.rate_percent,
        policy.fixed_amount,
        policy.currency,
        policy.refund_effect,
        policy.payable_when,
        policy.status,
        policy.version,
        policy.effective_from,
        policy.effective_to,
        policy.approved_by,
        policy.created_by,
      ]
    )) as CommissionPolicy[];
    const created = rows[0];
    await auditFinanceAction({
      actorEmail,
      actorRole,
      action: "commission_policy.created",
      entityType: "commission_policy",
      entityId: created?.id ?? null,
      metadata: { status: "draft" },
    });
    return NextResponse.json(
      { policy: created, configured: policyConfigured([created]) },
      { status: 201 }
    );
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
