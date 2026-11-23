/**
 * Pure, partner-portal-only view helpers for turning immutable earnings-ledger
 * rows into a read-only statement. No database access, no network, no partner
 * ids and no admin finance actions live here — the caller supplies already
 * tenant-scoped rows, and these functions only shape them for display.
 *
 * All money is normalised through integer minor units (paise) before summing so
 * that `numeric(14,2)` values (returned by pg as strings) add up exactly and a
 * refund reversal with a negative payable amount nets off correctly.
 */

export type EntryType = "earning" | "refund_reversal" | "adjustment" | string;

/** The subset of a partner_earnings_ledger row the statement view needs. */
export interface EarningsEntry {
  id: string;
  order_id: string;
  item_id: string;
  entry_type: EntryType;
  gross_basis: number | string;
  commission_amount: number | string;
  payable_amount: number | string;
  discount?: number | string | null;
  tax_amount?: number | string | null;
  shipping_amount?: number | string | null;
  currency?: string | null;
  settlement_batch_id?: string | null;
  created_at?: string | Date | null;
  reverses_entry_id?: string | null;
}

export interface StatementPeriod {
  /** Stable key used to group and address a statement. */
  key: string;
  /** Human-readable label shown in the UI. */
  label: string;
  batchId?: string | null;
  startTime?: string | Date | null;
  endTime?: string | Date | null;
}

export interface StatementLineItem {
  entryId: string;
  orderId: string;
  itemId: string;
  entryType: EntryType;
  status: string;
  gross: number;
  discount: number;
  tax: number;
  shipping: number;
  commission: number;
  payable: number;
  date: string;
  reversesEntryId?: string | null;
}

export interface StatementTotals {
  lineCount: number;
  gross: number;
  discount: number;
  tax: number;
  shipping: number;
  commission: number;
  payable: number;
}

export interface Statement {
  period: StatementPeriod;
  currency: string;
  lineItems: StatementLineItem[];
  totals: StatementTotals;
  /** Fixed wording makes it clear this is a view, not an issued document. */
  viewLabel: string;
}

function toMinor(value: number | string | null | undefined): number {
  if (value === null || value === undefined || value === "") return 0;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

function fromMinor(minor: number): number {
  return Math.round(minor) / 100;
}

function money(value: number): number {
  return fromMinor(toMinor(value));
}

/** Deterministic, locale-independent display of a money value. */
export function formatMoney(value: number | string, currency = "INR"): string {
  const code = (currency || "INR").toUpperCase();
  const sign = money(value) < 0 ? "-" : "";
  return `${sign}${code} ${Math.abs(money(value)).toFixed(2)}`;
}

function statusForEntry(entry: EarningsEntry): string {
  if (entry.entry_type === "refund_reversal") return "Reversal";
  if (entry.entry_type === "adjustment") return "Adjustment";
  if (entry.settlement_batch_id) return "In settlement batch";
  return "Earned";
}

function dateLabel(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toISOString().slice(0, 10);
}

/**
 * Build one read-only statement for a set of (already tenant-scoped) ledger
 * entries and a period descriptor. Pure: the same inputs always give the same
 * statement, which makes totals directly testable.
 */
export function buildStatement(
  entries: EarningsEntry[],
  period: StatementPeriod
): Statement {
  const lineItems: StatementLineItem[] = entries.map((entry) => ({
    entryId: entry.id,
    orderId: entry.order_id,
    itemId: entry.item_id,
    entryType: entry.entry_type,
    status: statusForEntry(entry),
    gross: money(entry.gross_basis),
    discount: money(entry.discount),
    tax: money(entry.tax_amount),
    shipping: money(entry.shipping_amount),
    commission: money(entry.commission_amount),
    payable: money(entry.payable_amount),
    date: dateLabel(entry.created_at),
    reversesEntryId: entry.reverses_entry_id,
  }));

  const sum = (pick: (e: EarningsEntry) => number | string | null | undefined) =>
    entries.reduce((total, entry) => total + toMinor(pick(entry)), 0);

  const totals: StatementTotals = {
    lineCount: entries.length,
    gross: fromMinor(sum((e) => e.gross_basis)),
    discount: fromMinor(sum((e) => e.discount)),
    tax: fromMinor(sum((e) => e.tax_amount)),
    shipping: fromMinor(sum((e) => e.shipping_amount)),
    commission: fromMinor(sum((e) => e.commission_amount)),
    payable: fromMinor(sum((e) => e.payable_amount)),
  };

  const currency = (entries.find((e) => e.currency)?.currency || "INR").toUpperCase();

  return {
    period,
    currency,
    lineItems,
    totals,
    viewLabel: "Statement view — for information only; not an issued or downloadable document",
  };
}

export interface PeriodGroup {
  period: StatementPeriod;
  entries: EarningsEntry[];
}

function periodForEntry(entry: EarningsEntry): StatementPeriod {
  if (entry.settlement_batch_id) {
    const id = entry.settlement_batch_id;
    return {
      key: `batch:${id}`,
      label: `Settlement batch ${id.slice(0, 8)}`,
      batchId: id,
    };
  }
  const date = entry.created_at
    ? entry.created_at instanceof Date
      ? entry.created_at
      : new Date(entry.created_at)
    : null;
  const key =
    date && !Number.isNaN(date.getTime())
      ? date.toISOString().slice(0, 7)
      : "unknown";
  const label =
    date && !Number.isNaN(date.getTime())
      ? new Intl.DateTimeFormat("en", { month: "long", year: "numeric", timeZone: "UTC" }).format(date)
      : "Undated entries";
  return { key: `month:${key}`, label };
}

/**
 * Group ledger rows into statement periods: by settlement batch when present,
 * otherwise by calendar month. Ordering is deterministic (most recent first).
 */
export function groupEntriesIntoPeriods(entries: EarningsEntry[]): PeriodGroup[] {
  const groups = new Map<string, PeriodGroup>();
  for (const entry of entries) {
    const period = periodForEntry(entry);
    const existing = groups.get(period.key);
    if (existing) existing.entries.push(entry);
    else groups.set(period.key, { period, entries: [entry] });
  }
  return Array.from(groups.values()).sort((a, b) => b.period.key.localeCompare(a.period.key));
}
