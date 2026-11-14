/**
 * PATCH /api/admin/reviews/[id] — approve or reject a review.
 *
 * Only approved reviews appear publicly, so moderation is the gate that keeps
 * fabricated or abusive content off the store. A short staff note is stored for
 * the record.
 */

import { NextResponse } from "next/server";
import { requireAdmin } from "@/app/admin/actions";
import { query } from "@/lib/db";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const { status, admin_note } = body;

  if (!["approved", "rejected"].includes(status)) {
    return NextResponse.json(
      { error: "status must be 'approved' or 'rejected'" },
      { status: 400 }
    );
  }

  try {
    const rows = await query(
      `UPDATE product_review
       SET status = $1, admin_note = $2, updated_at = now()
       WHERE id = $3::uuid
       RETURNING id, status`,
      [status, typeof admin_note === "string" ? admin_note.slice(0, 500) : null, id]
    );
    if (rows.length === 0) {
      return NextResponse.json({ error: "Review not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, review: rows[0] });
  } catch (err: any) {
    console.error("Failed to moderate review", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}