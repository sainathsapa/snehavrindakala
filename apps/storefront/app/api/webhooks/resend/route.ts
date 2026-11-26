/**
 * POST /api/webhooks/resend — delivery events from Resend.
 *
 * Replaces the old SES→SNS route. `sent` only means the provider accepted the
 * message; `delivered` and `bounced` are the only statuses that prove what
 * happened at the other end, and they come from here.
 *
 * Resend signs with Svix. The signature is HMAC-SHA256 over
 * `${svix-id}.${svix-timestamp}.${rawBody}` using the base64-decoded
 * whsec_… secret, so no SDK is needed — node's crypto does it.
 *
 * Security notes:
 *  - The raw body is used for the signature check, never a re-serialised object
 *    (key order would change the bytes and the check would fail or, worse, pass
 *    for a body nobody signed).
 *  - The timestamp is bounded so a captured request cannot be replayed later.
 *  - No recipient address is logged. Only template, status and notification id.
 */

import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { verifySvixSignature } from "@/lib/webhooks/svix";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" } as const;

function noStore(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: NO_STORE });
}

/** Map Resend's event types onto the status column this app stores. */
function statusForEvent(eventType: string): string | null {
  switch (eventType) {
    case "email.delivered":
      return "delivered";
    case "email.bounced":
    case "email.complained":
      return "bounced";
    case "email.delivery_delayed":
      return "delivery_delayed";
    default:
      // email.sent / email.opened / email.clicked change nothing about whether
      // the message arrived.
      return null;
  }
}

export async function POST(req: Request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET || "";
  if (!secret) {
    // Unconfigured is a deployment state, not a caller error. Say so, and keep
    // it unauthenticated-free: without the secret nothing can be verified.
    console.warn("[resend-webhook] RESEND_WEBHOOK_SECRET unset; ignoring event");
    return noStore({ error: "Webhook not configured" }, 503);
  }

  const raw = await req.text().catch(() => "");
  if (!raw) return noStore({ error: "Empty body" }, 400);

  const ok = verifySvixSignature({
    secret,
    id: req.headers.get("svix-id") || "",
    timestamp: req.headers.get("svix-timestamp") || "",
    header: req.headers.get("svix-signature") || "",
    body: raw,
  });
  if (!ok) {
    console.warn("[resend-webhook] signature rejected");
    return noStore({ error: "Invalid signature" }, 401);
  }

  let event: {
    type?: string;
    data?: { email_id?: string; to?: unknown };
  };
  try {
    event = JSON.parse(raw);
  } catch {
    return noStore({ error: "Invalid JSON" }, 400);
  }

  const status = statusForEvent(String(event.type || ""));
  if (!status) return noStore({ received: true, applied: false });

  const providerId = String(event.data?.email_id || "");
  if (!providerId) return noStore({ received: true, applied: false });

  try {
    const result = await query(
      `UPDATE notifications
          SET status = CASE WHEN $2 = 'delivered' THEN 'delivered' ELSE status END,
              delivery_status = $2,
              updated_at = now()
        WHERE provider_message_id = $1
        RETURNING id`,
      [providerId, status]
    );
    return noStore({
      received: true,
      applied: result.length > 0,
    });
  } catch (error) {
    // Let Resend retry: a database blip should not swallow a bounce.
    console.error("[resend-webhook] could not record event", (error as Error)?.message);
    return noStore({ error: "Temporary failure" }, 500);
  }
}

export async function GET() {
  // Resend does not call GET; answering it stops a browser visit from looking
  // like a working endpoint.
  return noStore({ error: "Use POST" }, 405);
}
