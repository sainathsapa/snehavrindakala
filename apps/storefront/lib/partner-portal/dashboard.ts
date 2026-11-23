/**
 * Pure aggregation for the partner overview dashboard.
 *
 * This module takes only plain arrays — the rows returned by the tenant-scoped
 * helpers in `@/lib/partner/repository` — and contains no DB, cookies or request
 * context. That keeps the overview maths testable in isolation and makes it
 * impossible to accidentally reach platform (admin) data from here.
 */

export const ACTIVE_FULFILMENT_STATUSES = [
  "assigned",
  "accepted",
  "packing",
  "ready_for_dispatch",
  "dispatched",
] as const;

export interface DashboardCounts {
  /** Fulfilment groups that are not yet delivered/cancelled/rejected. */
  activeOrders: number;
  /** Rows in the partner's own product catalogue. */
  products: number;
  /** Net payable amount (currency units, 2 dp) on unsettled ledger entries. */
  pendingEarnings: number;
  /** Number of unsettled ledger entries behind `pendingEarnings`. */
  pendingEarningsEntries: number;
}

export interface RecentOrder {
  id: string;
  customerOrderId: string;
  status: string;
  itemCount: number;
  createdAt: string | null;
}

export interface PartnerDashboardData {
  counts: DashboardCounts;
  recentOrders: RecentOrder[];
}

type Row = Record<string, any>;

export function isActiveFulfilmentStatus(status: unknown): boolean {
  return (
    typeof status === "string" &&
    (ACTIVE_FULFILMENT_STATUSES as readonly string[]).includes(status)
  );
}

export function countActiveOrders(groups: Row[]): number {
  return groups.filter((group) => isActiveFulfilmentStatus(group?.status)).length;
}

export function countProducts(products: Row[]): number {
  return Array.isArray(products) ? products.length : 0;
}

/** Postgres `numeric` often arrives as a string — accept both forms. */
function toNumber(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

/**
 * Pending = ledger rows not yet attached to a settlement batch. `payable_amount`
 * is signed, so refund reversals/adjustments correctly reduce the net figure.
 */
export function sumPendingEarnings(
  earnings: Row[]
): { amount: number; entries: number } {
  let total = 0;
  let entries = 0;
  for (const entry of earnings ?? []) {
    const batch = entry?.settlement_batch_id;
    if (batch !== null && batch !== undefined && String(batch).trim() !== "") {
      continue;
    }
    total += toNumber(entry?.payable_amount);
    entries += 1;
  }
  // Avoid float dust such as 0.30000000000000004 on currency output.
  return { amount: Math.round(total * 100) / 100, entries };
}

function toDate(value: unknown): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

function dateValue(value: unknown): number {
  return toDate(value)?.getTime() ?? 0;
}

/** Newest first, capped at `limit`, with honest values for missing fields. */
export function buildRecentOrders(groups: Row[], limit = 8): RecentOrder[] {
  const sorted = [...(groups ?? [])].sort(
    (a, b) => dateValue(b?.created_at) - dateValue(a?.created_at)
  );
  return sorted.slice(0, Math.max(0, limit)).map((group) => {
    const created = toDate(group?.created_at);
    return {
      id: String(group?.id ?? ""),
      customerOrderId: String(group?.customer_order_id ?? ""),
      status: typeof group?.status === "string" ? group.status : "unknown",
      itemCount: Array.isArray(group?.items) ? group.items.length : 0,
      createdAt: created ? created.toISOString() : null,
    };
  });
}

export function computePartnerDashboard(
  groups: Row[],
  products: Row[],
  earnings: Row[],
  recentLimit = 8
): PartnerDashboardData {
  const pending = sumPendingEarnings(earnings);
  return {
    counts: {
      activeOrders: countActiveOrders(groups),
      products: countProducts(products),
      pendingEarnings: pending.amount,
      pendingEarningsEntries: pending.entries,
    },
    recentOrders: buildRecentOrders(groups, recentLimit),
  };
}
