/**
 * GET  /api/admin/password-resets — people waiting to be let back in.
 * POST /api/admin/password-resets — mark one as handled.
 *
 * The public endpoint records requests; only this one reads them, and it needs
 * an admin session. A reset request carries an email address, which is exactly
 * the sort of thing that must not be listable from outside.
 */

import { NextResponse } from "next/server";
import { getAdminIdentity, requireAdmin } from "@/app/admin/actions";
import { listResetRequests, markResetHandled } from "@/lib/password-reset";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const requests = await listResetRequests();
    return NextResponse.json({ requests });
  } catch (error) {
    console.error("[admin/password-resets] could not list", error);
    return NextResponse.json({ error: "Could not load requests" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { id?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body" }, { status: 400 });
  }

  const id = Number(body.id);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "A request id is required" }, { status: 400 });
  }

  try {
    const identity = await getAdminIdentity();
    const updated = await markResetHandled(id, identity?.email ?? null);
    if (!updated) {
      // Already handled, or never existed. Both are "nothing to do".
      return NextResponse.json({ error: "That request is not open" }, { status: 409 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[admin/password-resets] could not update", error);
    return NextResponse.json({ error: "Could not update the request" }, { status: 500 });
  }
}
