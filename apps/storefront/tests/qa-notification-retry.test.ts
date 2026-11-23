/**
 * QA — notification retry + verified SES delivery events (pure/adapter only).
 *
 * NO live SES/SNS, no network, no credentials, no database. A small in-memory
 * fake executor records the SQL the adapters issue; signatures are produced with
 * a locally generated RSA key pair. SRV-05/07 are code-level checks, NOT proof
 * that any real email was delivered — `sent` means "provider accepted".
 */

import { createSign, generateKeyPairSync } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";

import {
  NOTIFICATION_MAX_ATTEMPTS_DEFAULT,
  applyVerifiedSesEvent,
  claimDueRetries,
  classifyNotificationError,
  notificationBackoffDelayMs,
  notificationMaxAttempts,
  parseSesEvent,
  planNotificationRetry,
  precheckSnsMessage,
  processNotificationRetries,
  processVerifiedSnsNotification,
  shouldSuppressSesEvent,
  snsCanonicalString,
  verifySnsSignature,
  type RetrySendResult,
  type SesEvent,
  type SnsMessage,
} from "@/lib/notifications";

const CERT_URL = "https://sns.ap-south-1.amazonaws.com/SimpleNotificationService/abc123def456.pem";
const TOPIC_ARN = "arn:aws:sns:ap-south-1:123456789012:ses-events";
const NOW = Date.parse("2026-11-23T00:00:00.000Z");

/* ── In-memory fake executor (records SQL, no I/O) ───────────────────────── */

type Row = Record<string, any>;

class FakeDb {
  rows = new Map<string, Row>();
  events = new Map<string, any>();
  suppressions: Array<{ recipient: string; reason: string }> = [];
  calls: Array<{ sql: string; params: any[] }> = [];
  nowMs = NOW;

  seed(overrides: Partial<Row> = {}): Row {
    const row: Row = {
      id: `n-${Math.random().toString(36).slice(2, 10)}`,
      recipient: "buyer@example.test",
      template: "order_confirmation",
      data: { order: { id: "ord-1" } },
      status: "failed",
      attempts: 0,
      max_attempts: 5,
      next_attempt_at: new Date(NOW - 1000).toISOString(),
      last_error: "SES throttled",
      error_kind: "retryable",
      last_attempt_at: null,
      delivery_status: "retrying",
      terminal_reason: null,
      dead_lettered_at: null,
      suppressed: false,
      last_delivery_event_at: null,
      provider_message_id: null,
      error_message: "SES throttled",
      event_key: "order_confirmation:ord-1",
      deleted_at: null,
      lease_owner: null,
      lease_until: null,
      ...overrides,
    };
    this.rows.set(row.id, row);
    return row;
  }

  private applyAssignments(row: Row, sql: string, params: any[], clearLease = false): void {
    const setPart = sql.slice(sql.indexOf("SET") + 3, sql.indexOf("WHERE"));
    const re = /"(\w+)" = \$(\d+)/g;
    let match: RegExpExecArray | null;
    while ((match = re.exec(setPart))) {
      row[match[1]] = params[Number(match[2]) - 1];
    }
    // Literal assignments (e.g. "suppressed" = true) and the lease release
    // that every claimed-row outcome patch performs.
    const literal = /"(\w+)" = (true|false|NULL)/g;
    while ((match = literal.exec(setPart))) {
      row[match[1]] = match[2] === "true" ? true : match[2] === "false" ? false : null;
    }
    if (clearLease) {
      row.lease_owner = null;
      row.lease_until = null;
    }
  }

  query = async (sql: string, params: any[] = []): Promise<any[]> => {
    this.calls.push({ sql, params });
    const s = sql.replace(/\s+/g, " ").trim();

    // Atomic claim with FOR UPDATE SKIP LOCKED.
    if (s.startsWith('UPDATE "app_notification" SET') && s.includes("FOR UPDATE SKIP LOCKED")) {
      const owner = params[0];
      const leaseMs = Number(params[1]) || 60_000;
      const limit = Number(params[2]) || 50;
      const due = Array.from(this.rows.values())
        .filter(
          (r) =>
            r.delivery_status === "retrying" &&
            r.next_attempt_at &&
            Date.parse(r.next_attempt_at) <= this.nowMs &&
            (!r.lease_until || Date.parse(r.lease_until) < this.nowMs) &&
            !r.deleted_at
        )
        .sort((a, b) => Date.parse(a.next_attempt_at) - Date.parse(b.next_attempt_at))
        .slice(0, limit);
      for (const row of due) {
        row.lease_owner = owner;
        row.lease_until = new Date(this.nowMs + leaseMs).toISOString();
      }
      return due.map((r) => ({ ...r }));
    }

    // Claimed-row outcome patch: only the lease owner may write.
    if (
      s.startsWith('UPDATE "app_notification" SET') &&
      s.includes('WHERE "id" = $1 AND "lease_owner" = $2')
    ) {
      const row = this.rows.get(params[0]);
      if (row && row.lease_owner === params[1]) this.applyAssignments(row, s, params, true);
      return [];
    }

    // Verified-event dedupe boundary.
    if (s.startsWith('INSERT INTO "notification_event"')) {
      const key = String(params[0]);
      if (this.events.has(key)) return [];
      const id = `e-${this.events.size + 1}`;
      this.events.set(key, { id, notification_id: null, ...this.eventFromParams(params) });
      return [{ id }];
    }

    if (s.startsWith("SELECT") && s.includes('"provider_message_id" = $1')) {
      const found = Array.from(this.rows.values()).find((r) => r.provider_message_id === params[0]);
      return found ? [{ id: found.id }] : [];
    }

    if (s.startsWith('UPDATE "notification_event" SET "notification_id"')) {
      const ev = Array.from(this.events.values()).find((e) => e.id === params[0]);
      if (ev) ev.notification_id = params[1];
      return [];
    }

    if (s.startsWith('INSERT INTO "notification_suppression"')) {
      const row = this.rows.get(params[0]);
      if (row?.recipient) this.suppressions.push({ recipient: row.recipient, reason: params[1] });
      return [];
    }

    if (s.startsWith('UPDATE "app_notification" SET') && s.includes('WHERE "id" = $1')) {
      const row = this.rows.get(params[0]);
      if (row) this.applyAssignments(row, s, params);
      return [];
    }

    if (s.includes('AS "total"')) {
      const rows = Array.from(this.rows.values());
      const count = (fn: (r: Row) => boolean) => rows.filter(fn).length;
      return [{
        total: rows.length,
        queued: count((r) => r.delivery_status === "queued"),
        retrying: count((r) => r.delivery_status === "retrying"),
        dueNow: count((r) => r.delivery_status === "retrying" && Date.parse(r.next_attempt_at) <= this.nowMs),
        deadLettered: count((r) => r.delivery_status === "dead_lettered"),
        terminalFailed: count((r) => r.delivery_status === "failed_terminal"),
        accepted: count((r) => r.delivery_status === "accepted"),
        delivered: count((r) => r.delivery_status === "delivered"),
        suppressed: count((r) => r.suppressed),
      }];
    }
    return [];
  };

  private eventFromParams(params: any[]) {
    return {
      provider_event_id: params[0],
      event_type: params[1],
      message_id: params[2],
      bounce_type: params[3],
    };
  }
}

let db: FakeDb;
beforeEach(() => {
  db = new FakeDb();
});

function worker(overrides: Partial<Parameters<typeof processNotificationRetries>[0]> = {}) {
  return {
    query: db.query,
    now: () => new Date(db.nowMs),
    env: {} as NodeJS.ProcessEnv,
    workerId: "worker-A",
    ...overrides,
  };
}

/* ── 1–5: retry state machine (pure + adapter) ────────────────────────────── */

describe("notification retry — state machine", () => {
  it("first attempt succeeds: accepted by provider, lease released, no delivery claim", async () => {
    const row = db.seed();
    let calls = 0;
    const result = await processNotificationRetries(
      worker({
        send: async () => {
          calls += 1;
          return { status: "sent", messageId: "ses-abc" };
        },
      })
    );

    expect(result.claimed).toBe(1);
    expect(result.sent).toBe(1);
    expect(calls).toBe(1);
    expect(row.status).toBe("sent");
    // "sent" = provider accepted, NOT delivered.
    expect(row.delivery_status).toBe("accepted");
    expect(row.provider_message_id).toBe("ses-abc");
    expect(row.attempts).toBe(1);
    expect(row.lease_owner).toBeNull();
    expect(row.lease_until).toBeNull();
  });

  it("first attempt fails (transient) then a later attempt succeeds", async () => {
    const row = db.seed();
    const outcomes: RetrySendResult[] = [
      { status: "failed", error: "Connection timeout" },
      { status: "sent", messageId: "ses-retry" },
    ];
    let index = 0;
    const send = async () => outcomes[index++];

    const first = await processNotificationRetries(worker({ send }));
    expect(first.scheduled).toBe(1);
    expect(row.delivery_status).toBe("retrying");
    expect(row.attempts).toBe(1);
    expect(row.next_attempt_at).toBeTruthy();
    expect(Date.parse(row.next_attempt_at!)).toBeGreaterThan(NOW);

    // Simulate the backoff window elapsing, then restart the worker.
    db.nowMs += 70_000;
    const second = await processNotificationRetries(worker({ send, workerId: "worker-B" }));
    expect(second.sent).toBe(1);
    expect(row.delivery_status).toBe("accepted");
    expect(row.provider_message_id).toBe("ses-retry");
    expect(row.attempts).toBe(2);
  });

  it("uses bounded exponential backoff (60s → 120s → 240s → 1h ceiling)", () => {
    expect(NOTIFICATION_MAX_ATTEMPTS_DEFAULT).toBe(5);
    expect(notificationBackoffDelayMs(0)).toBe(60_000);
    expect(notificationBackoffDelayMs(1)).toBe(120_000);
    expect(notificationBackoffDelayMs(2)).toBe(240_000);
    expect(notificationBackoffDelayMs(99)).toBe(3_600_000);
    expect(notificationMaxAttempts({ NOTIFICATION_MAX_ATTEMPTS: "3" } as any)).toBe(3);
    expect(notificationMaxAttempts({ NOTIFICATION_MAX_ATTEMPTS: "999" } as any)).toBe(50);

    const plan = planNotificationRetry({ attempts: 1, error: "SES throttling", now: new Date(NOW) });
    expect(plan.next_attempt_at).toBe(new Date(NOW + 120_000).toISOString());
  });

  it("dead-letters (never discards) once max attempts is reached", async () => {
    const plan = planNotificationRetry({
      attempts: 2,
      error: "provider 503",
      maxAttempts: 3,
      now: new Date(NOW),
    });
    expect(plan.delivery_status).toBe("dead_lettered");
    expect(plan.attempts).toBe(3);
    expect(plan.next_attempt_at).toBeNull();
    expect(plan.terminal_reason).toBe("max_attempts_reached");

    const row = db.seed({ attempts: 2, max_attempts: 3 });
    const result = await processNotificationRetries(
      worker({ send: async () => ({ status: "failed", error: "500 Internal Server Error" }) })
    );
    expect(result.deadLettered).toBe(1);
    expect(row.delivery_status).toBe("dead_lettered");
    expect(row.status).toBe("failed"); // historical status kept; no CHECK rewrite
    expect(row.dead_lettered_at).toBeTruthy();
  });

  it("treats invalid recipient / auth / permanent rejection as terminal (no retry)", async () => {
    expect(classifyNotificationError("Invalid recipient address: x@y").kind).toBe("terminal");
    expect(classifyNotificationError("401 Unauthorized: bad SES credentials").kind).toBe("terminal");
    expect(classifyNotificationError("Message rejected: Permanent failure").kind).toBe("terminal");
    expect(classifyNotificationError("Connection timeout").kind).toBe("retryable");
    expect(classifyNotificationError("SES Throttling: rate exceeded").kind).toBe("retryable");

    const row = db.seed();
    const result = await processNotificationRetries(
      worker({ send: async () => ({ status: "failed", error: "401 Unauthorized" }) })
    );
    expect(result.terminal).toBe(1);
    expect(result.scheduled).toBe(0);
    expect(row.delivery_status).toBe("failed_terminal");
    expect(row.next_attempt_at).toBeNull();
    expect(row.terminal_reason).toBe("authentication_failure");
  });

  it("redacts recipient PII from stored error text", () => {
    const plan = planNotificationRetry({ attempts: 0, error: "Invalid recipient someone.private@example.com" });
    expect(plan.last_error).not.toMatch(/someone\.private@example\.com/);
    expect(plan.last_error).toMatch(/\[redacted\]/);
  });
});

/* ── 6: duplicate processing / lease ownership ────────────────────────────── */

describe("notification retry — idempotency and lease", () => {
  it("two workers cannot process the same due row (SKIP LOCKED / lease)", async () => {
    db.seed();
    // Worker A holds an unexpired lease on the only due row.
    await claimDueRetries({ query: db.query, workerId: "worker-A", leaseMs: 60_000 });
    const claimedByB = await claimDueRetries({ query: db.query, workerId: "worker-B" });
    expect(claimedByB).toHaveLength(0);

    const secondPass = await processNotificationRetries(
      worker({ workerId: "worker-B", send: async () => ({ status: "sent", messageId: "x" }) })
    );
    expect(secondPass.claimed).toBe(0);
  });

  it("a provider MessageId already on the row is never re-sent (idempotency)", async () => {
    const row = db.seed({ provider_message_id: "ses-already-accepted" });
    let sends = 0;
    const result = await processNotificationRetries(
      worker({
        send: async () => {
          sends += 1;
          return { status: "sent", messageId: "ses-duplicate" };
        },
      })
    );
    expect(sends).toBe(0);
    expect(result.skipped).toBe(1);
    expect(row.provider_message_id).toBe("ses-already-accepted");
  });

  it("recovers after a worker restart: an expired lease is reclaimable", async () => {
    const row = db.seed();
    // Worker A died mid-send: its lease is present but stale/expired.
    row.lease_owner = "worker-A-died";
    row.lease_until = new Date(NOW - 5000).toISOString();

    // A fresh worker reclaims the expired lease and completes the send.
    const result = await processNotificationRetries(
      worker({ workerId: "worker-B", send: async () => ({ status: "sent", messageId: "ses-recovered" }) })
    );
    expect(result.sent).toBe(1);
    expect(row.provider_message_id).toBe("ses-recovered");
    expect(row.lease_owner).toBeNull();
  });
});

/* ── SNS signature helpers ────────────────────────────────────────────────── */

const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const certPem = publicKey.export({ type: "spki", format: "pem" }).toString();
let messageCounter = 0;

function sesPayload(eventType: string, messageId: string, extra: Record<string, any> = {}) {
  return {
    eventType,
    mail: { messageId, timestamp: "2026-11-23T00:00:00.000Z" },
    ...extra,
  };
}

function signedNotification(payload: any, tamper = false): SnsMessage {
  const message: SnsMessage = {
    Type: "Notification",
    MessageId: `sns-${++messageCounter}`,
    TopicArn: TOPIC_ARN,
    Message: JSON.stringify(payload),
    Timestamp: "2026-11-23T00:01:00.000Z",
    SignatureVersion: "1",
    Signature: "",
    SigningCertURL: CERT_URL,
  };
  const canonical = snsCanonicalString(message, "1")!;
  const signature = createSign("RSA-SHA1").update(canonical).end().sign(privateKey).toString("base64");
  message.Signature = signature;
  if (tamper) message.MessageId = `sns-tampered-${messageCounter}`;
  return message;
}

/* ── 7–8: duplicate provider event / invalid signature ───────────────────── */

describe("SES events — authenticity and dedupe", () => {
  it("rejects an invalid SES event signature and writes nothing", async () => {
    const good = signedNotification(sesPayload("Delivery", "ses-1"));
    const bad = signedNotification(sesPayload("Delivery", "ses-2"), true);

    expect(verifySnsSignature(good, certPem)).toBe(true);
    expect(verifySnsSignature(bad, certPem)).toBe(false);
    expect(precheckSnsMessage(bad, { topicArn: TOPIC_ARN }).ok).toBe(true);

    const result = await processVerifiedSnsNotification(bad, certPem, {
      query: db.query,
      env: {} as NodeJS.ProcessEnv,
    });
    expect(result).toMatchObject({ applied: false, reason: "invalid_signature" });
    expect(db.events.size).toBe(0);
  });

  it("fail-closed: untrusted cert URL and wrong topic are rejected before verify", () => {
    const message = signedNotification(sesPayload("Delivery", "ses-3"));
    expect(isTrustedCertCheck(message)).toBe(true);
    const evil = { ...message, SigningCertURL: "https://evil.example.com/cert.pem" };
    expect(precheckSnsMessage(evil, {}).ok).toBe(false);
    expect(precheckSnsMessage(message, { topicArn: "arn:aws:sns:ap-south-1:1:other" }).ok).toBe(false);
  });

  it("a redelivered provider event cannot write a second effect", async () => {
    db.seed({ provider_message_id: "ses-dedupe" });
    const message = signedNotification(sesPayload("Delivery", "ses-dedupe"));
    const first = await processVerifiedSnsNotification(message, certPem, {
      query: db.query,
      env: {} as NodeJS.ProcessEnv,
    });
    const second = await processVerifiedSnsNotification(message, certPem, {
      query: db.query,
      env: {} as NodeJS.ProcessEnv,
    });
    expect(first.applied).toBe(true);
    expect(second).toMatchObject({ applied: false, reason: "duplicate_event" });
    expect(db.events.size).toBe(1);
  });
});

// Local helper: direct check of the cert-URL trust rule used by precheck.
function isTrustedCertCheck(message: SnsMessage): boolean {
  return /^https:\/\/sns\.[a-z0-9-]+\.amazonaws\.com\/SimpleNotificationService\/[0-9a-f]+\.pem$/.test(
    message.SigningCertURL || ""
  );
}

/* ── 9–11: verified delivery / bounce / complaint ────────────────────────── */

describe("SES events — verified state changes and suppression", () => {
  it("valid delivery event marks the row delivered", async () => {
    const row = db.seed({ provider_message_id: "ses-deliver" });
    const message = signedNotification(sesPayload("Delivery", "ses-deliver"));
    const event = parseSesEvent(message);
    expect(event).toMatchObject({ eventType: "delivery", messageId: "ses-deliver" });
    // No recipient address is carried in the parsed event.
    expect(JSON.stringify(event)).not.toMatch(/buyer@example\.test/);

    const result = await applyVerifiedSesEvent(event!, { query: db.query, env: {} as any });
    expect(result.applied).toBe(true);
    expect(result.deliveryStatus).toBe("delivered");
    expect(row.delivery_status).toBe("delivered");
    expect(row.status).toBe("delivered");
    expect(row.suppressed).toBe(false);
  });

  it("hard bounce marks bounced and suppresses by default", async () => {
    const row = db.seed({ provider_message_id: "ses-bounce" });
    const message = signedNotification(
      sesPayload("Bounce", "ses-bounce", { bounce: { bounceType: "Permanent" } })
    );
    const event = parseSesEvent(message)!;
    expect(shouldSuppressSesEvent(event, {} as any)).toEqual({ suppress: true, reason: "hard_bounce" });

    const result = await applyVerifiedSesEvent(event, { query: db.query, env: {} as any });
    expect(result.suppressed).toBe(true);
    expect(row.delivery_status).toBe("bounced");
    expect(row.status).toBe("bounced");
    expect(row.suppressed).toBe(true);
    expect(db.suppressions).toEqual([{ recipient: "buyer@example.test", reason: "hard_bounce" }]);
  });

  it("soft bounce does NOT suppress; complaint suppresses by default", async () => {
    const soft = parseSesEvent(
      signedNotification(sesPayload("Bounce", "ses-soft", { bounce: { bounceType: "Transient" } }))
    )!;
    expect(shouldSuppressSesEvent(soft, {} as any).suppress).toBe(false);

    const row = db.seed({ provider_message_id: "ses-complaint" });
    const complaint = parseSesEvent(
      signedNotification(sesPayload("Complaint", "ses-complaint"))
    )!;
    expect(shouldSuppressSesEvent(complaint, {} as any)).toEqual({ suppress: true, reason: "complaint" });

    const result = await applyVerifiedSesEvent(complaint, { query: db.query, env: {} as any });
    expect(result.suppressed).toBe(true);
    expect(row.delivery_status).toBe("complained");
    // `status` keeps its legacy CHECK vocabulary — only delivered/bounced are mapped.
    expect(row.status).toBe("failed");
    expect(db.suppressions).toEqual([{ recipient: "buyer@example.test", reason: "complaint" }]);
  });

  it("owner flags can disable the default suppression policy", () => {
    const hard = parseSesEvent(
      signedNotification(sesPayload("Bounce", "ses-x", { bounce: { bounceType: "Permanent" } }))
    )!;
    const complaint = parseSesEvent(signedNotification(sesPayload("Complaint", "ses-y")))!;
    const env = {
      SES_SUPPRESS_ON_BOUNCE: "false",
      SES_SUPPRESS_ON_COMPLAINT: "false",
    } as unknown as NodeJS.ProcessEnv;
    expect(shouldSuppressSesEvent(hard, env).suppress).toBe(false);
    expect(shouldSuppressSesEvent(complaint, env).suppress).toBe(false);
  });
});

/* ── Static wiring checks (no weakened existing assertions) ──────────────── */

describe("wiring — migration, webhook and backend send path", () => {
  const migration = () =>
    readFileSync(join(__dirname, "../db/migrations/005_notification_retry.sql"), "utf8");
  const route = () =>
    readFileSync(join(__dirname, "../app/api/webhooks/ses/route.ts"), "utf8");
  const service = () =>
    readFileSync(
      join(__dirname, "../../backend/src/modules/notification/service.ts"),
      "utf8"
    );

  it("migration 005 is additive and idempotent with forward recovery", () => {
    const sql = migration();
    for (const token of [
      "ADD COLUMN IF NOT EXISTS",
      '"attempts"',
      '"next_attempt_at"',
      '"delivery_status"',
      '"lease_until"',
      "CREATE TABLE IF NOT EXISTS",
      '"notification_event"',
      '"notification_suppression"',
      "UNIQUE",
      "Forward recovery",
    ]) {
      expect(sql).toContain(token);
    }
    expect(sql).not.toMatch(/\bDROP COLUMN\b/i);
    expect(sql).not.toMatch(/\bDELETE FROM\b/i);
  });

  it("webhook verifies the signature before applying any event", () => {
    const src = route();
    // The route prechecks the envelope, then delegates verification+apply to a
    // helper that verifies BEFORE it writes anything.
    expect(src).toMatch(/processVerifiedSnsNotification/);
    expect(src.indexOf("precheckSnsMessage")).toBeLessThan(src.indexOf("processVerifiedSnsNotification"));
    expect(src).toMatch(/SES_SNS_TOPIC_ARN/);
    expect(src).toMatch(/getSnsCertificate/);

    const lib = readFileSync(join(__dirname, "../lib/notifications.ts"), "utf8");
    const helper = lib.slice(lib.indexOf("export async function processVerifiedSnsNotification"));
    expect(helper).toMatch(/verifySnsSignature/);
    expect(helper.indexOf("verifySnsSignature")).toBeLessThan(helper.indexOf("applyVerifiedSesEvent"));
  });

  it("backend send path records attempts/delivery_status and never logs the recipient", () => {
    const src = service();
    expect(src).toMatch(/planNotificationFailure/);
    expect(src).toMatch(/delivery_status/);
    expect(src).toMatch(/recipient withheld/);
  });
});
