/**
 * GET /api/admin/audit-log - List audit log entries
 */

import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireAdmin } from "@/app/admin/actions";



export async function GET(req: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const rows = await query(
      "SELECT * FROM audit_log ORDER BY created_at DESC LIMIT 200"
    );
    return NextResponse.json({ logs: rows });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
