/**
 * Ledger module input/output types.
 */

export interface CreateEarningsLedgerEntryInput {
  partner_id: string;
  source_type: "order" | "commission";
  source_id: string;
  gross_basis: number;
  deductions?: number;
  fee_share?: number;
  currency?: string;
  state?: "pending" | "paid" | "reversed";
  audit_metadata?: Record<string, any>;
}

export interface CreatePayoutBatchInput {
  partner_id: string;
  period_start: string;
  period_end: string;
  line_item_count: number;
  total_amount_minor: number;
  currency?: string;
  provider_reference?: string;
  status?: "draft" | "submitted" | "paid" | "failed" | "reconciled";
  approved_by?: string;
}

export interface UpdatePayoutBatchInput {
  period_start?: string;
  period_end?: string;
  line_item_count?: number;
  total_amount_minor?: number;
  currency?: string;
  provider_reference?: string;
  status?: "draft" | "submitted" | "paid" | "failed" | "reconciled";
  approved_by?: string;
  reconciled_at?: Date;
}
