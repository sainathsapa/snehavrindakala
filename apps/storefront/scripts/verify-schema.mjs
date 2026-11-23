#!/usr/bin/env node
/**
 * Post-migration verification for the partner/marketplace schema.
 *
 * Two independent checks, both runnable in CI or on a deployed host:
 *
 *   1. DATABASE: every table/column introduced by migrations 002-009 exists in
 *      the live database. This is the hard gate that lets the lazy CREATEs be
 *      removed from request handlers: if the tables are missing, the check fails
 *      loudly instead of the first customer finding out.
 *
 *   2. SOURCE (HARD GATE): none of the configured handlers may contain a
 *      `CREATE TABLE`. Those are the hot paths where a cold-container DDL is
 *      most likely to race or to be the first thing a visitor hits. Any DDL
 *      found here fails the script, just like a missing table does.
 *
 * Nothing is written. No secret value is printed — DATABASE_URL is referred to
 * by name only, and any error text is redacted before logging.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Expected tables and columns from migrations 002-009. Kept explicit (rather
 * than parsed from the SQL) so a typo in a migration cannot silently define
 * what "verified" means.
 */
const EXPECTED_SCHEMA = {
  // 002_partner_marketplace
  partner: [
    "id", "legal_name", "display_name", "slug", "contact_email", "contact_phone",
    "business_profile", "registration_details", "account_status",
    "verification_status", "approval_history", "artist_id", "created_at", "updated_at",
  ],
  partner_membership: [
    "id", "partner_id", "email", "password_hash", "full_name", "role", "status",
    "token_version", "last_login_at", "created_at", "updated_at",
  ],
  partner_onboarding_application: [
    "id", "legal_name", "display_name", "contact_email", "contact_phone",
    "business_details", "artist_information", "product_categories",
    "document_keys", "review_status", "review_notes", "reviewed_by", "reviewed_at",
    "created_partner_id", "created_at", "updated_at",
  ],
  partner_product: [
    "id", "partner_id", "product_id", "submission_status", "attributes",
    "rejection_reason", "submitted_at", "reviewed_by", "reviewed_at",
    "created_at", "updated_at",
  ],
  fulfilment_group: [
    "id", "customer_order_id", "partner_id", "status", "items",
    "assignment_history", "rejection_reason", "fulfilment_deadline",
    "shipment_id", "created_at", "updated_at",
  ],
  partner_audit_log: [
    "id", "partner_id", "actor_email", "actor_role", "action", "entity_type",
    "entity_id", "metadata", "created_at",
  ],
  // 003_marketplace_finance
  commission_policy: [
    "id", "name", "scope", "scope_ref", "rate_basis", "tax_included",
    "shipping_included", "rate_percent", "fixed_amount", "currency",
    "refund_effect", "payable_when", "status", "version", "effective_from",
    "effective_to", "approved_by", "approved_at", "created_by", "created_at", "updated_at",
  ],
  partner_earnings_ledger: [
    "id", "partner_id", "order_id", "item_id", "entry_type", "gross_basis",
    "discount", "tax_amount", "shipping_amount", "commission_amount",
    "payable_amount", "currency", "commission_policy_id", "reverses_entry_id",
    "settlement_batch_id", "idempotency_key", "metadata", "created_at",
  ],
  settlement_batch: [
    "id", "status", "period_start", "period_end", "currency", "total_amount",
    "line_count", "approved_by", "approved_at", "payment_initiated_by",
    "provider", "payout_reference", "provider_confirmation", "failure_reason",
    "created_at", "updated_at",
  ],
  settlement_batch_item: [
    "id", "batch_id", "partner_id", "ledger_entry_id", "amount", "created_at",
  ],
  // 004_payment_reconciliation
  payment_event: [
    "id", "provider", "provider_event_id", "event_type", "order_id", "payment_id",
    "payload_hash", "status", "attempts", "last_error", "received_at", "processed_at",
  ],
  payment_reconciliation_issue: [
    "id", "order_id", "payment_id", "issue_type", "status", "attempts",
    "next_attempt_at", "last_error", "resolution", "resolved_at",
    "created_at", "updated_at",
  ],
  refund_execution: [
    "id", "refund_request_id", "order_id", "partner_id", "amount", "currency",
    "status", "requested_by", "approved_by", "idempotency_key", "provider",
    "provider_refund_id", "provider_response", "ledger_reversal_key",
    "inventory_restored", "failure_reason", "created_at", "updated_at",
    // 007_refund_inventory
    "inventory_restoration_state", "inventory_eligibility_reason",
    "inventory_restored_by", "inventory_restored_at", "inventory_restoration_key",
  ],
  // 005_notification_retry (app_notification is backend-owned but migration 005
  // creates a compatible base table when absent, so it must always be present).
  app_notification: [
    "id", "recipient", "channel", "template", "status", "created_at", "updated_at",
    "attempts", "max_attempts", "next_attempt_at", "last_error", "error_kind",
    "last_attempt_at", "delivery_status", "terminal_reason", "dead_lettered_at",
    "suppressed", "last_delivery_event_at", "lease_owner", "lease_until",
  ],
  notification_event: [
    "id", "provider", "provider_event_id", "event_type", "message_id",
    "notification_id", "bounce_type", "received_at",
  ],
  notification_suppression: ["id", "recipient", "reason", "created_at"],
  // 007_refund_inventory
  inventory_restoration_action: [
    "id", "action_key", "refund_execution_id", "refund_request_id",
    "return_request_id", "order_id", "order_item_id", "variant_id", "status",
    "eligibility_reason", "trigger", "actor", "attempts", "last_error",
    "metadata", "created_at", "updated_at",
  ],
  inventory_movement: [
    "id", "movement_key", "direction", "order_id", "order_item_id",
    "variant_id", "quantity", "refund_execution_id", "refund_request_id",
    "return_request_id", "actor", "reason", "restoration_action_key",
    "metadata", "created_at",
  ],
};

/**
 * High-traffic handlers that must not create their own tables. Paths are
 * relative to apps/storefront. Extend this list as more lazy CREATEs are
 * removed; it is intentionally a config, not a filesystem-wide guess.
 */
const HIGH_TRAFFIC_HANDLERS = [
  "lib/site-content.ts",
  "lib/notifications.ts",
  "lib/wishlist-server.ts",
  "lib/rate-limit.ts",
  "lib/newsletter.ts",
  "lib/abandoned-carts.ts",
  "lib/gift.ts",
  "lib/work-alerts.ts",
  "lib/certificates.ts",
  "lib/refund-approvals.ts",
  "lib/shipping/store.ts",
  "lib/password-reset.ts",
  "app/api/store/i18n/route.ts",
  "app/api/admin/reviews/route.ts",
  "app/api/admin/users/route.ts",
  "app/api/admin/journal/route.ts",
  "app/api/admin/returns/route.ts",
  "app/api/account/returns/route.ts",
  "app/api/admin/discounts/route.ts",
  "app/api/admin/discounts/[id]/route.ts",
  "app/api/admin/settings/route.ts",
  "app/api/admin/tickets/route.ts",
  "app/api/admin/tickets/[id]/route.ts",
  "app/api/tickets/[id]/route.ts",
  "app/api/admin/audit-log/route.ts",
  "app/api/admin/commissions/route.ts",
  "app/api/admin/commissions/[id]/route.ts",
  "app/api/admin/orders/[id]/refund/route.ts",
  // Additional handler found during the lazy-DDL sweep (product_handle ALTER).
  "app/api/tickets/route.ts",
];

let failures = 0;
function fail(msg) {
  console.error(`  - ${msg}`);
  failures++;
}

function redact(value) {
  let s = String(value);
  const url = process.env.DATABASE_URL;
  if (url) {
    s = s.split(url).join("[REDACTED_DATABASE_URL]");
    try {
      const u = new URL(url);
      if (u.password) s = s.split(u.password).join("[REDACTED]");
    } catch {
      /* regex below still catches DSNs */
    }
  }
  return s.replace(/postgres(?:ql)?:\/\/[^\s/]+@[^\s]+/gi, "[REDACTED_DATABASE_URL]");
}

/** Remove comments so prose about CREATE TABLE cannot trigger a false alarm. */
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function checkHandlers() {
  for (const rel of HIGH_TRAFFIC_HANDLERS) {
    let src;
    try {
      src = readFileSync(join(root, rel), "utf8");
    } catch {
      fail(`configured handler is missing: ${rel}`);
      continue;
    }
    if (/CREATE\s+TABLE\b/i.test(stripComments(src))) {
      // HARD gate: the tables are created by db/schema.sql + migrations 002-009
      // before the server starts, so a CREATE TABLE here is a race/regression,
      // not a harmless fallback. Fail exactly as we do for a missing table.
      fail(`CREATE TABLE still present in handler: ${rel}`);
    }
  }
}

async function checkDatabase() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    fail("DATABASE_URL is not set (value intentionally not printed).");
    return;
  }
  const client = new pg.Client({ connectionString: url });
  try {
    await client.connect();
    const names = Object.keys(EXPECTED_SCHEMA);
    const { rows } = await client.query(
      `SELECT table_name, column_name FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = ANY($1)`,
      [names]
    );
    const present = new Map();
    for (const r of rows) {
      if (!present.has(r.table_name)) present.set(r.table_name, new Set());
      present.get(r.table_name).add(r.column_name);
    }
    for (const [table, columns] of Object.entries(EXPECTED_SCHEMA)) {
      if (!present.has(table)) {
        fail(`missing table: ${table}`);
        continue;
      }
      const have = present.get(table);
      for (const column of columns) {
        if (!have.has(column)) fail(`missing column: ${table}.${column}`);
      }
    }
  } catch (e) {
    fail(`database check failed (${e.code || "ERROR"}): ${redact(e.message)}`);
  } finally {
    await client.end().catch(() => {});
  }
}

async function main() {
  console.log("verify-schema: HARD check — no CREATE TABLE may remain in handlers ...");
  checkHandlers();
  console.log("verify-schema: checking migrations 002-009 in the live database ...");
  await checkDatabase();

  if (failures) {
    console.error(`\nverify-schema FAILED with ${failures} problem(s):`);
    process.exit(1);
  }
  console.log(
    `verify-schema OK: ${Object.keys(EXPECTED_SCHEMA).length} tables with expected columns present ` +
      `and no CREATE TABLE left in any configured handler (both hard gates passed).`
  );
}

main().catch((e) => {
  console.error(`verify-schema FAILED: ${redact(e.message)}`);
  process.exit(1);
});
