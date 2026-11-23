/**
 * A10 INDEPENDENT QA — A03 notifications (pure + static + fake adapters only).
 *
 * Independently pins: a bounded retry state machine with dead-letter, honest
 * `status=sent` (accepted, not delivered), verified SES→SNS events, raw
 * signature checks, no raw recipient in security-relevant logs, and the
 * CRON_SECRET-guarded worker + admin observability + compose scheduler.
 * No live SES/SNS, database, credentials or network are used.
 */
import { createSign, generateKeyPairSync } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  NOTIFICATION_MAX_ATTEMPTS_CAP,
  NOTIFICATION_MAX_ATTEMPTS_DEFAULT,
  isTrustedSnsCertUrl,
  notificationBackoffDelayMs,
  notificationMaxAttempts,
  parseSesEvent,
  planNotificationRetry,
  precheckSnsMessage,
  processNotificationRetries,
  processVerifiedSnsNotification,
  redactPii,
  shouldSuppressSesEvent,
  snsCanonicalString,
  verifySnsSignature,
  type SesEvent,
  type SnsMessage,
} from "@/lib/notifications";
import { NOTIFICATION_STATUS, retryTransition } from "@/lib/outbox";

const app = join(__dirname, "..");
const repo = join(app, "..", "..");
const readApp = (rel: string) => readFileSync(join(app, rel), "utf8");
const readRepo = (rel: string) => readFileSync(join(repo, rel), "utf8");
const NOW = Date.parse("2026-11-23T00:00:00.000Z");
/** This project's ProcessEnv requires NODE_ENV; cast test-only env shards. */
const ENV = (o: Record<string, string>): NodeJS.ProcessEnv => o as NodeJS.ProcessEnv;

describe("A03 — bounded backoff, dead-letter and terminal classification (pure)", () => {
  it("backoff is exponential with a bounded ceiling", () => {
    expect(notificationBackoffDelayMs(0)).toBe(60_000);
    expect(notificationBackoffDelayMs(1)).toBe(120_000);
    expect(notificationBackoffDelayMs(2)).toBe(240_000);
    expect(notificationBackoffDelayMs(100)).toBe(3_600_000);
    expect(notificationBackoffDelayMs(-5)).toBe(60_000);
  });

  it("max attempts is owner-configurable but always fail-safe bounded", () => {
    expect(notificationMaxAttempts(ENV({}))).toBe(NOTIFICATION_MAX_ATTEMPTS_DEFAULT);
    expect(notificationMaxAttempts(ENV({ NOTIFICATION_MAX_ATTEMPTS: "7" }))).toBe(7);
    expect(notificationMaxAttempts(ENV({ NOTIFICATION_MAX_ATTEMPTS: "999" }))).toBe(
      NOTIFICATION_MAX_ATTEMPTS_CAP
    );
    expect(notificationMaxAttempts(ENV({ NOTIFICATION_MAX_ATTEMPTS: "abc" }))).toBe(
      NOTIFICATION_MAX_ATTEMPTS_DEFAULT
    );
  });

  it("terminal errors go straight to a terminal state with no retry", () => {
    const plan = planNotificationRetry({
      attempts: 0,
      error: new Error("Invalid recipient: bad address"),
      now: new Date(NOW),
      maxAttempts: 5,
    });
    expect(plan.delivery_status).toBe("failed_terminal");
    expect(plan.next_attempt_at).toBeNull();
    expect(plan.error_kind).toBe("terminal");
    expect(plan.ok).toBe(false);
  });

  it("transient errors are retried then dead-lettered, never discarded", () => {
    const retry = planNotificationRetry({
      attempts: 0,
      error: new Error("SES throttling, try again"),
      now: new Date(NOW),
      maxAttempts: 5,
    });
    expect(retry.delivery_status).toBe("retrying");
    expect(retry.next_attempt_at).toBe(new Date(NOW + 60_000).toISOString());

    const dead = planNotificationRetry({
      attempts: 4,
      error: new Error("timeout"),
      now: new Date(NOW),
      maxAttempts: 5,
    });
    expect(dead.delivery_status).toBe("dead_lettered");
    expect(dead.terminal_reason).toBe("max_attempts_reached");
    expect(dead.dead_lettered_at).toBe(new Date(NOW).toISOString());
    expect(dead.next_attempt_at).toBeNull();
  });

  it("stored error text is PII-redacted", () => {
    expect(redactPii("send to buyer@example.test failed")).toBe("send to [redacted] failed");
    const plan = planNotificationRetry({
      attempts: 0,
      error: new Error("timeout for buyer@example.test"),
      now: new Date(NOW),
    });
    expect(plan.last_error).not.toContain("buyer@example.test");
    expect(plan.last_error).toContain("[redacted]");
  });
});

describe("A03 — honest status=sent semantics (worker adapter + pure)", () => {
  function claimFake(row: Record<string, any>) {
    const calls: Array<{ sql: string; params: any[] }> = [];
    const query = async (sql: string, params: any[] = []): Promise<any[]> => {
      calls.push({ sql, params });
      const norm = sql.replace(/\s+/g, " ");
      if (norm.includes('"lease_owner" = $1') && norm.includes("RETURNING")) return [row];
      return [];
    };
    return { query, calls };
  }

  function seedRow(o: Record<string, any> = {}): Record<string, any> {
    return {
      id: "n-qa-1",
      recipient: "buyer@example.test",
      template: "order_confirmation",
      data: { order: { id: "ord-qa-1" } },
      attempts: 0,
      max_attempts: 5,
      provider_message_id: null,
      event_key: "order_confirmation:ord-qa-1",
      error_kind: "retryable",
      ...o,
    };
  }

  it("maps 'sent' to status=sent but delivery_status=accepted (NOT delivered)", async () => {
    const { query, calls } = claimFake(seedRow());
    const result = await processNotificationRetries({
      query,
      workerId: "qa-worker",
      send: async () => ({ status: "sent", messageId: "ses-msg-qa" }),
      now: () => new Date(NOW),
    });
    expect(result.sent).toBe(1);
    const patch = calls.find((c) => c.params.includes("sent") && c.params.includes("accepted"));
    expect(patch).toBeDefined();
    expect(patch!.params).toContain("ses-msg-qa");
    const src = readApp("lib/notifications.ts");
    expect(src).toMatch(/status:\s*["']sent["']/);
    expect(src).toMatch(/delivery_status:\s*["']accepted["']/);
    expect(src).toMatch(/NOT delivered/);
    expect(src).toMatch(/verified SES event/);
  });

  it("never re-sends a row that already has a provider message id", async () => {
    const { query } = claimFake(seedRow({ provider_message_id: "ses-existing" }));
    let sendCalls = 0;
    const result = await processNotificationRetries({
      query,
      send: async () => {
        sendCalls += 1;
        return { status: "sent", messageId: "should-not-happen" };
      },
      now: () => new Date(NOW),
    });
    expect(result.skipped).toBe(1);
    expect(sendCalls).toBe(0);
  });

  it("dead-letters a row that exhausts attempts instead of dropping it", async () => {
    const { query } = claimFake(seedRow({ attempts: 4, max_attempts: 5 }));
    const result = await processNotificationRetries({
      query,
      send: async () => {
        throw new Error("SES timeout");
      },
      now: () => new Date(NOW),
    });
    expect(result.deadLettered).toBe(1);
  });

  it("outbox retryTransition keeps 'sent' honest and never claims delivered", () => {
    expect(retryTransition({ status: "sent" }).status).toBe(NOTIFICATION_STATUS.SENT);
    expect(retryTransition({ status: "delivered" }).status).toBe(NOTIFICATION_STATUS.SENT);
    expect(retryTransition({ status: "skipped" }).status).toBe(NOTIFICATION_STATUS.SKIPPED);
    expect(retryTransition({ status: "failed", error: "x" }).status).toBe(NOTIFICATION_STATUS.FAILED);
    expect(NOTIFICATION_STATUS.DELIVERED).toBe("delivered");
    const src = readApp("lib/outbox.ts");
    const fn = src.match(/export function retryTransition\([\s\S]*?\n\}/);
    expect(fn).not.toBeNull();
    // The manual retry transition never claims a delivery confirmation.
    expect(fn![0]).not.toMatch(/["']delivered["']/);
  });
});

describe("A03 — SES→SNS verified events and raw signature checks", () => {
  const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const certPem = publicKey.export({ type: "spki", format: "pem" }).toString();
  const CERT_URL =
    "https://sns.ap-south-1.amazonaws.com/SimpleNotificationService/abc123def456.pem";
  const TOPIC = "arn:aws:sns:ap-south-1:123456789012:ses-events";

  function notification(overrides: Partial<SnsMessage> = {}): SnsMessage {
    return {
      Type: "Notification",
      MessageId: "sns-msg-qa-1",
      TopicArn: TOPIC,
      Message: JSON.stringify({ eventType: "Delivery", mail: { messageId: "ses-msg-qa" } }),
      Timestamp: "2026-11-23T00:00:00.000Z",
      SignatureVersion: "2",
      SigningCertURL: CERT_URL,
      ...overrides,
    } as SnsMessage;
  }

  function signed(msg: SnsMessage): SnsMessage {
    const canonical = snsCanonicalString(msg, String(msg.SignatureVersion));
    expect(canonical).not.toBeNull();
    const signature = createSign("RSA-SHA256")
      .update(canonical!, "utf8")
      .sign(privateKey)
      .toString("base64");
    return { ...msg, Signature: signature };
  }

  it("verifies a correctly signed SNS notification and rejects a tampered one", () => {
    const msg = signed(notification());
    expect(verifySnsSignature(msg, certPem)).toBe(true);
    const tampered = { ...msg, Message: JSON.stringify({ eventType: "Bounce" }) };
    expect(verifySnsSignature(tampered, certPem)).toBe(false);
    expect(verifySnsSignature(msg, "not a pem")).toBe(false);
    expect(verifySnsSignature(notification(), certPem)).toBe(false); // missing signature
  });

  it("rejects SSRF cert hosts and mismatched topic/header before verifying", () => {
    expect(isTrustedSnsCertUrl(CERT_URL)).toBe(true);
    expect(isTrustedSnsCertUrl("http://evil.example/x.pem")).toBe(false);
    expect(isTrustedSnsCertUrl("https://evil.example/SimpleNotificationService/a.pem")).toBe(false);
    const msg = signed(notification());
    expect(precheckSnsMessage(msg, { topicArn: TOPIC, headerType: "Notification" }).ok).toBe(true);
    expect(precheckSnsMessage(msg, { topicArn: "arn:aws:sns:other" }).ok).toBe(false);
    expect(precheckSnsMessage(msg, { headerType: "SubscriptionConfirmation" }).ok).toBe(false);
    expect(
      precheckSnsMessage(notification({ SigningCertURL: "https://evil.example/x.pem" })).ok
    ).toBe(false);
  });

  it("only verified signatures advance delivery status; bad signature writes nothing", async () => {
    const calls: Array<{ sql: string; params: any[] }> = [];
    const query = async (sql: string, params: any[] = []): Promise<any[]> => {
      calls.push({ sql, params });
      return [];
    };
    const good = await processVerifiedSnsNotification(signed(notification()), certPem, {
      query,
      env: ENV({ SES_SNS_TOPIC_ARN: TOPIC }),
    });
    expect(good.reason).toBe("duplicate_event"); // INSERT returned no row; still proves it got past signature
    expect(calls.some((c) => /INSERT INTO "notification_event"/.test(c.sql))).toBe(true);

    calls.length = 0;
    // Passes the envelope precheck (all required fields) but fails verification.
    const forged = { ...signed(notification()), Message: JSON.stringify({ eventType: "Bounce" }) };
    const bad = await processVerifiedSnsNotification(forged, certPem, {
      query,
      env: ENV({ SES_SNS_TOPIC_ARN: TOPIC }),
    });
    expect(bad).toMatchObject({ applied: false, reason: "invalid_signature" });
    expect(calls.some((c) => /notification_event/i.test(c.sql))).toBe(false);
  });

  it("parses SES events into delivery/bounce with suppression policy (no recipient kept)", () => {
    const event = parseSesEvent(
      notification({
        Message: JSON.stringify({
          eventType: "Bounce",
          mail: { messageId: "ses-msg-qa" },
          bounce: { bounceType: "Permanent" },
        }),
      })
    ) as SesEvent;
    expect(event.eventType).toBe("bounce");
    expect(event.bounceType).toBe("Permanent");
    expect(event).not.toHaveProperty("recipient");
    expect(shouldSuppressSesEvent(event, ENV({ SES_SUPPRESS_ON_BOUNCE: "true" }))).toEqual({
      suppress: true,
      reason: "hard_bounce",
    });
    const soft = { ...event, bounceType: "Transient" };
    expect(shouldSuppressSesEvent(soft, ENV({})).suppress).toBe(false);
  });
});

describe("A03 — no raw recipient in security-relevant logs", () => {
  it("SES webhook logs only a classification reason, never the raw body/recipient", () => {
    const src = readApp("app/api/webhooks/ses/route.ts");
    expect(src).toMatch(/console\.warn\(\s*["']\[ses-webhook\] rejected envelope["'],\s*precheck\.reason/);
    expect(src).toMatch(/console\.warn\(\s*["']\[ses-webhook\] invalid signature["']\s*\)/);
    expect(src).not.toMatch(/console\.log\([^)]*raw\b/);
    expect(src).toMatch(/No recipient address is returned or logged/i);
  });

  it("notification service failure log is PII-free and error text is redacted", () => {
    const svc = readApp(join("..", "backend", "src", "modules", "notification", "service.ts"));
    expect(svc).toMatch(/recipient withheld/);
    expect(svc).not.toMatch(/console\.error\([^)]*payload\.to/);
    const plan = planNotificationRetry({ attempts: 0, error: new Error("to a@b.co failed"), now: new Date(NOW) });
    expect(plan.last_error).not.toContain("a@b.co");
  });
});

describe("A03 — CRON_SECRET worker, admin observability and compose scheduler", () => {
  it("worker route is CRON_SECRET-guarded (unset=503, wrong=401)", () => {
    const src = readApp("app/api/cron/notification-retries/route.ts");
    expect(src).toMatch(/authoriseCron/);
    expect(src).toMatch(/CRON_SECRET/);
    expect(src).toMatch(/process\.env\.CRON_SECRET\s*\?\s*401\s*:\s*503/);
    expect(src).toMatch(/processNotificationRetries/);
    expect(src).toMatch(/MAX_PER_RUN/);
  });

  it("admin observability route requires an admin session and reads stats only", () => {
    const src = readApp("app/api/admin/notification-retries/route.ts");
    expect(src).toMatch(/requireAdmin/);
    expect(src).toMatch(/notificationRetryStats/);
    expect(src).not.toMatch(/processNotificationRetries/); // read-only
  });

  it("compose schedules the guarded worker with a CRON_SECRET and the retry target", () => {
    const compose = readRepo("docker-compose.yml");
    expect(compose).toMatch(/notification-retry-cron:/);
    expect(compose).toMatch(/CRON_SECRET:\s*\$\{CRON_SECRET:-\}/);
    expect(compose).toMatch(/api\/cron\/notification-retries/);
    expect(compose).toMatch(/CRON_SECRET is empty: the retry endpoint will refuse every call/);
  });
});
