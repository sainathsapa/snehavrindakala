/**
 * GET/POST /api/admin/marketplace-partners/[id]/commercial
 *
 * GET  — current agreement, commercial configuration and the activation
 *        readiness verdict (what is still missing, in plain language).
 * POST — record an agreement revision and/or the commercial configuration.
 *
 * Requires `partners:write`. The actor is taken from the signed admin session,
 * never from the body, so an approval cannot be attributed to someone who did
 * not perform it. The partner id comes from the URL path only.
 *
 * This route does NOT activate the partner. Activation still goes through
 * /status, which independently re-runs the readiness gate — recording terms and
 * flipping the status are two separate, separately audited actions.
 */

import { NextResponse } from "next/server";
import { getAdminIdentity, requirePermission } from "@/app/admin/actions";
import { query as dbQuery } from "@/lib/db";
import {
  evaluateCommercialReadiness,
  getCommercialConfig,
  getLatestAgreement,
  isPayoutFrequency,
} from "@/lib/admin-partners/commercial";
import {
  CommercialStoreError,
  recordAgreement,
  saveCommercialConfig,
} from "@/lib/admin-partners/commercial-store";

const todayIso = () => new Date().toISOString().slice(0, 10);

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await requirePermission("partners:read"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  try {
    const [agreement, commercial] = await Promise.all([
      getLatestAgreement(id),
      getCommercialConfig(id),
    ]);
    const readiness = evaluateCommercialReadiness({ agreement, commercial }, todayIso());
    return NextResponse.json(
      { agreement, commercial, readiness },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err: any) {
    console.error("Failed to read partner commercial state", err);
    return NextResponse.json(
      { error: "Failed to read commercial state." },
      { status: 500 }
    );
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await requirePermission("partners:write"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const identity = await getAdminIdentity();
  if (!identity) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const payload = body as Record<string, any>;

  // Guard: the partner must exist before anything is written against it, so a
  // typo cannot create an orphan agreement row.
  const exists = await dbQuery<any>("SELECT id FROM partner WHERE id = $1 LIMIT 1", [id]);
  if (!exists.length) {
    return NextResponse.json({ error: "Partner not found." }, { status: 404 });
  }

  try {
    if (payload.agreement) {
      const a = payload.agreement;
      await recordAgreement({
        partnerId: id,
        agreementReference: a.agreementReference,
        status: a.status,
        signedOn: a.signedOn ?? null,
        effectiveFrom: a.effectiveFrom ?? null,
        effectiveTo: a.effectiveTo ?? null,
        documentRef: a.documentRef ?? null,
        actor: identity.email,
      });
    }

    if (payload.commercial) {
      const c = payload.commercial;
      if (!isPayoutFrequency(c.payoutFrequency)) {
        return NextResponse.json(
          {
            error:
              "payoutFrequency must be one of: weekly, fortnightly, monthly, on_demand.",
          },
          { status: 400 }
        );
      }
      await saveCommercialConfig({
        partnerId: id,
        commissionPolicyId: c.commissionPolicyId,
        payoutFrequency: c.payoutFrequency,
        payoutTerms: c.payoutTerms,
        effectiveFrom: c.effectiveFrom,
        approve: c.approve === true,
        actor: identity.email,
      });
    }

    if (!payload.agreement && !payload.commercial) {
      return NextResponse.json(
        { error: "Provide an `agreement` and/or `commercial` object." },
        { status: 400 }
      );
    }

    const [agreement, commercial] = await Promise.all([
      getLatestAgreement(id),
      getCommercialConfig(id),
    ]);
    const readiness = evaluateCommercialReadiness({ agreement, commercial }, todayIso());
    return NextResponse.json(
      { agreement, commercial, readiness },
      { status: 201, headers: { "Cache-Control": "no-store" } }
    );
  } catch (err: any) {
    if (err instanceof CommercialStoreError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("Failed to record partner commercial terms", err);
    return NextResponse.json(
      { error: "Failed to record commercial terms." },
      { status: 500 }
    );
  }
}
