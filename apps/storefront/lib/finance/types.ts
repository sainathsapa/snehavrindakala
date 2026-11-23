/**
 * Finance domain types mirroring db/migrations/003_marketplace_finance.sql.
 *
 * These are deliberately in-code types. Business rates are NEVER seeded or
 * defaulted here: a commission policy must be explicitly configured and
 * approved by an authorised admin before any money can be calculated.
 */

export type PolicyScope = "global" | "partner" | "category" | "product";
export type RateBasis = "gross_item_value" | "discounted_item_value";
export type PolicyStatus = "draft" | "approved" | "active" | "archived";
export type RefundEffect = "reverse_earnings" | "no_reversal";
export type PayableWhen =
  | "order_paid"
  | "order_delivered"
  | "return_window_elapsed";

export interface CommissionPolicy {
  id?: string;
  name: string;
  scope: PolicyScope;
  scope_ref: string | null;
  rate_basis: RateBasis;
  tax_included: boolean;
  shipping_included: boolean;
  rate_percent: number | string | null;
  fixed_amount: number | string | null;
  currency: string;
  refund_effect: RefundEffect;
  payable_when: PayableWhen;
  status: PolicyStatus;
  version: number;
  effective_from: string | Date | null;
  effective_to: string | Date | null;
  approved_by: string | null;
  approved_at?: string | Date | null;
  created_by?: string | null;
  created_at?: string | Date;
  updated_at?: string | Date;
}

export interface CommissionAmounts {
  gross: number | string;
  discount?: number | string | null;
  tax?: number | string | null;
  shipping?: number | string | null;
}

export interface CommissionResult {
  /** The value the commission was computed on, rounded to 2dp. */
  gross_basis: number;
  /** The platform's cut, rounded to 2dp. */
  commission: number;
  /** What the partner is owed for this line, rounded to 2dp. */
  payable: number;
}

export type LedgerEntryType = "earning" | "refund_reversal" | "adjustment";

/** A row of partner_earnings_ledger. The ledger is append-only. */
export interface EarningsEntry {
  id?: string;
  partner_id: string;
  order_id: string;
  item_id: string;
  entry_type: LedgerEntryType;
  gross_basis: number | string;
  discount: number | string;
  tax_amount: number | string;
  shipping_amount: number | string;
  commission_amount: number | string;
  payable_amount: number | string;
  currency: string;
  commission_policy_id: string | null;
  reverses_entry_id: string | null;
  settlement_batch_id: string | null;
  idempotency_key: string;
  metadata?: Record<string, unknown>;
  created_at?: string | Date;
}

export interface BuildEarningInput {
  partnerId: string;
  orderId: string;
  itemId: string;
  policy: CommissionPolicy;
  amounts: CommissionAmounts;
  idempotencyKey: string;
  metadata?: Record<string, unknown>;
}

export type SettlementStatus =
  | "calculated"
  | "approved"
  | "payment_initiated"
  | "payment_completed"
  | "payment_failed";

export interface SettlementPeriod {
  start: string | Date;
  end: string | Date;
}

export interface SettlementBatch {
  id?: string;
  status: SettlementStatus;
  period_start: string | Date;
  period_end: string | Date;
  currency: string;
  total_amount: number;
  line_count: number;
  approved_by?: string | null;
  approved_at?: string | Date | null;
  payment_initiated_by?: string | null;
  provider?: string | null;
  payout_reference?: string | null;
  provider_confirmation?: Record<string, unknown> | null;
  failure_reason?: string | null;
  created_at?: string | Date;
  updated_at?: string | Date;
}

/**
 * A payout may only be marked paid when the provider has actually confirmed
 * movement of money. A bare "we created a payout record" is not confirmation.
 */
export interface PaymentConfirmation {
  confirmed: boolean;
  status?: string;
  provider_event_id?: string;
  [key: string]: unknown;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Facts used by `payable_when` to decide whether an earning may be settled.
 *
 * Every field maps to something that already exists in the data model or in
 * documented policy — no invented condition:
 *  - `orderPaid`          — payment captured (payment_event / processed_payments)
 *  - `orderDelivered`     — delivery confirmed (order_shipments.status / order
 *                           fulfilment status)
 *  - `orderCancelled`     — order status `cancelled`
 *  - `refundIssued`       — order_refunds / refund_execution for the order
 *  - `pendingReturn`      — open/needs_evidence/approved return_requests row
 *  - `settlementHeld`     — ledger row already assigned (settlement_batch_id), or
 *                           an explicit operational hold on the entry
 *  - `daysSinceDelivery`  — whole days since confirmed delivery
 *  - `returnWindowDays`   — operator-supplied RETURN_WINDOW_DAYS (never defaulted)
 */
export interface PayabilityContext {
  payable_when: PayableWhen | string;
  orderPaid: boolean;
  orderDelivered: boolean;
  orderCancelled: boolean;
  refundIssued: boolean;
  pendingReturn: boolean;
  settlementHeld: boolean;
  daysSinceDelivery: number | null;
  returnWindowDays: number | null;
}

/** Result of evaluating a `payable_when` rule; the reason is audit text. */
export interface PayabilityDecision {
  payable: boolean;
  reason: string;
}

/**
 * Supplies a payability context for one ledger entry. Callers that already hold
 * order/return/refund state (the settlement API) should provide this so the
 * configured rule is actually enforced. See `explainPayability` in settlement.ts.
 */
export type PayabilityResolver =
  | PayabilityContext
  | ((entry: EarningsEntry) => PayabilityContext);

/** Matches the partner package's QueryExecutor so fake executors are portable. */
export type QueryExecutor = (sql: string, params?: any[]) => Promise<any[]>;
