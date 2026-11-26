/**
 * The customer's own support tickets.
 *
 * Until now support existed only as an admin list and a "write to us" form on a
 * product page: a signed-in buyer could raise a ticket and then had no way to
 * see it, answer it or check whether anyone had replied. This is that missing
 * half.
 *
 * Access is by the signed-in customer's email, never by an id in the URL alone:
 * ticket ids are short and guessable, so a list scoped to "tickets for this
 * address" is the only version that cannot leak someone else's conversation.
 */

import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getCurrentCustomer } from "@/lib/auth";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" } as const;

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: NO_STORE });
}

function clean(value: unknown, max: number): string {
  return String(value ?? "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .trim()
    .slice(0, max);
}

/** GET — this customer's tickets, newest first, with reply counts. */
export async function GET() {
  const customer = await getCurrentCustomer();
  if (!customer?.email) return json({ error: "Unauthorized" }, 401);

  try {
    const tickets = await query(
      `SELECT t.id, t.subject, t.status, t.priority, t.created_at, t.updated_at,
              t.product_handle,
              (SELECT count(*) FROM ticket_replies r WHERE r.ticket_id = t.id) AS replies,
              (SELECT count(*) FROM ticket_replies r
                WHERE r.ticket_id = t.id AND r.author_type = 'admin') AS staff_replies
         FROM support_tickets t
        WHERE lower(t.email) = lower($1)
        ORDER BY t.created_at DESC
        LIMIT 50`,
      [customer.email]
    );

    return json({
      tickets: tickets.map((row: any) => ({
        ...row,
        replies: Number(row.replies || 0),
        staff_replies: Number(row.staff_replies || 0),
      })),
    });
  } catch (error) {
    console.error("[account/tickets] list failed", (error as Error)?.message);
    return json({ error: "Could not load your messages." }, 500);
  }
}

/** POST — raise a new ticket from the account area. */
export async function POST(req: Request) {
  const customer = await getCurrentCustomer();
  if (!customer?.email) return json({ error: "Unauthorized" }, 401);

  const limit = await checkRateLimit({
    route: "account-tickets",
    ip: clientIp(req.headers),
    limit: 5,
    windowSeconds: 3600,
  });
  if (!limit.allowed) {
    return json({ error: "Too many messages just now. Please try again later." }, 429);
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return json({ error: "Invalid request." }, 400);
  }

  const subject = clean(body.subject, 160);
  const message = clean(body.message, 5000);
  const orderRef = clean(body.order_ref, 40);

  if (subject.length < 3 || message.length < 10) {
    return json({ error: "A subject and a message of at least 10 characters are needed." }, 400);
  }

  const name = [customer.first_name, customer.last_name].filter(Boolean).join(" ");

  try {
    const rows = await query<{ id: string }>(
      `INSERT INTO support_tickets (id, subject, message, email, name, status, priority, product_handle)
       VALUES ($1, $2, $3, $4, $5, 'open', 'medium', $6)
       RETURNING id`,
      [
        `tkt_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
        subject,
        orderRef ? `${message}\n\nOrder reference: ${orderRef}` : message,
        customer.email,
        name || null,
        orderRef,
      ]
    );

    return json({ ok: true, id: rows[0]?.id ?? null }, 201);
  } catch (error) {
    console.error("[account/tickets] create failed", (error as Error)?.message);
    return json({ error: "The message could not be saved." }, 500);
  }
}
