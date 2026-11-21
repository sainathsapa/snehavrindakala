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
      return "Not sent: no mail transport is configured. Set FROM_EMAIL and the AWS_SES_* credentials, then this message would have gone out.";
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
