/**
 * Tenant-safe data access for partner-owned resources.
 *
 * THE central isolation rule: every query on partner-owned data goes through
 * `tenantQuery(ctx, ...)` and every such SQL string must contain the `{partner}`
 * token exactly where the `partner_id` predicate belongs. The builder appends
 * `ctx.partnerId` as a bound parameter. A caller cannot supply a partner id —
 * there is no parameter for one. Direct identifier manipulation (changing an
 * id in the URL) therefore cannot cross tenants: the id is checked together
 * with `partner_id`, and a foreign id simply returns no row.
 */

import type { PartnerContext } from "./types";
import { query as defaultQuery } from "@/lib/db";

export type QueryExecutor = (sql: string, params?: any[]) => Promise<any[]>;

export interface ScopedStatement {
  sql: string;
  params: any[];
}

/**
 * Render a tenant-scoped statement. Throws if the SQL forgot the `{partner}`
 * token — a missing predicate is a hard failure, never a silent full-table read.
 */
export function buildScopedStatement(
  ctx: PartnerContext,
  sql: string,
  params: any[] = []
): ScopedStatement {
  if (!ctx || !ctx.partnerId) {
    throw new Error("Partner context required for tenant-scoped query");
  }
  if (!sql.includes("{partner}")) {
    throw new Error(
      "Refusing tenant query without {partner} predicate — possible cross-tenant read"
    );
  }
  const placeholder = `$${params.length + 1}`;
  return {
    sql: sql.replace(/\{partner\}/g, placeholder),
    params: [...params, ctx.partnerId],
  };
}

export async function tenantQuery<T = any>(
  ctx: PartnerContext,
  sql: string,
  params: any[] = [],
  executor: QueryExecutor = defaultQuery
): Promise<T[]> {
  const stmt = buildScopedStatement(ctx, sql, params);
  return (await executor(stmt.sql, stmt.params)) as T[];
}

/* ── Platform-level (admin) lookups — require an explicit admin permission at
   the call site; these are not tenant-scoped by design. ──────────────────── */

export async function findPartnerById(
  id: string,
  executor: QueryExecutor = defaultQuery
): Promise<any | null> {
  const rows = await executor("SELECT * FROM partner WHERE id = $1 LIMIT 1", [id]);
  return rows[0] ?? null;
}

export async function findMembershipByEmail(
  email: string,
  executor: QueryExecutor = defaultQuery
): Promise<any | null> {
  const rows = await executor(
    "SELECT * FROM partner_membership WHERE lower(email) = lower($1) LIMIT 1",
    [email]
  );
  return rows[0] ?? null;
}

export async function findMembershipById(
  id: string,
  executor: QueryExecutor = defaultQuery
): Promise<any | null> {
  const rows = await executor(
    "SELECT * FROM partner_membership WHERE id = $1 LIMIT 1",
    [id]
  );
  return rows[0] ?? null;
}

/* ── Tenant-scoped resource reads ───────────────────────────────────────── */

export function getPartnerProfile(ctx: PartnerContext, executor?: QueryExecutor) {
  return tenantQuery(
    ctx,
    "SELECT id, legal_name, display_name, slug, contact_email, contact_phone, " +
      "business_profile, registration_details, account_status, verification_status, " +
      "created_at, updated_at FROM partner WHERE id = {partner} LIMIT 1",
    [],
    executor
  );
}

export function listPartnerProducts(ctx: PartnerContext, executor?: QueryExecutor) {
  return tenantQuery(
    ctx,
    "SELECT * FROM partner_product WHERE partner_id = {partner} " +
      "ORDER BY created_at DESC LIMIT 200",
    [],
    executor
  );
}

export function getPartnerProduct(
  ctx: PartnerContext,
  productId: string,
  executor?: QueryExecutor
) {
  return tenantQuery(
    ctx,
    "SELECT * FROM partner_product WHERE id = $1 AND partner_id = {partner} LIMIT 1",
    [productId],
    executor
  );
}

export function listPartnerFulfilmentGroups(
  ctx: PartnerContext,
  executor?: QueryExecutor
) {
  return tenantQuery(
    ctx,
    "SELECT * FROM fulfilment_group WHERE partner_id = {partner} " +
      "ORDER BY created_at DESC LIMIT 200",
    [],
    executor
  );
}

/** A group is returned only if it belongs to the authenticated partner. */
export function getPartnerFulfilmentGroup(
  ctx: PartnerContext,
  groupId: string,
  executor?: QueryExecutor
) {
  return tenantQuery(
    ctx,
    "SELECT * FROM fulfilment_group WHERE id = $1 AND partner_id = {partner} LIMIT 1",
    [groupId],
    executor
  );
}

export function getPartnerEarnings(ctx: PartnerContext, executor?: QueryExecutor) {
  return tenantQuery(
    ctx,
    "SELECT * FROM partner_earnings_ledger WHERE partner_id = {partner} " +
      "ORDER BY created_at DESC LIMIT 500",
    [],
    executor
  );
}

export function listPartnerMembers(ctx: PartnerContext, executor?: QueryExecutor) {
  return tenantQuery(
    ctx,
    "SELECT id, email, full_name, role, status, last_login_at, created_at " +
      "FROM partner_membership WHERE partner_id = {partner} ORDER BY created_at",
    [],
    executor
  );
}

/**
 * Fulfilment-only customer view: returns the shipping contact for an order that
 * this partner must fulfil, without exposing billing/payment/customer records.
 */
export function getFulfilmentCustomer(
  ctx: PartnerContext,
  groupId: string,
  executor?: QueryExecutor
) {
  return tenantQuery(
    ctx,
    "SELECT g.id AS group_id, g.items, g.customer_order_id, g.status " +
      "FROM fulfilment_group g WHERE g.id = $1 AND g.partner_id = {partner} LIMIT 1",
    [groupId],
    executor
  );
}
