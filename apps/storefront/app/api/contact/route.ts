/**
 * POST /api/contact — the studio's contact form.
 *
 * The site had no contact page at all: every "get in touch" path was a mailto:
 * link or the chat widget. This route is what the form posts to.
 *
 * The shape of it follows the mistakes this kind of endpoint usually makes:
 *
 *  · Two emails go out — one to the studio with reply-to set to the visitor (so
 *    staff hit reply and reach a person), and a short confirmation to the
 *    visitor. If the confirmation fails, the submission still succeeded: the
 *    studio's copy is the one that matters.
 *  · A honeypot field, answered silently, so a bot sees success and goes away.
 *  · A per-address rate limit, because a public form with none is a mail relay.
 *  · Hard length caps before anything is templated, and the body is escaped by
 *    the notification templates, never interpolated raw.
 */

import { NextResponse } from "next/server";
import { sendAccountEmail } from "@/lib/email/send";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const MESSAGES: Record<string, string> = {
  sent: "Thank you — your message is with the studio. We reply by email, usually within two working days.",
  invalid: "Please add your name, a complete email address and a message.",
  too_long: "That message is longer than the form accepts. Please shorten it, or email us directly.",
  rate_limited: "Too many messages from this connection. Please try again later, or email us directly.",
  unavailable: "The studio could not send mail just now. Please email hello@snehavrinda.in directly.",
};

/** Trim, strip control characters, cap. */
function clean(value: unknown, max: number): string {
  return String(value ?? "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .trim()
    .slice(0, max);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Same-origin only: a redirect built from a header must never leave the site. */
function backTo(req: Request, query: string): string {
  const origin = new URL(req.url).origin;
  const referer = req.headers.get("referer");
  if (referer) {
    try {
      const url = new URL(referer);
      if (url.origin === origin) {
        url.search = query;
        return `${url.toString()}#form`;
      }
    } catch {
      // Malformed referer — fall through.
    }
  }
  return `${origin}/contact?${query}#form`;
}

export async function POST(req: Request) {
  const wantsJson =
    (req.headers.get("accept") || "").includes("application/json") ||
    req.headers.get("x-requested-with") === "fetch";

  const limit = await checkRateLimit({
    route: "contact",
    ip: clientIp(req.headers),
    // Three an hour: enough for a real enquiry plus a correction, far too few
    // for anyone using the form as a mail server.
    limit: 3,
    windowSeconds: 3600,
  });

  const respond = (code: keyof typeof MESSAGES, status: number) => {
    if (wantsJson) {
      return NextResponse.json({ ok: status < 400, code, message: MESSAGES[code] }, { status });
    }
    return NextResponse.redirect(backTo(req, `contact=${code}`), 303);
  };

  if (!limit.allowed) return respond("rate_limited", 429);

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    const form = await req.formData().catch(() => null);
    if (!form) return respond("invalid", 400);
    body = Object.fromEntries(form.entries());
  }

  // The honeypot is a field no person sees and no person fills. Answer as if it
  // worked: a bot that gets an error learns to try again.
  if (clean(body.website, 200)) {
    return respond("sent", 200);
  }

  const name = clean(body.name, 120);
  const email = clean(body.email, 320);
  const phone = clean(body.phone, 40);
  const subject = clean(body.subject, 160);
  const message = clean(body.message, 5000);
  const orderRef = clean(body.order, 40);

  if (!name || !EMAIL_RE.test(email) || message.length < 10) {
    return respond("invalid", 400);
  }
  if (message.length > 5000) return respond("too_long", 400);

  const studioInbox = process.env.CONTACT_EMAIL || process.env.FROM_EMAIL;

  const delivered = studioInbox
    ? await sendAccountEmail({
        to: studioInbox,
        template: "contact_enquiry",
        // One email per submission; the same person writing twice is two emails.
        eventKey: `contact:${Date.now()}:${email}`,
        data: {
          name,
          email,
          phone,
          subject,
          message,
          order_ref: orderRef,
          received_at: new Date().toISOString(),
        },
      })
    : false;

  if (!delivered) {
    console.error("[contact] studio copy not sent; check CONTACT_EMAIL and RESEND_API_KEY");
    return respond("unavailable", 503);
  }

  // Confirmation to the visitor. A failure here is logged and not surfaced: the
  // enquiry itself is already with the studio.
  await sendAccountEmail({
    to: email,
    template: "contact_received",
    eventKey: `contact-ack:${Date.now()}:${email}`,
    data: {
      name,
      subject,
      message,
      order_ref: orderRef,
      reply_to_email: studioInbox,
    },
  }).catch((err) => console.error("[contact] confirmation failed", err));

  return respond("sent", 200);
}
