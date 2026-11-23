/**
 * POST /api/webhooks/ses — verified SES delivery events via Amazon SNS.
 *
 * MECHANISM CHOICE
 * ----------------
 * SES event publishing supports SNS and EventBridge. This deployment is a
 * docker-compose stack with no EventBridge bus/rule in its infrastructure
 * (see docker-compose.yml and deploy/), and AWS_SES_CONFIGURATION_SET is the
 * only SES-event-related setting it exposes. No event destination is configured
 * on either side, so the provider mechanism is UNDETERMINED by the repo.
 * Per the assignment we implement the common SES→SNS path: a configuration set
 * with an SNS event destination, delivered to this endpoint. EventBridge would
 * need owner-provisioned bus + rule and a different auth scheme; that remains a
 * documented owner decision, not an invented one.
 *
 * SECURITY
 * --------
 * Raw JSON is NEVER trusted. Every request must carry a valid SNS signature
 * over the documented canonical string, signed by a certificate hosted on
 * SNS's own HTTPS host. The signing certificate URL and (when configured) the
 * topic ARN are pinned. Subscription confirmation additionally requires a
 * verified signature and a SubscribeURL on the SNS host before confirming.
 * No recipient address is ever written to a log.
 *
 * Owner-gated: the SNS topic subscription must be created by the owner, and
 * SES_SNS_TOPIC_ARN set to pin the accepted topic. Until then nothing is wired
 * and no delivery status is written. This endpoint is not a PASS on its own.
 */

import { NextResponse } from "next/server";
import {
  confirmSnsSubscription,
  getSnsCertificate,
  isSnsMessage,
  precheckSnsMessage,
  processVerifiedSnsNotification,
} from "@/lib/notifications";

export const dynamic = "force-dynamic";

function noStore(json: unknown, status = 200): NextResponse {
  const res = NextResponse.json(json, { status });
  res.headers.set("Cache-Control", "no-store");
  return res;
}

export async function POST(req: Request) {
  const headerType = req.headers.get("x-amz-sns-message-type") || "";
  if (!headerType) {
    return noStore({ error: "Missing x-amz-sns-message-type" }, 400);
  }

  let raw: string;
  try {
    raw = await req.text();
  } catch {
    return noStore({ error: "Unreadable body" }, 400);
  }

  let message: unknown;
  try {
    message = JSON.parse(raw);
  } catch {
    return noStore({ error: "Invalid JSON" }, 400);
  }

  const precheck = precheckSnsMessage(message, {
    headerType,
    topicArn: process.env.SES_SNS_TOPIC_ARN || undefined,
  });
  if (!precheck.ok) {
    // Log only a classification reason, never the body (which may contain PII).
    console.warn("[ses-webhook] rejected envelope", precheck.reason);
    return noStore({ error: "Untrusted SNS envelope" }, 401);
  }

  if (!isSnsMessage(message)) {
    return noStore({ error: "Invalid SNS envelope" }, 401);
  }

  const certPem = await getSnsCertificate(message.SigningCertURL || "").catch(() => null);
  if (!certPem) {
    return noStore({ error: "Signing certificate unavailable" }, 503);
  }

  if (message.Type === "SubscriptionConfirmation") {
    const confirmed = await confirmSnsSubscription(message, certPem).catch(() => false);
    if (!confirmed) {
      console.warn("[ses-webhook] subscription confirmation failed");
      return noStore({ error: "Subscription confirmation failed" }, 401);
    }
    // Confirmation carries no delivery data; acknowledge so SNS stops retrying.
    return noStore({ confirmed: true });
  }

  if (message.Type !== "Notification") {
    return noStore({ error: "Unsupported SNS message type" }, 400);
  }

  const result = await processVerifiedSnsNotification(message, certPem).catch((): import("@/lib/notifications").SesEventApplyResult => ({
    applied: false,
    reason: "processing_error",
  }));

  if (result.reason === "invalid_signature" || result.reason === "untrusted_envelope") {
    console.warn("[ses-webhook] invalid signature");
    return noStore({ error: "Invalid SNS signature" }, 401);
  }
  if (result.reason === "unrecognised_event") {
    return noStore({ error: "Unrecognised SES event" }, 422);
  }

  // No recipient address is returned or logged — only ids and status labels.
  return noStore({
    applied: result.applied,
    reason: result.reason ?? null,
    notification_id: result.notificationId ?? null,
    delivery_status: result.deliveryStatus ?? null,
    suppressed: Boolean(result.suppressed),
  });
}
