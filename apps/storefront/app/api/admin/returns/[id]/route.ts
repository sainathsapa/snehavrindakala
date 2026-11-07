/**
 * PATCH /api/admin/returns/[id] - Update return request status
 * DELETE /api/admin/returns/[id] - Delete a return request
 */

import { NextResponse } from "next/server";
import { requireAdmin } from "@/app/admin/actions";

const DATABASE_URL =
  process.env.DATABASE_URL || "postgresql://medusa:medusa@localhost:5432/medusa";

async function query(sql: string, params: any[] = []) {
  const { Pool } = require("pg");
  const pool = new Pool({ connectionString: DATABASE_URL });
  const client = await pool.connect();
  try {
    const res = await client.query(sql, params);
    return res.rows;
  } finally {
    client.release();
    pool.end();
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const { id } = await params;
    const body = await req.json();
    const { status } = body;

    const allowed = ["pending", "approved", "rejected", "completed"];
    if (!status || !allowed.includes(status)) {
      return NextResponse.json(
        { error: `status must be one of: ${allowed.join(", ")}` },
        { status: 400 }
      );
    }

    const rows = await query(
      `UPDATE return_requests
       SET status = $1, updated_at = now()
       WHERE id = $2
       RETURNING *`,
      [status, id]
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: "Return request not found" }, { status: 404 });
    }

    return NextResponse.json({ return: rows[0] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const { id } = await params;

    const rows = await query(
      `DELETE FROM return_requests WHERE id = $1 RETURNING *`,
      [id]
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: "Return request not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
