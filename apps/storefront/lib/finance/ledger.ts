/**
 * Immutable partner earnings ledger.
 *
 * Corrections are NEW rows linked by `reverses_entry_id`; historical money
 * values are never UPDATEd. Every insert uses a unique idempotency key with
 * ON CONFLICT DO NOTHING, so a redelivered event cannot double-post money.
 * Partner-facing reads MUST go through tenantQuery, scoped by ctx.partnerId.
 */

import { randomUUID } from "node:crypto";
import { query as defaultQuery } from "@/lib/db";
import { tenantQuery } from "@/lib/partner/repository";
import type { PartnerContext } from "@/lib/partner/types";
import {
  assertKnownRefundEffect,
  computeCommission,
  round2,
  toNumber,
} from "./commission-policy";
import type {
  BuildEarningInput,
  CommissionPolicy,
  EarningsEntry,
  QueryExecutor,
  RefundEffect,
} from "./types";

const LEDGER_COLUMNS = [
  "id",
  "partner_id",
  "order_id",
  "item_id",
  "entry_type",
  "gross_basis",
  "discount",
  "tax_amount",
  "shipping_amount",
  "commission_amount",
  "payable_amount",
  "currency",
  "commission_policy_id",
  "reverses_entry_id",
  "settlement_batch_id",
  "idempotency_key",
  "metadata",
];

/** Build an 'earning' row by computing commission from an explicit policy. */
export function buildEarningEntry(input: BuildEarningInput): EarningsEntry {
  const result = computeCommission(input.policy, input.amounts);
  return {
    id: randomUUID(),
    partner_id: input.partnerId,
    order_id: input.orderId,
    item_id: input.itemId,
    entry_type: "earning",
    gross_basis: result.gross_basis,
    discount: round2(input.amounts.discount),
    tax_amount: round2(input.amounts.tax),
    shipping_amount: round2(input.amounts.shipping),
    commission_amount: result.commission,
    payable_amount: result.payable,
    currency: input.policy.currency,
    commission_policy_id: input.policy.id ?? null,
    reverses_entry_id: null,
    settlement_batch_id: null,
    idempotency_key: input.idempotencyKey,
    metadata: input.metadata ?? {},
  };
}

/**
 * Build a refund reversal as a NEW, negative-money row. The original row is
 * never modified; the link is `reverses_entry_id`.
 */
export function buildRefundReversal(
  original: EarningsEntry,
  idempotencyKey: string
): EarningsEntry {
  return {
    id: randomUUID(),
    partner_id: original.partner_id,
    order_id: original.order_id,
    item_id: original.item_id,
    entry_type: "refund_reversal",
    gross_basis: round2(-toNumber(original.gross_basis)),
    discount: round2(-toNumber(original.discount)),
    tax_amount: round2(-toNumber(original.tax_amount)),
    shipping_amount: round2(-toNumber(original.shipping_amount)),
    commission_amount: round2(-toNumber(original.commission_amount)),
    payable_amount: round2(-toNumber(original.payable_amount)),
    currency: original.currency,
    commission_policy_id: original.commission_policy_id,
    reverses_entry_id: original.id ?? null,
    settlement_batch_id: null,
    idempotency_key: idempotencyKey,
    metadata: {
      ...(original.metadata ?? {}),
      reversed: true,
      reversal_of: original.id ?? null,
    },
  };
}

/**
 * Decide whether a refund/cancellation reverses earned commission and payable.
 *
 * `reverse_earnings` ⇒ a negative `refund_reversal` row must be posted.
 * `no_reversal`      ⇒ nothing is posted; the earning stands.
 * Anything else      ⇒ fail closed — there is no defined money behaviour.
 */
export function shouldReverseEarnings(
  effect: RefundEffect | string | null | undefined
): boolean {
  return assertKnownRefundEffect(effect) === "reverse_earnings";
}

/**
 * Policy-driven refund ledger effect. Returns the rows to post (0 or 1) so the
 * caller can pass the result straight to `postEntries` without branching on the
 * policy itself. Historical money is never UPDATEd — a reversal is a NEW row.
 *
 * Accepts a whole policy (preferred) or a bare refund_effect value.
 */
export function reversalEntriesForRefund(
  policy: CommissionPolicy | RefundEffect | string | null | undefined,
  original: EarningsEntry,
  idempotencyKey: string
): EarningsEntry[] {
  const effect =
    policy !== null && typeof policy === "object"
      ? (policy as CommissionPolicy).refund_effect
      : policy;
  if (!shouldReverseEarnings(effect)) return [];
  const reversal = buildRefundReversal(original, idempotencyKey);
  return [
    {
      ...reversal,
      metadata: {
        ...(reversal.metadata ?? {}),
        refund_effect: assertKnownRefundEffect(effect),
      },
    },
  ];
}

/**
 * Insert ledger rows. A duplicate idempotency key is a no-op, never a second
 * money-movement row. Returns only the rows that were actually inserted.
 */
export async function postEntries(
  entries: EarningsEntry[],
  executor: QueryExecutor = defaultQuery
): Promise<any[]> {
  if (!Array.isArray(entries) || entries.length === 0) return [];
  const inserted: any[] = [];

  for (const entry of entries) {
    const values: any[] = [
      entry.id ?? randomUUID(),
      entry.partner_id,
      entry.order_id,
      entry.item_id,
      entry.entry_type,
      round2(entry.gross_basis),
      round2(entry.discount),
      round2(entry.tax_amount),
      round2(entry.shipping_amount),
      round2(entry.commission_amount),
      round2(entry.payable_amount),
      entry.currency,
      entry.commission_policy_id ?? null,
      entry.reverses_entry_id ?? null,
      entry.settlement_batch_id ?? null,
      entry.idempotency_key,
      JSON.stringify(entry.metadata ?? {}),
    ];
    const placeholders = values.map((_, index) => `$${index + 1}`).join(", ");
    const sql =
      `INSERT INTO partner_earnings_ledger (${LEDGER_COLUMNS.join(", ")}) ` +
      `VALUES (${placeholders}) ` +
      "ON CONFLICT (idempotency_key) DO NOTHING RETURNING *";

    const rows = await executor(sql, values);
    if (Array.isArray(rows)) inserted.push(...rows);
  }
  return inserted;
}

/**
 * Partner-facing statement. tenantQuery injects ctx.partnerId as a bound
 * parameter and refuses to run if the {partner} predicate is missing, so a
 * caller can never read another partner's earnings.
 */
export function statementForPartner(
  ctx: PartnerContext,
  executor?: QueryExecutor
): Promise<any[]> {
  return tenantQuery(
    ctx,
    "SELECT * FROM partner_earnings_ledger WHERE partner_id = {partner} " +
      "ORDER BY created_at DESC LIMIT 1000",
    [],
    executor
  );
}
