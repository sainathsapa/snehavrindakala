/**
 * Platform-level marketplace reporting for *admin* use only.
 *
 * Every query here is deliberately PLATFORM-WIDE. Admin roles that hold the
 * explicit `partners:read` permission may see all partners, allocations and
 * settlements; nothing in this module is tenant-scoped, and nothing here reads
 * a partner session/cookie or a `partner_id` supplied by a caller. No partner
 * scoping helpers or tenant predicates are used — this is the precise inverse
 * of the partner data-access layer.
 *
 * An optional executor is accepted for testing, mirroring the partner layer.
 * The default executor is the shared `query` from `@/lib/db`.
 */

import { query } from "@/lib/db";

export type MarketplaceExecutor = (
  sql: string,
  params?: any[]
) => Promise<any[]>;

/* ── Typed rows (columns from migrations 002–004) ─────────────────────────── */

export interface PartnerRow {
  id: string;
  legal_name: string;
  display_name: string;
  slug: string;
  contact_email: string;
  account_status: string;
  verification_status: string;
  artist_id: string | null;
  artist_name: string | null;
  created_at: string;
}

export interface AllocationRow {
  id: string;
  customer_order_id: string;
  partner_id: string;
  partner_name: string | null;
  status: string;
  items: unknown;
  fulfilment_deadline: string | null;
  shipment_id: string | null;
  created_at: string;
}

export interface SettlementRow {
  id: string;
  status: string;
  period_start: string;
  period_end: string;
  total_amount: string | number;
  line_count: number;
  currency: string;
  provider: string | null;
  payout_reference: string | null;
  failure_reason: string | null;
  created_at: string;
}

export interface EarningsRow {
  id: string;
  partner_id: string;
  entry_type: string;
  commission_amount: string | number;
  payable_amount: string | number;
  currency: string;
  created_at: string;
}

/* ── Optional, non-tenant filters ────────────────────────────────────────── */

export interface PartnerFilter {
  status?: string;
  verificationStatus?: string;
  /** Name/email substring search. Never a tenant id. */
  search?: string;
  limit?: number;
  offset?: number;
}

export interface AllocationFilter {
  status?: string;
  limit?: number;
  offset?: number;
}

export interface SettlementFilter {
  status?: string;
  limit?: number;
  offset?: number;
}

export interface OverviewSummary {
  totalPartners: number;
  partnersByStatus: Record<string, number>;
  partnersByVerification: Record<string, number>;
  activePartners: number;
  pendingPartners: number;
  suspendedPartners: number;
  verifiedPartners: number;
  unverifiedPartners: number;
  totalAllocations: number;
  allocationsByStatus: Record<string, number>;
  /** Groups handed to a partner but not yet accepted. */
  awaitingAcceptance: number;
  totalEarningsEntries: number;
  earningEntries: number;
  reversalEntries: number;
  /** Net money values; Postgres `numeric` may arrive as a string. */
  totalPayable: number;
  totalCommission: number;
  currency: string;
}

export interface MarketplaceOverview {
  generatedAt: string;
  summary: OverviewSummary;
  partners: PartnerRow[];
  allocations: AllocationRow[];
  settlements: SettlementRow[];
}

/* ── helpers ─────────────────────────────────────────────────────────────── */

function toNumber(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function boundedLimit(value: unknown, fallback: number): number {
  const n = parseInt(String(value ?? fallback), 10);
  return Number.isFinite(n) ? Math.min(Math.max(n, 1), 500) : fallback;
}

function boundedOffset(value: unknown): number {
  const n = parseInt(String(value ?? 0), 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function bump(record: Record<string, number>, key: string): void {
  const k = key || "unknown";
  record[k] = (record[k] ?? 0) + 1;
}

/**
 * Pure. Derive the dashboard figures from already-loaded rows so the summary
 * can be unit-tested without a database. Inputs are intentionally narrow
 * structural slices, making the function easy to call in tests.
 */
export function summariseOverview(
  partners: Array<Pick<PartnerRow, "account_status" | "verification_status">> = [],
  groups: Array<Pick<AllocationRow, "status">> = [],
  earnings: Array<
    Pick<EarningsRow, "entry_type" | "commission_amount" | "payable_amount" | "currency">
  > = []
): OverviewSummary {
  const partnersByStatus: Record<string, number> = {};
  const partnersByVerification: Record<string, number> = {};
  for (const partner of partners) {
    bump(partnersByStatus, partner.account_status);
    bump(partnersByVerification, partner.verification_status);
  }

  const allocationsByStatus: Record<string, number> = {};
  for (const group of groups) bump(allocationsByStatus, group.status);

  let totalPayable = 0;
  let totalCommission = 0;
  let earningEntries = 0;
  let reversalEntries = 0;
  let currency = "INR";
  for (const entry of earnings) {
    totalPayable += toNumber(entry.payable_amount);
    totalCommission += toNumber(entry.commission_amount);
    if (entry.entry_type === "earning") earningEntries += 1;
    if (entry.entry_type === "refund_reversal" || entry.entry_type === "adjustment") {
      reversalEntries += 1;
    }
    if (entry.currency) currency = entry.currency;
  }

  return {
    totalPartners: partners.length,
    partnersByStatus,
    partnersByVerification,
    activePartners: partnersByStatus.active ?? 0,
    pendingPartners: partnersByStatus.pending ?? 0,
    suspendedPartners: partnersByStatus.suspended ?? 0,
    verifiedPartners: partnersByVerification.verified ?? 0,
    unverifiedPartners: partnersByVerification.unverified ?? 0,
    totalAllocations: groups.length,
    allocationsByStatus,
    awaitingAcceptance: groups.filter((g) => g.status === "assigned").length,
    totalEarningsEntries: earnings.length,
    earningEntries,
    reversalEntries,
    totalPayable: Math.round(totalPayable * 100) / 100,
    totalCommission: Math.round(totalCommission * 100) / 100,
    currency,
  };
}

/* ── Platform reads ──────────────────────────────────────────────────────── */

/** All partners, with the admin-linked maker profile (if any). */
export async function listAllPartners(
  filter: PartnerFilter = {},
  ex: MarketplaceExecutor = query
): Promise<PartnerRow[]> {
  const where: string[] = [];
  const params: any[] = [];

  if (filter.status) {
    params.push(filter.status);
    where.push(`p.account_status = $${params.length}`);
  }
  if (filter.verificationStatus) {
    params.push(filter.verificationStatus);
    where.push(`p.verification_status = $${params.length}`);
  }
  if (filter.search) {
    params.push(`%${filter.search}%`);
    const i = params.length;
    where.push(
      `(p.display_name ILIKE $${i} OR p.legal_name ILIKE $${i} OR p.contact_email ILIKE $${i})`
    );
  }

  params.push(boundedLimit(filter.limit, 200));
  const limitAt = params.length;
  params.push(boundedOffset(filter.offset));
  const offsetAt = params.length;

  const sql =
    "SELECT p.id, p.legal_name, p.display_name, p.slug, p.contact_email, " +
    "p.account_status, p.verification_status, p.artist_id, " +
    "sa.name AS artist_name, p.created_at " +
    "FROM partner p LEFT JOIN site_artist sa ON sa.id::text = p.artist_id " +
    (where.length ? `WHERE ${where.join(" AND ")} ` : "") +
    `ORDER BY p.created_at DESC LIMIT $${limitAt} OFFSET $${offsetAt}`;

  return (await ex(sql, params)) as PartnerRow[];
}

/** All fulfilment groups across all orders, most-needing-action first. */
export async function listAllocations(
  filter: AllocationFilter = {},
  ex: MarketplaceExecutor = query
): Promise<AllocationRow[]> {
  const where: string[] = [];
  const params: any[] = [];

  if (filter.status) {
    params.push(filter.status);
    where.push(`g.status = $${params.length}`);
  }

  params.push(boundedLimit(filter.limit, 200));
  const limitAt = params.length;
  params.push(boundedOffset(filter.offset));
  const offsetAt = params.length;

  const sql =
    "SELECT g.id, g.customer_order_id, g.partner_id, p.display_name AS partner_name, " +
    "g.status, g.items, g.fulfilment_deadline, g.shipment_id, g.created_at " +
    "FROM fulfilment_group g LEFT JOIN partner p ON p.id = g.partner_id " +
    (where.length ? `WHERE ${where.join(" AND ")} ` : "") +
    "ORDER BY CASE WHEN g.status = 'assigned' THEN 0 ELSE 1 END, g.created_at DESC " +
    `LIMIT $${limitAt} OFFSET $${offsetAt}`;

  return (await ex(sql, params)) as AllocationRow[];
}

/** All settlement batches with their lifecycle status. */
export async function listSettlements(
  filter: SettlementFilter = {},
  ex: MarketplaceExecutor = query
): Promise<SettlementRow[]> {
  const where: string[] = [];
  const params: any[] = [];

  if (filter.status) {
    params.push(filter.status);
    where.push(`status = $${params.length}`);
  }

  params.push(boundedLimit(filter.limit, 200));
  const limitAt = params.length;
  params.push(boundedOffset(filter.offset));
  const offsetAt = params.length;

  const sql =
    "SELECT id, status, period_start, period_end, total_amount, line_count, " +
    "currency, provider, payout_reference, failure_reason, created_at " +
    "FROM settlement_batch " +
    (where.length ? `WHERE ${where.join(" AND ")} ` : "") +
    `ORDER BY created_at DESC LIMIT $${limitAt} OFFSET $${offsetAt}`;

  return (await ex(sql, params)) as SettlementRow[];
}

async function fetchEarnings(ex: MarketplaceExecutor): Promise<EarningsRow[]> {
  const sql =
    "SELECT id, partner_id, entry_type, commission_amount, payable_amount, " +
    "currency, created_at FROM partner_earnings_ledger " +
    "ORDER BY created_at DESC LIMIT 1000";
  return (await ex(sql)) as EarningsRow[];
}

/** One call for the dashboard: raw lists plus the derived summary. */
export async function getMarketplaceOverview(
  ex: MarketplaceExecutor = query
): Promise<MarketplaceOverview> {
  const [partners, allocations, settlements, earnings] = await Promise.all([
    listAllPartners({}, ex),
    listAllocations({}, ex),
    listSettlements({}, ex),
    fetchEarnings(ex),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    summary: summariseOverview(partners, allocations, earnings),
    partners,
    allocations,
    settlements,
  };
}
