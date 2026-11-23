/**
 * NOT-02 — retrying one undelivered message.
 *
 * A retry must not lie: it only applies to rows that will not deliver
 * themselves, it records the real provider receipt when there is one, and a
 * failed retry stays failed with the reason attached.
 */

import { describe, expect, it, vi } from "vitest";
import {
  canRetry,
  retryTransition,
  retryUndeliveredNotification,
  type RetryDeps,
  type RetrySendResult,
} from "../lib/outbox";

function makeDb(original: any, sentRow: any = {}) {
  const calls: Array<{ sql: string; params: any[] }> = [];
  const query: NonNullable<RetryDeps["query"]> = async (sql, params = []) => {
    calls.push({ sql, params });
    if (sql.includes("SELECT id, recipient")) return [original] as any;
    if (sql.startsWith("SELECT status, provider_message_id")) {
      return [
        sentRow || {
          status: "sent",
          provider_message_id: "ses-receipt-1",
          error_message: null,
        },
      ] as any;
    }
    if (sql.includes("UPDATE app_notification")) {
      Object.assign(original, {
        status: params?.[0],
        error_message: params?.[1],
        provider_message_id: params?.[2],
      });
      return [] as any;
    }
    return [] as any;
  };
  return { query, calls, original };
}

const skippedRow = (): Record<string, any> => ({
  id: "n_1",
  recipient: "buyer@example.com",
  template: "order_confirmation",
  data: { order: { id: "order_1" } },
  status: "skipped",
  event_key: "order_confirmation:order_1",
  error_message: null,
});

describe("canRetry", () => {
  it("allows only statuses that will not deliver themselves", () => {
    expect(canRetry("skipped")).toBe(true);
    expect(canRetry("failed")).toBe(true);
    expect(canRetry("sent")).toBe(false);
    expect(canRetry("pending")).toBe(false);
    expect(canRetry("delivered")).toBe(false);
    expect(canRetry("bounced")).toBe(false);
  });
});

describe("retryTransition", () => {
  it("marks a send as sent and keeps the provider message id", () => {
    expect(
      retryTransition({ status: "sent", provider_message_id: "ses-1" })
    ).toEqual({
      status: "sent",
      error_message: null,
      provider_message_id: "ses-1",
      ok: true,
    });
  });

  it("keeps a skipped retry honest", () => {
    const t = retryTransition({ status: "skipped" });
    expect(t.ok).toBe(false);
    expect(t.status).toBe("skipped");
    expect(t.error_message).toBeNull();
  });

  it("keeps a failed retry failed with its reason", () => {
    const t = retryTransition({ status: "failed", error: "SES throttled" });
    expect(t.ok).toBe(false);
    expect(t.status).toBe("failed");
    expect(t.error_message).toBe("SES throttled");
  });

  it("never reports an unexplained failure", () => {
    expect(retryTransition({ status: "failed" }).error_message).toMatch(
      /without an error message/
    );
  });
});

describe("retryUndeliveredNotification", () => {
  it("re-sends a skipped row and records sent plus the SES message id", async () => {
    const original = skippedRow();
    const { query, calls } = makeDb(original, {
      status: "sent",
      provider_message_id: "ses-receipt-9",
      error_message: null,
    });
    let payload: any = null;
    const send = vi.fn(async (p: any) => {
      payload = p;
      return { id: "new_1", status: "sent" } as RetrySendResult;
    });

    const result = await retryUndeliveredNotification("n_1", { query, send });

    expect(result.ok).toBe(true);
    expect(result.status).toBe("sent");
    expect(result.provider_message_id).toBe("ses-receipt-9");
    expect(original.status).toBe("sent");
    expect(original.provider_message_id).toBe("ses-receipt-9");
    expect(send).toHaveBeenCalledTimes(1);
    expect(payload.to).toBe("buyer@example.com");
    expect(payload.template).toBe("order_confirmation");
    // A retry needs a fresh key, or NOT-01 would treat it as a duplicate.
    expect(payload.data.eventKey).toMatch(
      /^order_confirmation:order_1:retry:\d+:[a-z0-9]+$/
    );
    expect(calls.some((c) => c.sql.includes("UPDATE app_notification"))).toBe(
      true
    );
  });

  it("refuses to retry a row that is not undelivered", async () => {
    const original = { ...skippedRow(), status: "sent" };
    const { query } = makeDb(original);
    const send = vi.fn(async () => ({ id: "x", status: "sent" }));

    const result = await retryUndeliveredNotification("n_1", { query, send });

    expect(result.ok).toBe(false);
    expect(result.detail).toMatch(/not an undelivered state/);
    expect(send).not.toHaveBeenCalled();
  });

  it("throws when the row does not exist", async () => {
    const { query } = makeDb(null);
    await expect(
      retryUndeliveredNotification("missing", {
        query,
        send: async () => ({ id: "x", status: "sent" }),
      })
    ).rejects.toThrow(/not found/i);
  });

  it("records a transport exception as a failed retry with its reason", async () => {
    const original = skippedRow();
    const { query } = makeDb(original);
    const send = vi.fn(async () => {
      throw new Error("Notification service returned 400");
    });

    const result = await retryUndeliveredNotification("n_1", { query, send });

    expect(result.ok).toBe(false);
    expect(result.status).toBe("failed");
    expect(result.detail).toContain("Notification service returned 400");
    expect(original.status).toBe("failed");
    expect(original.error_message).toContain("Notification service returned 400");
  });

  it("does not promote a skipped retry to sent", async () => {
    const original = skippedRow();
    const { query } = makeDb(original, {
      status: "skipped",
      provider_message_id: null,
      error_message: null,
    });
    const send = vi.fn(async () => ({ id: "new_2", status: "skipped" }));

    const result = await retryUndeliveredNotification("n_1", { query, send });

    expect(result.ok).toBe(false);
    expect(result.status).toBe("skipped");
    expect(original.status).toBe("skipped");
  });

  it("fails honestly when the original has no recipient", async () => {
    const original: Record<string, any> = { ...skippedRow(), recipient: null };
    const { query } = makeDb(original);
    const send = vi.fn(async () => ({ id: "x", status: "sent" }));

    const result = await retryUndeliveredNotification("n_1", { query, send });

    expect(result.ok).toBe(false);
    expect(result.status).toBe("failed");
    expect(original.error_message).toMatch(/no recipient/);
    expect(send).not.toHaveBeenCalled();
  });
});
