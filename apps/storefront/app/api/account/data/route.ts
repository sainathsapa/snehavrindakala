/**
 * GET  /api/account/data — a customer exports their own data.
 * POST /api/account/data — a customer records a request for deletion.
 *
 * Both use the same customer-token pattern as /api/account/orders; a missing
 * token is a 401. POST deliberately does NOT erase anything: customer data is
 * tied to orders, payments and statutory records, so a deletion request is
 * stored as an explicit row for the studio owner to action. Nothing here
 * invents a retention promise or a legal identity.
 */

import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getAuthToken } from "@/lib/auth";
import { query } from "@/lib/db";
import { medusa } from "@/lib/medusa";
import { listWishlistFor } from "@/lib/wishlist-server";
import { ensureNewsletterTable } from "@/lib/newsletter";

export const dynamic = "force-dynamic";

const BACKEND_URL =
  process.env.MEDUSA_BACKEND_URL ||
  process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ||
  "http://localhost:9000";

/** Keep one unavailable source from failing the whole export. */
async function bestEffort<T>(label: string, fn: () => Promise<T>, fallback: T) {
  try {
    return await fn();
  } catch (error) {
    console.error(`[account/data] ${label} unavailable`, error);
    return fallback;
  }
}

/** Reads the signed-in customer's own records. */
export async function GET() {
  const token = await getAuthToken();
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const customer = await bestEffort(
    "customer",
    () => medusa.getCurrentCustomer(token).then((r) => r.customer),
    null as any
  );
  if (!customer?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const email = String(customer.email || "").trim().toLowerCase();

  const [orders, wishlist, newsletter, commissions, tickets, returns] =
    await Promise.all([
      bestEffort(
        "orders",
        () => medusa.listCustomerOrders(token, { limit: 100, offset: 0 }).then((r) => r.orders || []),
        [] as any[]
      ),
      bestEffort("wishlist", () => listWishlistFor(customer.id), [] as any[]),
      bestEffort(
        "newsletter",
        async () => {
          if (!email) return [];
          await ensureNewsletterTable();
          return query(
            `SELECT email, locale, source, consent_at, unsubscribed_at, created_at
               FROM newsletter_subscribers WHERE email = $1 LIMIT 10`,
            [email]
          );
        },
        [] as any[]
      ),
      bestEffort(
        "commissions",
        async () => {
          const res = await fetch(
            `${BACKEND_URL}/store/commissions?customer_id=${encodeURIComponent(customer.id)}`,
            {
              headers: {
                "x-publishable-api-key": process.env.MEDUSA_PUBLISHABLE_KEY || "",
                Authorization: `Bearer ${token}`,
              },
              cache: "no-store",
            }
          );
          if (!res.ok) return [];
          const body = await res.json();
          return body.commission_requests ?? [];
        },
        [] as any[]
      ),
      bestEffort(
        "tickets",
        async () => {
          if (!email) return [];
          return query(
            `SELECT id, subject, message, email, name, status, priority,
                    created_at, updated_at
               FROM support_tickets WHERE email = $1
              ORDER BY created_at DESC LIMIT 100`,
            [email]
          );
        },
        [] as any[]
      ),
      bestEffort(
        "returns",
        async () => {
          if (!customer.id && !email) return [];
          return query(
            `SELECT * FROM return_requests
              WHERE customer_id = $1 OR customer_email = $2
              ORDER BY created_at DESC LIMIT 100`,
            [customer.id, email]
          );
        },
        [] as any[]
      ),
    ]);

  return NextResponse.json({
    exported_at: new Date().toISOString(),
    profile: {
      id: customer.id,
      email: customer.email,
      first_name: customer.first_name ?? null,
      last_name: customer.last_name ?? null,
      created_at: customer.created_at ?? null,
    },
    orders,
    wishlist,
    newsletter,
    commissions,
    tickets,
    returns,
    note: "Saved works kept only in this browser are not included. Wishes stored with your account are.",
  });
}

/** Records an explicit deletion request for the studio owner to action. */
export async function POST(req: Request) {
  const token = await getAuthToken();
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const customer = await bestEffort(
    "customer",
    () => medusa.getCurrentCustomer(token).then((r) => r.customer),
    null as any
  );
  if (!customer?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const note = typeof body?.note === "string" ? body.note.slice(0, 1000) : null;
  const email = String(customer.email || "").trim().toLowerCase();
  const id = `del_${randomUUID().slice(0, 8)}`;

  // The request is recorded in the existing audit_log table (created by
  // db/schema.sql, not lazily here). A deletion is an auditable, owner-actioned
  // request, not something this endpoint is allowed to carry out itself.
  const rows = await query(
    `INSERT INTO audit_log
       (entity_type, entity_id, action, new_values, user_email, user_role, created_at)
     VALUES ('data_deletion_request', $1, 'pending', $2::jsonb, $3, 'customer', now())
     RETURNING id, entity_type, entity_id, action, created_at`,
    [
      id,
      JSON.stringify({ customer_id: customer.id, customer_email: email, note }),
      email,
    ]
  );

  return NextResponse.json(
    {
      request: rows[0],
      status: "pending",
      message:
        "Your request has been recorded. No data has been deleted yet — the studio owner must review and action it, because orders and payment records must be retained.",
    },
    { status: 202 }
  );
}
