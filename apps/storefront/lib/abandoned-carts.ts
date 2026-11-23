/**
 * Unfinished checkouts.
 *
 * On a shop where every work is one of one, someone who filled a cart and left
 * is not a browsing visitor: the piece they chose is still available, and they
 * may have been interrupted rather than dissuaded. A single, quiet reminder is
 * the most useful thing the shop can do — and only one, because a reminder
 * repeated is a nag.
 *
 * The rules live here rather than in a cron:
 *   - a cart counts as abandoned after ABANDONED_CART_HOURS (default 6) of no
 *     activity, has an email, has at least one line, and never became an order;
 *   - a cart is reminded at most once, ever (`cart_reminders` has one row per
 *     cart). Re-running the list is therefore safe.
 *
 * Sending still depends on a configured mail transport. When none is set the
 * backend records the message as `skipped`; that is stored and shown as such,
 * because "reminded" and "queued an email nobody sent" are different facts.
 */

import { query, queryResult } from "@/lib/db";

export function abandonedAfterHours(): number {
  const raw = Number((process.env.ABANDONED_CART_HOURS ?? "").trim() || "");
  if (!Number.isFinite(raw) || raw <= 0) return 6;
  return Math.round(raw);
}

/**
 * Pure, so the "what counts as abandoned" decision can be tested without a
 * database and read by anyone wondering why a cart did or did not appear.
 */
export function isAbandoned(params: {
  ageHours: number;
  minHours?: number;
  email: string | null;
  itemCount: number;
  completed: boolean;
}): boolean {
  const minHours = params.minHours ?? abandonedAfterHours();
  if (params.completed) return false;
  if (!params.email || !params.email.trim()) return false;
  if (params.itemCount <= 0) return false;
  return params.ageHours >= minHours;
}

export interface AbandonedCartItem {
  title: string;
  quantity: number;
  unit_price: number;
}

export interface AbandonedCart {
  id: string;
  email: string | null;
  currency_code: string;
  updated_at: string;
  items: AbandonedCartItem[];
  subtotal: number;
  reminded_at: string | null;
  reminder_status: string | null;
}

export async function listAbandonedCarts(
  options: { minHours?: number; limit?: number } = {}
): Promise<AbandonedCart[]> {
  const minHours = options.minHours ?? abandonedAfterHours();
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 200);

  // Reads Medusa's own cart tables rather than a copy: a cart that converted is
  // marked `completed_at`, and `order_cart` links the ones that became orders.
  // Both are excluded so a paid order is never "reminded".
  const result = await queryResult<{
    id: string;
    email: string | null;
    currency_code: string;
    updated_at: string;
    items: AbandonedCartItem[];
    reminded_at: string | null;
    reminder_status: string | null;
  }>(
    `SELECT c.id,
            c.email,
            c.currency_code,
            c.updated_at,
            COALESCE(
              json_agg(
                json_build_object(
                  'title', COALESCE(li.product_title, li.title, 'A work'),
                  'quantity', li.quantity,
                  'unit_price', li.unit_price
                )
              ) FILTER (WHERE li.id IS NOT NULL),
              '[]'::json
            ) AS items,
            r.sent_at AS reminded_at,
            r.status  AS reminder_status
       FROM cart c
       JOIN cart_line_item li
         ON li.cart_id = c.id AND li.deleted_at IS NULL
       LEFT JOIN cart_reminders r ON r.cart_id = c.id
      WHERE c.deleted_at IS NULL
        AND c.completed_at IS NULL
        AND c.email IS NOT NULL
        AND c.email <> ''
        AND c.updated_at < now() - make_interval(hours => $1)
        AND NOT EXISTS (SELECT 1 FROM order_cart oc WHERE oc.cart_id = c.id)
        -- A cart holding a work that has since sold is not unfinished business,
        -- it is a wish: "the piece you chose is still here" would be false, and
        -- one-of-one means there is nothing to come back for.
        AND NOT EXISTS (
          SELECT 1
            FROM order_line_item oli
            JOIN order_item oi ON oi.item_id = oli.id AND oi.deleted_at IS NULL
            JOIN "order" o ON o.id = oi.order_id AND o.deleted_at IS NULL
           WHERE oli.deleted_at IS NULL
             AND o.status NOT IN ('canceled')
             AND oli.variant_id = li.variant_id
        )
      GROUP BY c.id, c.email, c.currency_code, c.updated_at, r.sent_at, r.status
      ORDER BY c.updated_at DESC
      LIMIT $2`,
    [minHours, limit]
  );

  return result.rows.map((row) => ({
    ...row,
    items: Array.isArray(row.items) ? row.items : [],
    subtotal: (Array.isArray(row.items) ? row.items : []).reduce(
      (sum, item) => sum + Number(item.unit_price ?? 0) * Number(item.quantity ?? 0),
      0
    ),
  }));
}

/**
 * The data a reminder email needs. Kept separate from the send so the same
 * shape can be rendered in a test and eyeballed without a transport.
 */
export function reminderPayload(cart: AbandonedCart) {
  return {
    cart_id: cart.id,
    email: cart.email,
    currency: cart.currency_code,
    subtotal: cart.subtotal,
    items: cart.items.map((item) => ({
      title: item.title,
      quantity: item.quantity,
      total: Number(item.unit_price ?? 0) * Number(item.quantity ?? 0),
    })),
  };
}

export type ReminderStatus = "sent" | "skipped" | "failed";

export async function recordReminder(
  cartId: string,
  status: ReminderStatus
): Promise<void> {
  await query(
    `INSERT INTO cart_reminders (cart_id, status, sent_at)
     VALUES ($1,$2,now())
     ON CONFLICT (cart_id) DO UPDATE SET status=EXCLUDED.status, sent_at=now()`,
    [cartId, status]
  );
}

export async function sendCartReminder(
  cart: AbandonedCart
): Promise<{ status: ReminderStatus; detail?: string }> {
  if (!cart.email) return { status: "failed", detail: "No email on the cart." };

  const backendUrl = (
    process.env.MEDUSA_BACKEND_URL ||
    process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ||
    "http://localhost:9000"
  ).replace(/\/+$/, "");
  const publishableKey =
    process.env.MEDUSA_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY ||
    "";

  let status: ReminderStatus = "failed";
  let detail: string | undefined;
  try {
    const res = await fetch(`${backendUrl}/store/notifications/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-publishable-api-key": publishableKey,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
      body: JSON.stringify({
        to: cart.email,
        template: "cart_reminder",
        data: reminderPayload(cart),
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      detail = `${res.status} ${body}`.slice(0, 300);
      console.error(`[cart-reminder] request failed: ${detail}`);
    } else {
      const result = await res.json();
      // The backend reports `skipped` when no mail transport is configured. It
      // is recorded as `skipped`, never as `sent`: an unsent email that looks
      // sent is how a queue quietly rots.
      status = result.status === "sent" ? "sent" : "skipped";
      detail = result.reason ?? result.error;
    }
  } catch (error) {
    detail = error instanceof Error ? error.message : "Request failed";
    console.error("[cart-reminder] could not reach the notification service", error);
  }

  await recordReminder(cart.id, status);
  return { status, detail };
}
