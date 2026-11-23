/**
 * GET /api/admin/tickets - List support tickets for the admin panel.
 */

import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireAdmin } from "@/app/admin/actions";



export async function GET(req: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = parseInt(searchParams.get("offset") || "0");

    let sql = `
      SELECT id, subject, message, email, name, status, priority, assigned_to, created_at, updated_at
      FROM support_tickets
    `;
    const params: any[] = [];
    if (status) {
      sql += ` WHERE status = $${params.length + 1}`;
      params.push(status);
    }
    sql += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const rows = await query(sql, params);
    return NextResponse.json({ tickets: rows, count: rows.length });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
