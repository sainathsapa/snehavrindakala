/**
 * Server-only transactional mail helper.
 *
 * The storefront is where signup, sign-in and cancellation actually happen, so
 * it is where those emails are triggered. Rendering and transport stay in the
 * backend notification module — one set of templates, one provider — and this
 * file only asks it to send.
 *
 * Authenticated with INTERNAL_NOTIFY_SECRET (the same shared secret the backend
 * already uses in the other direction), never with the publishable key: that key
 * is public, and a public key must not be able to mail a customer a
 * password-reset-looking email.
 *
 * Never throws. A failed welcome email must not fail a signup.
 */

type Template =
  | "welcome"
  | "account_created"
  | "login_alert"
  | "password_changed"
  | "order_cancelled"
  | "order_confirmation"
  | "shipment_confirmed";

interface SendArgs {
  to: string | null | undefined;
  template: Template;
  data?: Record<string, unknown>;
  /** Makes a retried call idempotent on the backend. */
  eventKey?: string;
  /** Base64 file attachments, e.g. the invoice PDF. */
  attachments?: { filename: string; content: string; contentType?: string }[];
}

function backendUrl(): string {
  return (
    process.env.MEDUSA_BACKEND_URL ||
    process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ||
    "http://localhost:9000"
  ).replace(/\/+$/, "");
}

function internalSecret(): string | null {
  return process.env.INTERNAL_NOTIFY_SECRET || null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** True when a transport is configured, i.e. the mail will not be skipped. */
export function mailConfigured(): boolean {
  return Boolean(
    process.env.RESEND_API_KEY ||
      (process.env.FROM_EMAIL &&
        (process.env.AWS_SES_ACCESS_KEY_ID ||
          process.env.AWS_SES_ROLE_ARN ||
          process.env.AWS_CONTAINER_CREDENTIALS_RELATIVE_URI))
  );
}

export async function sendAccountEmail({
  to,
  template,
  data = {},
  eventKey,
  attachments,
}: SendArgs): Promise<boolean> {
  const recipient = String(to || "").trim();
  if (!recipient || !EMAIL_RE.test(recipient)) {
    console.warn(`[mail] ${template}: no usable recipient, skipping`);
    return false;
  }

  const secret = internalSecret();
  if (!secret) {
    // Expected in local development: say so plainly instead of pretending.
    console.log(`[mail] ${template}: INTERNAL_NOTIFY_SECRET unset, skipped`);
    return false;
  }

  try {
    const res = await fetch(`${backendUrl()}/internal/notifications/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-secret": secret,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
      body: JSON.stringify({
        to: recipient,
        template,
        data,
        ...(eventKey ? { eventKey } : {}),
        ...(attachments?.length ? { attachments } : {}),
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`[mail] ${template} failed: ${res.status} ${body.slice(0, 200)}`);
      return false;
    }

    const result = (await res.json().catch(() => ({}))) as { status?: string };
    return result.status === "sent";
  } catch (err) {
    console.error(`[mail] ${template} could not reach the notification service`, err);
    return false;
  }
}

/** A short, non-identifying description of the browser that signed in. */
export function describeClient(userAgent: string | null): string {
  const ua = String(userAgent || "");
  if (!ua) return "Unknown device";
  const os = /iPhone|iPad|iOS/.test(ua)
    ? "iOS"
    : /Android/.test(ua)
      ? "Android"
      : /Macintosh|Mac OS X/.test(ua)
        ? "macOS"
        : /Windows/.test(ua)
          ? "Windows"
          : /Linux/.test(ua)
            ? "Linux"
            : "Unknown device";
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /Chrome\//.test(ua)
      ? "Chrome"
      : /Safari\//.test(ua)
        ? "Safari"
        : /Firefox\//.test(ua)
          ? "Firefox"
          : "browser";
  return `${browser} on ${os}`;
}
