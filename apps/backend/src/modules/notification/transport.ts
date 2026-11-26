/**
 * Email transport.
 *
 * Two providers, chosen by which credentials exist:
 *
 *   1. Resend (`RESEND_API_KEY`) — preferred. One HTTPS call, no SDK, and the
 *      provider hands back a message id we can store. Requires a verified
 *      sending domain, otherwise the API answers 403 with the reason.
 *   2. AWS SES v2 (`FROM_EMAIL` + SES credentials) — the original path, kept
 *      for deployments that already have it.
 *
 * Two cases are deliberately distinguished:
 *
 *  - Not configured (local dev, CI): log the email and report `skipped` so the
 *    notification row is not marked failed and does not look like an incident.
 *  - Configured but the send fails: throw, so the row is recorded as failed
 *    and the admin can see it. Silence here is worse than an error.
 */

import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";

/** Last line of defence for the dev/CI preview: never print raw PII. */
function scrubPii(value: string): string {
  return value
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[REDACTED]")
    .replace(/\b\d{13,19}\b/g, "[REDACTED]");
}

export type SendOutcome = "sent" | "skipped";

/**
 * Delivery states the SES transport can report.
 *
 * `delivered` and `bounced` are written only by the verified SES→SNS event
 * route (`apps/storefront/app/api/webhooks/ses/route.ts`), never by this send
 * path. Do not read a `sent` row as proof of delivery: `sent` means the provider
 * accepted/queued the message, and the owner must still provision the SES
 * configuration-set → SNS destination for delivery events to arrive.
 */
export const NOTIFICATION_STATUS = {
  PENDING: "pending",
  SENT: "sent",
  DELIVERED: "delivered",
  FAILED: "failed",
  BOUNCED: "bounced",
  SKIPPED: "skipped",
} as const;

export const DELIVERY_CONFIRMATION_STATUSES = ["delivered", "bounced"] as const;

/**
 * GAP-05/07 additive vocabulary for the `delivery_status` column added by
 * migration 005. `sent` means only "the provider accepted/queued the message";
 * it is NEVER delivery proof. The real lifecycle (delivered / bounced /
 * complained / rejected / delivery_delayed) is written only from a verified SES
 * event. The six-value `status` CHECK is deliberately left untouched.
 *
 * A verified SNS webhook is implemented at
 * apps/storefront/app/api/webhooks/ses/route.ts; until the owner provisions the
 * SES configuration-set → SNS destination and subscribes that endpoint, the
 * BLOCKER note above still describes the deployed runtime honestly.
 */
export const DELIVERY_STATUS = {
  QUEUED: "queued",
  ACCEPTED: "accepted",
  RETRYING: "retrying",
  DEAD_LETTERED: "dead_lettered",
  FAILED_TERMINAL: "failed_terminal",
  SKIPPED: "skipped",
  DELIVERED: "delivered",
  BOUNCED: "bounced",
  COMPLAINED: "complained",
  REJECTED: "rejected",
  DELIVERY_DELAYED: "delivery_delayed",
} as const;

/** What a transport call returned, including the provider's own receipt id. */
export interface SendReceipt {
  status: SendOutcome;
  /** SES `MessageId`. Stored on the notification row for support/debugging. */
  messageId?: string | null;
}

export interface EmailPayload {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface TransportConfig {
  provider: "resend" | "ses";
  apiKey?: string;
  region: string;
  fromEmail: string;
  fromName: string;
  configurationSet?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(String(value || "").trim());
}

/** Reads transport config from the environment, or null when unconfigured. */
export function readTransportConfig(
  env: NodeJS.ProcessEnv = process.env
): TransportConfig | null {
  const fromEmail = (env.FROM_EMAIL || "").trim();
  if (!fromEmail || !isValidEmail(fromEmail)) return null;

  const fromName = (env.FROM_NAME || "SnehaVrinda Kala").trim();
  const resendKey = (env.RESEND_API_KEY || "").trim();

  // Resend wins when both are configured: it is the simpler receipt path and
  // the one this deployment actually verifies.
  if (resendKey) {
    return { provider: "resend", apiKey: resendKey, region: "", fromEmail, fromName };
  }

  return {
    provider: "ses",
    region: env.AWS_SES_REGION || env.AWS_REGION || "ap-south-1",
    fromEmail,
    fromName,
    configurationSet: env.AWS_SES_CONFIGURATION_SET || undefined,
  };
}

function hasCredentials(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(
    (env.AWS_SES_ACCESS_KEY_ID && env.AWS_SES_SECRET_ACCESS_KEY) ||
      // On ECS Fargate an instance/task role is used instead of static keys.
      env.AWS_CONTAINER_CREDENTIALS_RELATIVE_URI ||
      env.AWS_ROLE_ARN
  );
}
let client: SESv2Client | null = null;

function getClient(region: string): SESv2Client {
  if (!client) {
    client = new SESv2Client({
      region,
      ...(process.env.AWS_SES_ACCESS_KEY_ID && process.env.AWS_SES_SECRET_ACCESS_KEY
        ? {
            credentials: {
              accessKeyId: process.env.AWS_SES_ACCESS_KEY_ID,
              secretAccessKey: process.env.AWS_SES_SECRET_ACCESS_KEY,
            },
          }
        : {}),
    });
  }
  return client;
}

/**
 * Send and return the provider receipt as well as the coarse outcome.
 *
 * `sendEmail` below keeps its historical `"sent" | "skipped"` return value for
 * existing callers; the notification service uses this richer form so it can
 * persist the SES `MessageId`.
 */
export async function sendEmailWithReceipt(
  payload: EmailPayload,
  env: NodeJS.ProcessEnv = process.env
): Promise<SendReceipt> {
  const config = readTransportConfig(env);

  if (!config || (config.provider === "ses" && !hasCredentials(env))) {
    // Development / CI: print a readable preview instead of sending. Even here
    // the recipient and body are PII: scrub emails and card-like numbers before
    // logging, so a preview can never leak a real address into shared CI logs.
    console.log(
      `\n[email:skipped] to=${scrubPii(payload.to)} subject="${scrubPii(payload.subject)}"\n${scrubPii(payload.text)}\n`
    );
    return { status: "skipped", messageId: null };
  }

  if (!isValidEmail(payload.to)) {
    throw new Error(`Invalid recipient address: "${payload.to}"`);
  }

  if (config.provider === "resend") {
    return sendViaResend(payload, config);
  }

  const command = new SendEmailCommand({
    FromEmailAddress: `${config.fromName} <${config.fromEmail}>`,
    Destination: { ToAddresses: [payload.to] },
    ...(config.configurationSet
      ? { ConfigurationSetName: config.configurationSet }
      : {}),
    Content: {
      Simple: {
        Subject: { Data: payload.subject, Charset: "UTF-8" },
        Body: {
          Html: { Data: payload.html, Charset: "UTF-8" },
          Text: { Data: payload.text, Charset: "UTF-8" },
        },
      },
    },
  });

  const result = await getClient(config.region).send(command);
  // SES has ACCEPTED/QUEUED the message; this is not proof of delivery. Only a
  // verified delivery event may advance the row to `delivered`.
  return { status: "sent", messageId: result.MessageId || null };
}

const RESEND_ENDPOINT = "https://api.resend.com/emails";

/**
 * Send through Resend.
 *
 * Resend returns `{ id }` for an accepted message — the same "accepted, not
 * delivered" semantics as SES. Errors are thrown with the provider's own reason
 * (a 403 usually means the sending domain is not verified yet) because that is
 * the one thing an operator needs to see to fix it.
 */
async function sendViaResend(
  payload: EmailPayload,
  config: TransportConfig
): Promise<SendReceipt> {
  const res = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    signal: AbortSignal.timeout(15_000),
    body: JSON.stringify({
      from: `${config.fromName} <${config.fromEmail}>`,
      to: [payload.to],
      subject: payload.subject,
      html: payload.html,
      text: payload.text,
    }),
  });

  const body = (await res.json().catch(() => null)) as
    | { id?: string; message?: string; name?: string }
    | null;

  if (!res.ok) {
    const reason = body?.message || body?.name || `HTTP ${res.status}`;
    throw new Error(`Resend rejected the message: ${scrubPii(String(reason))}`);
  }

  return { status: "sent", messageId: body?.id || null };
}

/** Backwards-compatible wrapper: the coarse outcome existing callers expect. */
export async function sendEmail(
  payload: EmailPayload,
  env: NodeJS.ProcessEnv = process.env
): Promise<SendOutcome> {
  return (await sendEmailWithReceipt(payload, env)).status;
}

/** Reset the cached client — used by tests. */
export function resetTransport(): void {
  client = null;
}
