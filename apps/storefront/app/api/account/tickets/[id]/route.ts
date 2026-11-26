/**
 * One of the customer's own tickets, and replies on it.
 *
 * The id is never trusted on its own: every read and every write re-checks that
 * the ticket's email matches the signed-in customer. A short id is guessable, and
 * a support thread holds an address and an order reference.
 */

import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getCurrentCustomer } from "@/lib/auth";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" } as const;

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: NO_STORE });
}

async function ownedTicket(id: string, email: string) {
  const rows = await query<{ id: string; subject: string; status: string }>(
    `SELECT id, subject, status FROM support_tickets
      WHERE id = $1 AND lower(email) = lower($2)`,
    [id, email]
  );
  return rows[0] ?? null;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const customer = await getCurrentCustomer();
  if (!customer?.email) return json({ error: "Unauthorized" }, 401);

  const { id } = await params;
  const ticket = await ownedTicket(id, customer.email);
  if (!ticket) return json({ error: "Not found" }, 404);

  const rows = await query(
    `SELECT id, subject, message, status, created_at, updated_at
       FROM support_tickets WHERE id = $1`,
    [id]
  );
  const replies = await query(
    `SELECT id, message, author, author_type, created_at
       FROM ticket_replies WHERE ticket_id = $1 ORDER BY created_at ASC`,
    [id]
  );

  return json({ ticket: rows[0] ?? null, replies });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const customer = await getCurrentCustomer();
  if (!customer?.email) return json({ error: "Unauthorized" }, 401);

  const { id } = await params;
  const ticket = await ownedTicket(id, customer.email);
  if (!ticket) return json({ error: "Not found" }, 404);

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return json({ error: "Invalid request." }, 400);
  }

  const message = String(body.message ?? "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .trim()
    .slice(0, 5000);

  if (message.length < 2) return json({ error: "Write a reply first." }, 400);

  const name = [customer.first_name, customer.last_name].filter(Boolean).join(" ");

  try {
    await query(
      `INSERT INTO ticket_replies (ticket_id, message, author, author_type)
       VALUES ($1, $2, $3, 'customer')`,
      [id, message, name || customer.email]
    );
    // A reply reopens a resolved thread: the customer is asking again.
    await query(
      `UPDATE support_tickets SET status = 'open', updated_at = now() WHERE id = $1`,
      [id]
    );
    return json({ ok: true }, 201);
  } catch (error) {
    console.error("[account/tickets] reply failed", (error as Error)?.message);
    return json({ error: "The reply could not be saved." }, 500);
  }
}
