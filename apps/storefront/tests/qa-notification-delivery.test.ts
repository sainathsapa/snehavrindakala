/**
 * QA — notification real-delivery readiness (honest verification).
 *
 * This file does NOT prove that any email was delivered. It verifies, with
 * pure functions and static source assertions only, which delivery *mechanisms*
 * actually exist in the code and which do not. No SES call, no network, no DB,
 * no credentials are used here.
 *
 * What is asserted here is a CODE-LEVEL READINESS check. Real delivery still
 * needs a verified SES sender plus a controlled test recipient, both of which
 * are owner-gated and currently UNCONFIGURED (see
 * docs/release/QA_NOTIFICATIONS_REPORT.md). A `sent` status is "handed to the
 * transport", NOT proof that a customer received anything.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

// No DB connection: these tests exercise pure logic + source text only.
vi.mock("@/lib/db", () => ({ query: vi.fn(async () => []) }));

import {
  NOTIFICATION_STATUS,
  DELIVERY_CONFIRMATION_STATUSES,
  UNDELIVERED_STATUSES,
  canRetry,
  detailFor,
  emptyOutboxMeans,
  reasonFor,
  retryTransition,
} from "@/lib/outbox";
import {
  RECONCILIATION_MAX_ATTEMPTS,
  backoffDelayMs,
} from "@/lib/payments/reconciliation";

const backendSrc = (relative: string): string =>
  readFileSync(
    join(__dirname, "../../backend/src/modules/notification", relative),
    "utf8"
  );

const transportSrc = () => backendSrc("transport.ts");
const serviceSrc = () => backendSrc("service.ts");
const entitySrc = () => backendSrc("entities/notification.ts");
const migrationSrc = () =>
  backendSrc("migrations/20261105000016-add-event-key-to-app-notification.ts");
const outboxSrc = () =>
  readFileSync(join(__dirname, "../lib/outbox.ts"), "utf8");

/* ── 1. Status transitions: queued(pending) → sent / skipped / failed ────── */

describe("outbox status vocabulary and transitions", () => {
  it("uses 'pending' as the queued state, not a cheerful 'ready'", () => {
    expect(NOTIFICATION_STATUS.PENDING).toBe("pending");
    expect(NOTIFICATION_STATUS.SENT).toBe("sent");
    expect(NOTIFICATION_STATUS.SKIPPED).toBe("skipped");
    expect(NOTIFICATION_STATUS.FAILED).toBe("failed");
    // The entity seeds a new row in the queued/pending state.
    expect(entitySrc()).toMatch(/\.default\("pending"\)/);
    expect(serviceSrc()).toMatch(/status:\s*"pending"/);
  });

  it("maps every send outcome to a real terminal status — never a false 'sent'", () => {
    // sent, skipped and failed are the three possible hand-off outcomes.
    const sent = retryTransition({ status: "sent", provider_message_id: "ses-1" });
    const skipped = retryTransition({ status: "skipped" });
    const failed = retryTransition({ status: "failed", error: "SES throttled" });

    expect(sent.status).toBe(NOTIFICATION_STATUS.SENT);
    expect(skipped.status).toBe(NOTIFICATION_STATUS.SKIPPED);
    expect(failed.status).toBe(NOTIFICATION_STATUS.FAILED);

    // The backend applies the same mapping.
    expect(serviceSrc()).toMatch(
      /status:\s*receipt\.status === "sent" \? "sent" : "skipped"/
    );
    expect(serviceSrc()).toMatch(/status:\s*"failed"/);
  });

  it("only treats skipped/failed as undelivered; pending stays in flight", () => {
    expect(Array.from(UNDELIVERED_STATUSES)).toEqual(["skipped", "failed"]);
    expect(canRetry("skipped")).toBe(true);
    expect(canRetry("failed")).toBe(true);
    expect(canRetry("sent")).toBe(false);
    expect(canRetry("pending")).toBe(false);
  });
});

/* ── 2. Missing SES sender config → skipped with a clear reason ─────────── */

describe("missing SES configuration is honest", () => {
  it("reports 'no-transport' for skipped with a plain-language reason", () => {
    expect(reasonFor("skipped")).toBe("no-transport");
    const detail = detailFor("no-transport");
    expect(detail).toMatch(/no mail transport is configured/i);
    expect(detail).toMatch(/FROM_EMAIL/i);
    // A skipped retry is NOT reported as sent.
    const skipped = retryTransition({ status: "skipped" });
    expect(skipped.ok).toBe(false);
    expect(skipped.status).toBe("skipped");
  });

  it("an empty outbox is not presented as good news when unconfigured", () => {
    const message = emptyOutboxMeans({ transportReady: false });
    expect(message).toMatch(/no mail transport is configured/i);
    expect(message).toMatch(/not proof that mail is working/i);
  });

  it("transport skips (never sends) when the sender or key is absent", () => {
    const src = transportSrc();
    // FROM_EMAIL is the verified sender; null config means unconfigured.
    expect(src).toMatch(/if \(!resendKey \|\| !fromEmail \|\| !isValidEmail\(fromEmail\)\) return null;/);
    // No config at all => a logged preview, status skipped, no provider id.
    expect(src).toMatch(/if \(!config\) \{/);
    expect(src).toMatch(/return \{ status: "skipped", messageId: null \};/);
    // Resend is the only transport, and carries its own provider id.
    expect(src).toMatch(/provider: "resend"/);
    expect(src).toMatch(/return \{ status: "sent", messageId: body\?\.id \|\| null \};/);
    // SES is gone for good: no AWS SDK, no credentials branch.
    expect(src).not.toMatch(/client-sesv2|SESv2Client|AWS_SES/);
  });

  it("a skipped transport outcome is stored as 'skipped', never 'sent'", () => {
    // The service maps any non-"sent" receipt to skipped.
    expect(serviceSrc()).toMatch(
      /status:\s*receipt\.status === "sent" \? "sent" : "skipped"/
    );
  });
});

/* ── 3. Dedupe by event_key prevents two sends ───────────────────────────── */

describe("event_key dedupe", () => {
  it("a UNIQUE index and ON CONFLICT DO NOTHING arbitrate the claim", () => {
    const migration = migrationSrc();
    expect(migration).toMatch(/CREATE UNIQUE INDEX/i);
    expect(migration).toMatch(/"event_key"/);

    const src = serviceSrc();
    expect(src).toMatch(/\.onConflict\("event_key"\)/);
    expect(src).toMatch(/\.ignore\(\)/);
    // A losing claim returns the existing row: no second render, no second SES call.
    expect(src).toMatch(/if \(claim\.row && !claim\.claimed\)/);
    expect(src).toMatch(/return claim\.row;/);
  });

  it("derives a stable key from the order reference, with an explicit-key override", () => {
    const src = serviceSrc();
    expect(src).toMatch(/export function deriveEventKey\(/);
    expect(src).toMatch(/data\?\.order\?\.id/);
    expect(src).toMatch(/return `\$\{template\}:\$\{String\(ref\)\}`/);
  });
});

/* ── 4. Retry: attempts + backoff — HONEST GAP FINDING ───────────────────── */

describe("retry attempts and backoff — where they actually exist", () => {
  it("the payment-reconciliation retry increments attempts and respects backoff", () => {
    // This is the ONLY retry loop in the codebase with attempt counting and
    // exponential backoff. It is a pure function and is verified here directly.
    expect(RECONCILIATION_MAX_ATTEMPTS).toBe(5);
    expect(backoffDelayMs(0)).toBe(60_000);
    expect(backoffDelayMs(1)).toBe(120_000);
    expect(backoffDelayMs(2)).toBe(240_000);
    expect(backoffDelayMs(99)).toBe(3_600_000); // ceiling
  });

  it("GAP: notification delivery retry does NOT track attempts or backoff", () => {
    // Honest finding, pinned so it cannot change silently. The notification
    // retry is an operator-driven re-send under a FRESH event key; it has no
    // attempts counter and no next-attempt schedule. Do not read this as a pass.
    const src = outboxSrc();
    expect(src).not.toMatch(/next_attempt_at/i);
    expect(src).not.toMatch(/backoff/i);
    expect(src).not.toMatch(/attempts\s*\+\s*1/);
    // It deliberately mints a new retry key so NOT-01 dedupe won't swallow it.
    expect(src).toMatch(/:retry:\$\{Date\.now\(\)\}/);
    // The notification entity has no attempts/next-attempt column either.
    expect(entitySrc()).not.toMatch(/attempts/i);
  });
});

/* ── 5. Provider message id persisted on success ─────────────────────────── */

describe("provider message id persistence", () => {
  it("the pure transition keeps the SES MessageId on success", () => {
    const t = retryTransition({ status: "sent", provider_message_id: "ses-abc-123" });
    expect(t.ok).toBe(true);
    expect(t.provider_message_id).toBe("ses-abc-123");
    expect(t.error_message).toBeNull();
  });

  it("the backend writes the receipt MessageId into provider_message_id", () => {
    const src = serviceSrc();
    expect(src).toMatch(/provider_message_id:\s*outcome\.messageId \?\? null/);
    expect(src).toMatch(/row\.provider_message_id = outcome\.messageId \?\? null;/);
    expect(entitySrc()).toMatch(/provider_message_id:\s*model\.text\(\)\.nullable\(\)/);
  });

  it("a failed or skipped outcome never fabricates a MessageId", () => {
    expect(retryTransition({ status: "failed", error: "x" }).provider_message_id).toBeNull();
    expect(retryTransition({ status: "skipped" }).provider_message_id).toBeNull();
  });
});

/* ── 6. Delivery confirmation is declared-only (no webhook) ─────────────── */

describe("delivery confirmation vocabulary (not a delivery proof)", () => {
  it("declares delivered/bounced as written only by the verified webhook", () => {
    expect(DELIVERY_CONFIRMATION_STATUSES).toContain("delivered");
    expect(DELIVERY_CONFIRMATION_STATUSES).toContain("bounced");
    const src = transportSrc();
    // Delivery states are written by the verified Resend webhook, never by the
    // send path: `sent` is still not a delivery proof.
    expect(src).toMatch(/written only by the verified Resend webhook/);
    expect(src).toMatch(/never by this send/);
    expect(src).toMatch(/Do not read a `sent` row as proof of delivery/i);
  });
});
