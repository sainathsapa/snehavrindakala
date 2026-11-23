/**
 * GET  /api/admin/settlements — list batches + configured flag.
 * POST /api/admin/settlements — build a batch from payable, unassigned earnings.
 *
 * Refuses to create a settlement when no active configured policy exists.
 * Creating a batch never moves money and never marks it paid.
 */

import { NextResponse } from "next/server";
import { getAdminIdentity, requirePermission } from "@/app/admin/actions";
import {
  auditFinanceAction,
  policyConfigured,
} from "@/lib/finance/commission-policy";
import {
  createBatch,
  listActivePolicies,
  listBatches,
  listEligibleLedgerEntries,
  persistBatch,
} from "@/lib/finance/settlement";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await requirePermission("finance:read"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const [batches, policies] = await Promise.all([
      listBatches(),
      listActivePolicies(),
    ]);
    return NextResponse.json({
      batches,
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

  try {
    // The guard runs BEFORE anything is selected, persisted or paid.
    const policies = await listActivePolicies();
    if (!policyConfigured(policies)) {
      return NextResponse.json(
        {
          error:
            "UNCONFIGURED: no active approved commission policy — refusing to create a settlement",
          configured: false,
        },
        { status: 409 }
      );
    }

    const body: any = await req.json().catch(() => null);
    const period = {
      start: body?.period_start,
      end: body?.period_end,
    };
    const start = new Date(period.start);
    const end = new Date(period.end);
    if (
      Number.isNaN(start.getTime()) ||
      Number.isNaN(end.getTime()) ||
      start.getTime() >= end.getTime()
    ) {
      return NextResponse.json(
        { error: "period_start and period_end must be valid, ordered dates" },
        { status: 400 }
      );
    }

    const entries = await listEligibleLedgerEntries();
    let batch;
    try {
      batch = createBatch(entries, { start, end }, policies);
    } catch (error: any) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    await persistBatch(batch, entries);

    const identity = await getAdminIdentity();
    await auditFinanceAction({
      actorEmail: identity?.email ?? "unknown",
      actorRole: identity?.role ?? "unknown",
      action: "settlement.created",
      entityType: "settlement_batch",
      entityId: batch.id ?? null,
      metadata: {
        status: batch.status,
        lineCount: batch.line_count,
        totalAmount: batch.total_amount,
      },
    });
    return NextResponse.json({ batch, configured: true }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
