/**
 * Payout batch grouping ledger entries for a partner over a period (plain class).
 */
export type PayoutBatchStatus = "draft" | "submitted" | "paid" | "failed" | "reconciled";

export class PayoutBatch {
  id!: string;
  partner_id!: string;
  period_start!: string;
  period_end!: string;
  line_item_count!: number;
  total_amount_minor!: number;
  currency!: string;
  provider_reference?: string | null;
  status!: PayoutBatchStatus;
  approved_by?: string | null;
  reconciled_at?: Date | null;
  created_at!: Date;
  updated_at!: Date;

  constructor(data?: Partial<PayoutBatch>) {
    if (data) {
      Object.assign(this, data);
    }
    if (!this.id) {
      this.id = crypto.randomUUID();
    }
    this.status = this.status ?? "draft";
    this.currency = this.currency ?? "INR";
    this.created_at = new Date();
    this.updated_at = new Date();
  }
}
