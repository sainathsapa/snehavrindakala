/**
 * GET /api/tickets/[id] - Get ticket detail with replies.
 *
 * Admin-only. This route was public: a ticket id is enough to read the sender's
 * email address, their message and the whole reply thread. Ticket ids are short
 * (`ticket_` + 8 hex characters), so "unguessable" was not a defence — this is
 * someone else's correspondence.
 */

import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireAdmin } from "@/app/admin/actions";



export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;

    const ticketRows = await query(
      "SELECT * FROM support_tickets WHERE id = $1",
      [id]
    );

    if (ticketRows.length === 0) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    const replyRows = await query(
      "SELECT * FROM ticket_replies WHERE ticket_id = $1 ORDER BY created_at ASC",
      [id]
    );

    return NextResponse.json({
      ticket: ticketRows[0],
      replies: replyRows,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
