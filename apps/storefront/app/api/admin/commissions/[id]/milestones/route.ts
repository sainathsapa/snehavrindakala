/**
 * POST   /api/admin/commissions/[id]/milestones — publish a studio update
 * DELETE /api/admin/commissions/[id]/milestones?id=<milestone> — withdraw one
 *
 * Only staff may write progress, and only a milestone they write appears on the
 * buyer's page. There is no generated copy: an update the studio did not write
 * would be a claim about someone else's work.
 */

import { NextResponse } from "next/server";
import { requireAdmin } from "@/app/admin/actions";
import { addMilestone, deleteMilestone, isUuid } from "@/lib/commission-progress";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!isUuid(id)) {
    return NextResponse.json({ error: "Unknown commission" }, { status: 404 });
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const milestone = await addMilestone({
    commissionRequestId: id,
    name: typeof body.name === "string" ? body.name : "",
    description: typeof body.description === "string" ? body.description : "",
    proofUrl: typeof body.proof_url === "string" ? body.proof_url : "",
  }).catch(() => null);

  if (!milestone) {
    return NextResponse.json(
      { error: "An update needs a short title." },
      { status: 400 }
    );
  }
  return NextResponse.json({ milestone }, { status: 201 });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await params;

  const milestoneId = new URL(req.url).searchParams.get("id") || "";
  const removed = await deleteMilestone(milestoneId).catch(() => false);
  return NextResponse.json({ ok: removed }, { status: removed ? 200 : 404 });
}
