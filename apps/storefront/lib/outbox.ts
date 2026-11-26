/**
 * The outbox: everything the shop tried to send and did not.
 *
 * Every letter this shop writes goes through one notification path — the
 * backend's notification module — and that module records a row with the
 * outcome. When no mail transport is configured the row is `skipped`; when the
 * transport rejects a message it is `failed`. Both are honest records of a
 * message a customer never received.
 *
 * The problem was where those records went: nowhere an operator looks. Order
 * confirmations, quote letters and cart reminders were marked `skipped`, the
 * admin screens showed "ready" configuration, and the only way to discover that
 * a customer had been told nothing was to query Postgres by hand.
 *
 * So this lists them, together with the reason and a link to the thing they are
 * about. It is deliberately read-only: the point is to make an invisible failure
 * visible, not to add a resend button that would fail for the same reason.
 */

import { query } from "@/lib/db";

export type OutboxReason = "no-transport" | "transport-error" | "unknown";

export interface OutboxEntry {
  id: string;
  source: "notification" | "cart-reminder";
  /** Who was going to receive it. Never rendered in full on the list page. */
  to: string | null;
  /** What it was: a template name, or "cart reminder". */
  what: string;
  status: string;
  reason: OutboxReason;
  /** Plain sentence explaining the outcome, for the admin list. */
  detail: string;
  createdAt: string | null;
  /** Internal admin link, when one makes sense. */
  link: string | null;
}

/**
 * Why a message was not delivered.
 *
 * `skipped` means the pipeline ran and deliberately stopped because there is no
 * transport (SES unset). `failed` means a transport exists and refused the
 * message. Both are different from `pending`, which is still moving and should
 * not be called undelivered yet.
 */
export function reasonFor(status: string): OutboxReason {
  if (status === "skipped") return "no-transport";
  if (status === "failed") return "transport-error";
  return "unknown";
}

export function detailFor(reason: OutboxReason): string {
  switch (reason) {
    case "no-transport":
      return "Not sent: no mail transport is configured. Set FROM_EMAIL and RESEND_API_KEY, then this message would have gone out.";
    case "transport-error":
      return "Not sent: the transport rejected it. The address may be wrong, or SES may be sandboxed or throttled.";
    default:
      return "Not sent, for a reason the record does not explain.";
  }
}

/**
 * A link back to the thing the message was about, so an operator can write to
 * the customer by hand. Order ids come from the notification's resource id.
 */
export function linkFor(params: {
  source: OutboxEntry["source"];
  resourceType?: string | null;
  resourceId?: string | null;
}): string | null {
  if (params.source === "cart-reminder") return "/admin/carts";
  if (params.resourceType === "order" && params.resourceId) {
    return `/admin/orders/${params.resourceId}`;
  }
  return null;
}

/**
 * Statuses that mean "this message is not delivered and will not deliver
 * itself". `pending` is excluded on purpose: it is still in flight.
 */
export const UNDELIVERED_STATUSES = ["skipped", "failed"] as const;

export async function listUndelivered(limit = 100): Promise<OutboxEntry[]> {
  const entries: OutboxEntry[] = [];

  // Medusa's notification table. It lives in the same database, so this is a
  // read, not an API call — and it cannot go stale behind a cache.
  try {
    // The shop's own table, not Medusa's `notification`: the notification module
    // keeps its records in `app_notification` (a module may not own a table
    // Medusa itself models) and carries the error message with them.
    const notifications = await query<{
      id: string;
      recipient: string | null;
      template: string | null;
      status: string;
      created_at: string;
      error_message: string | null;
      data: unknown;
    }>(
      `SELECT n.id, n.recipient, n.template, n.status, n.created_at,
              n.error_message, n.data
         FROM app_notification n
        WHERE n.status = ANY($1)
          AND n.deleted_at IS NULL
        ORDER BY n.created_at DESC
        LIMIT $2`,
      [UNDELIVERED_STATUSES, limit]
    ).catch(() => []);

    for (const row of notifications) {
      const reason = reasonFor(row.status);
      // The resource the message was about is carried inside the template data
      // (order id, quote id), not in dedicated columns.
      const data = (row.data || {}) as Record<string, any>;
      const orderId =
        data?.order?.id || data?.orderId || data?.order_id || null;
      entries.push({
        id: row.id,
        source: "notification",
        to: row.recipient,
        what: row.template || "message",
        status: row.status,
        reason,
        // A transport error names itself; a skipped message does not.
        detail:
          reason === "transport-error" && row.error_message
            ? `${detailFor(reason)} (${row.error_message})`
            : detailFor(reason),
        createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
        link: linkFor({
          source: "notification",
          resourceType: orderId ? "order" : null,
          resourceId: orderId,
        }),
      });
    }
  } catch {
    // A missing table must not break the admin page; the cart reminders below
    // still appear.
  }

  // Cart reminders keep their own record, because they are written by the
  // storefront rather than by the notification module.
  try {
    const reminders = await query<{
      cart_id: string;
      status: string;
      sent_at: string;
    }>(
      `SELECT cart_id, status, sent_at
         FROM cart_reminders
        WHERE status = ANY($1)
        ORDER BY sent_at DESC
        LIMIT $2`,
      [UNDELIVERED_STATUSES, limit]
    ).catch(() => []);

    for (const row of reminders) {
      const reason = reasonFor(row.status);
      entries.push({
        id: `cart:${row.cart_id}`,
        source: "cart-reminder",
        to: null,
        what: "cart reminder",
        status: row.status,
        reason,
        detail: detailFor(reason),
        createdAt: row.sent_at ? new Date(row.sent_at).toISOString() : null,
        link: linkFor({ source: "cart-reminder" }),
      });
    }
  } catch {
    // Same rule as above.
  }

  return entries
    .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""))
    .slice(0, limit);
}

/**
 * Whether "nothing in the outbox" can be read as good news.
 *
 * It cannot, when there is no transport: an empty outbox means nothing has been
 * attempted since the record began, or everything attempted was recorded
 * elsewhere. The page says which of the two it is instead of showing a cheerful
 * zero.
 */
export function emptyOutboxMeans(status: { transportReady: boolean }): string {
  return status.transportReady
    ? "Nothing is waiting. Every message recorded so far reached a transport."
    : "Nothing recorded as undelivered — but no mail transport is configured, so a message sent from here is recorded as skipped only once it is attempted. This page existing is not proof that mail is working.";
}

export async function countUndelivered(): Promise<number> {
  try {
    const rows = await query<{ count: string }>(
      `SELECT (
         (SELECT count(*) FROM app_notification
           WHERE status = ANY($1) AND deleted_at IS NULL) +
         (SELECT count(*) FROM cart_reminders WHERE status = ANY($1))
       )::text AS count`,
      [UNDELIVERED_STATUSES]
    );
    return Number(rows[0]?.count || 0);
  } catch {
    return 0;
  }
}

/* ── NOT-02: retry / delivery status ─────────────────────────────────────── */

/**
 * Statuses assigned by a delivery event rather than by the send call itself.
 *
 * BLOCKER: no SES webhook (configuration-set event destination) is wired up,
 * so nothing at present writes `delivered` or `bounced`. They are declared here
 * so an operator's dashboard and a future webhook agree on the vocabulary, and
 * so nobody mistakes a `sent` row for a confirmed delivery.
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

/** Only a message that will not deliver itself may be retried manually. */
export function canRetry(status: string): boolean {
  return (UNDELIVERED_STATUSES as readonly string[]).includes(status);
}

/**
 * Pure state transition for one retry attempt. Kept separate from I/O so the
 * rules can be tested without a database or a mail transport.
 */
export function retryTransition(outcome: {
  status: string;
  error?: string | null;
  provider_message_id?: string | null;
}): {
  status: string;
  error_message: string | null;
  provider_message_id: string | null;
  ok: boolean;
} {
  if (outcome.status === "sent" || outcome.status === "delivered") {
    return {
      status: NOTIFICATION_STATUS.SENT,
      error_message: null,
      provider_message_id: outcome.provider_message_id ?? null,
      ok: true,
    };
  }
  if (outcome.status === "skipped") {
    return {
      status: NOTIFICATION_STATUS.SKIPPED,
      error_message: null,
      provider_message_id: outcome.provider_message_id ?? null,
      ok: false,
    };
  }
  return {
    status: NOTIFICATION_STATUS.FAILED,
    error_message: outcome.error || "Retry failed without an error message",
    provider_message_id: outcome.provider_message_id ?? null,
    ok: false,
  };
}

export interface RetrySendPayload {
  to: string;
  template: string;
  data: Record<string, any>;
}

export interface RetrySendResult {
  id: string;
  status: string;
  error?: string | null;
}

/** Dependencies are injectable so the retry can be tested without I/O. */
export interface RetryDeps {
  query?: <T extends Record<string, any> = any>(
    sql: string,
    params?: any[]
  ) => Promise<T[]>;
  send?: (payload: RetrySendPayload) => Promise<RetrySendResult>;
}

export interface RetryOutcome {
  id: string;
  ok: boolean;
  status: string;
  detail: string;
  provider_message_id?: string | null;
}

/**
 * Ask the backend notification module to re-send one undelivered message.
 *
 * We intentionally do not mark the row sent locally and hope: the send goes
 * through the same backend path as the original (same templates, same SES
 * transport), under a fresh retry key so NOT-01's idempotency guard does not
 * treat it as a duplicate. The original row is then updated with the real
 * outcome, including the provider message id when SES supplied one.
 *
 * Limitation: the backend's store send endpoint only accepts
 * `order_confirmation` and `cart_reminder`. Other templates are recorded as a
 * failed retry with that reason rather than being silently reported as sent.
 */
async function sendRetryViaBackend(
  payload: RetrySendPayload
): Promise<RetrySendResult> {
  const backendUrl = (
    process.env.MEDUSA_BACKEND_URL ||
    process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ||
    "http://localhost:9000"
  ).replace(/\/+$/, "");
  const publishableKey =
    process.env.MEDUSA_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY ||
    "";

  const res = await fetch(`${backendUrl}/store/notifications/send`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-publishable-api-key": publishableKey,
    },
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
    body: JSON.stringify(payload),
  });
  const text = await res.text().catch(() => "");
  if (!res.ok) {
    throw new Error(`Notification service returned ${res.status}: ${text.slice(0, 300)}`);
  }
  return JSON.parse(text || "{}") as RetrySendResult;
}

export async function retryUndeliveredNotification(
  id: string,
  deps: RetryDeps = {}
): Promise<RetryOutcome> {
  const db = (deps.query || (query as any)) as NonNullable<RetryDeps["query"]>;
  const send = deps.send || sendRetryViaBackend;

  const rows = await db<{
    id: string;
    recipient: string | null;
    template: string;
    data: unknown;
    status: string;
    event_key: string | null;
  }>(
    `SELECT id, recipient, template, data, status, event_key
       FROM app_notification
      WHERE id = $1 AND deleted_at IS NULL
      LIMIT 1`,
    [id]
  );
  const original = rows[0];
  if (!original) throw new Error("Notification not found");

  if (!canRetry(original.status)) {
    return {
      id,
      ok: false,
      status: original.status,
      detail: `Not retried: status is "${original.status}", which is not an undelivered state.`,
    };
  }

  const mark = async (
    transition: ReturnType<typeof retryTransition>
  ): Promise<void> => {
    await db(
      `UPDATE app_notification
          SET status = $1, error_message = $2,
              provider_message_id = $3, updated_at = now()
        WHERE id = $4`,
      [
        transition.status,
        transition.error_message,
        transition.provider_message_id,
        id,
      ]
    );
  };

  if (!original.recipient) {
    const transition = retryTransition({
      status: "failed",
      error: "The original notification has no recipient address",
    });
    await mark(transition);
    return {
      id,
      ok: false,
      status: transition.status,
      detail: transition.error_message || "Retry failed",
    };
  }

  const data = (original.data || {}) as Record<string, any>;
  const base = original.event_key || `${original.template}:${original.id}`;
  // One minute-scale token plus a random suffix: a retry is a new event, so it
  // must not be swallowed by the dedupe key of the send it is replacing.
  const retryKey = `${base}:retry:${Date.now()}:${Math.random()
    .toString(36)
    .slice(2, 8)}`;

  try {
    const result = await send({
      to: original.recipient,
      template: original.template,
      data: { ...data, eventKey: retryKey },
    });

    const sentRows = await db<{
      status: string;
      provider_message_id: string | null;
      error_message: string | null;
    }>(
      `SELECT status, provider_message_id, error_message
         FROM app_notification WHERE id = $1 LIMIT 1`,
      [result.id]
    );
    const sent = sentRows[0] || ({} as any);
    const transition = retryTransition({
      status: result.status || sent.status || "failed",
      error: result.error || sent.error_message,
      provider_message_id: sent.provider_message_id ?? null,
    });
    await mark(transition);
    return {
      id,
      ok: transition.ok,
      status: transition.status,
      detail: transition.ok
        ? `Retried and handed to the transport${
            transition.provider_message_id
              ? ` (provider id ${transition.provider_message_id})`
              : ""
          }.`
        : `Retry did not deliver (${transition.status})${
            transition.error_message ? `: ${transition.error_message}` : "."
          }`,
      provider_message_id: transition.provider_message_id,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const transition = retryTransition({ status: "failed", error: message });
    // The failure is the useful record; losing it would put the row straight
    // back into the queue with no explanation.
    await mark(transition).catch(() => {});
    return {
      id,
      ok: false,
      status: transition.status,
      detail: `Retry failed: ${message}`,
    };
  }
}
