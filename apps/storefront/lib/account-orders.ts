/**
 * Guest orders, seen from inside the account.
 *
 * Medusa lists "my orders" by `order.customer_id`. A buyer who checked out as a
 * guest has `customer_id: null`, so the account we create for them at the moment
 * of payment is real but empty — the one order they care about is invisible, and
 * the confirmation email becomes the only record they have.
 *
 * The supported repair inside Medusa is an order *transfer request*, which the
 * buyer must then accept. That is the wrong shape here: we already own the email
 * and the buyer has just proven they own the inbox by paying. So the account
 * reads a union instead — orders linked to the customer, plus orders that carry
 * the same address and belong to nobody yet — and nothing is written to Medusa's
 * tables.
 *
 * The matching is deliberately strict:
 *
 *  - an order only joins the list when its email equals the account email,
 *    case-insensitively, after trimming; a `+alias` is NOT treated as the same
 *    person, because that would let one address read another's orders;
 *  - only orders with no customer are considered, so a work bought by another
 *    registered account can never appear here;
 *  - the union is deduplicated by order id, because a backfilled order can be
 *    returned by both sides.
 */

import { listAdminOrders } from "@/lib/admin";

export interface AccountOrderLike {
  id: string;
  display_id?: number | null;
  email?: string | null;
  customer_id?: string | null;
  created_at?: string | null;
  total?: number | null;
  currency_code?: string | null;
  status?: string | null;
}

const normalise = (value: unknown): string => String(value ?? "").trim().toLowerCase();

function timeOf(order: AccountOrderLike): number {
  const time = Date.parse(String(order.created_at ?? ""));
  return Number.isNaN(time) ? 0 : time;
}

/**
 * Pure part of the union: safe to reason about, and easy to test.
 *
 * `linked` are the orders Medusa says belong to the customer. `guest` are orders
 * fetched by the admin API, each of which must earn its place here.
 */
export function mergeGuestOrders(
  linked: AccountOrderLike[],
  guest: AccountOrderLike[],
  email: string,
  limit = 20
): AccountOrderLike[] {
  const wanted = normalise(email);
  const seen = new Set<string>();
  const out: AccountOrderLike[] = [];

  for (const order of linked) {
    if (!order?.id || seen.has(order.id)) continue;
    seen.add(order.id);
    out.push(order);
  }

  for (const order of guest) {
    if (!wanted || !order?.id || seen.has(order.id)) continue;
    // Already owned by a registered customer — not ours to show.
    if (order.customer_id) continue;
    if (normalise(order.email) !== wanted) continue;
    seen.add(order.id);
    out.push(order);
  }

  return out.sort((a, b) => timeOf(b) - timeOf(a)).slice(0, limit);
}

/**
 * The address this account may read. Returns "" when Medusa gives us no email,
 * which makes `mergeGuestOrders` drop every guest order rather than fall open.
 */
export function accountEmailOf(customer: { email?: string | null } | null | undefined): string {
  return normalise(customer?.email);
}

const GUEST_LOOKUP_FIELDS =
  "id,display_id,email,customer_id,created_at,total,currency_code,status";

/**
 * Fetch the account's orders: the linked ones plus any guest orders under the
 * same address. Never throws — an account page that fails because the admin API
 * is down is worse than one that shows only the linked orders.
 */
export async function listAccountOrders(
  linked: AccountOrderLike[],
  email: string,
  limit = 20
): Promise<AccountOrderLike[]> {
  if (!normalise(email)) return mergeGuestOrders(linked, [], email, limit);

  let guest: AccountOrderLike[] = [];
  try {
    // `/admin/orders` accepts an `email` query param but ignores it, so the
    // filter happens here. The page is capped: this is a shop with tens of
    // orders, not a marketplace, and asking for everything would be worse.
    const result = await listAdminOrders({ limit: 200, offset: 0, fields: GUEST_LOOKUP_FIELDS });
    guest = (result.orders || []) as unknown as AccountOrderLike[];
  } catch (error) {
    console.warn("[account-orders] guest lookup failed:", (error as Error)?.message);
  }

  return mergeGuestOrders(linked, guest, email, limit);
}
