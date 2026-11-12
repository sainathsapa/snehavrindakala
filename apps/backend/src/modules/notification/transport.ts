/**
 * AWS SES transport.
 *
 * Uses SES v2 through the AWS SDK when credentials are configured. Two cases
 * are deliberately distinguished:
 *
 *  - Not configured (local dev, CI): log the email and report `skipped` so the
 *    notification row is not marked failed and does not look like an incident.
 *  - Configured but the send fails: throw, so the row is recorded as failed
 *    and the admin can see it. Silence here is worse than an error.
 */

import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";

export type SendOutcome = "sent" | "skipped";

export interface EmailPayload {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface TransportConfig {
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

  return {
    region: env.AWS_SES_REGION || env.AWS_REGION || "ap-south-1",
    fromEmail,
    fromName: (env.FROM_NAME || "SnehaVrinda Kala").trim(),
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

export async function sendEmail(
  payload: EmailPayload,
  env: NodeJS.ProcessEnv = process.env
): Promise<SendOutcome> {
  const config = readTransportConfig(env);

  if (!config || !hasCredentials(env)) {
    // Development / CI: print a readable preview instead of sending.
    console.log(
      `\n[email:skipped] to=${payload.to} subject="${payload.subject}"\n${payload.text}\n`
    );
    return "skipped";
  }

  if (!isValidEmail(payload.to)) {
    throw new Error(`Invalid recipient address: "${payload.to}"`);
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

  await getClient(config.region).send(command);
  return "sent";
}

/** Reset the cached client — used by tests. */
export function resetTransport(): void {
  client = null;
}
