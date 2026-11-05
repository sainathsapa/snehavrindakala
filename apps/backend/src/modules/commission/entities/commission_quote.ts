/**
 * Versioned commission quote (plain class).
 */
export type QuoteStatus = "draft" | "sent" | "accepted" | "expired" | "declined";

export class CommissionQuote {
  id!: string;
  commission_request_id!: string;
  version!: number;
  scope!: string;
  deliverables?: string | null;
  total_minor!: number;
  tax_minor!: number;
  fee_share_minor!: number;
  deposit_rules?: Record<string, any> | null;
  milestone_schedule?: Record<string, any> | null;
  status!: QuoteStatus;
  expiry_at?: Date | null;
  medusa_order_id?: string | null;
  created_at!: Date;
  updated_at!: Date;

  constructor(data?: Partial<CommissionQuote>) {
    if (data) {
      Object.assign(this, data);
    }
    if (!this.id) {
      this.id = crypto.randomUUID();
    }
    this.status = this.status ?? "draft";
    this.created_at = this.created_at || new Date();
    this.updated_at = new Date();
  }
}
