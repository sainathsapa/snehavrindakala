/**
 * GET /api/admin/session - Return the current admin identity, or 401.
 */

import { NextResponse } from "next/server";
import { getAdminIdentity } from "@/app/admin/actions";

export async function GET() {
  const identity = await getAdminIdentity();
  if (!identity) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(identity);
}
