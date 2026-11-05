/**
 * Immutable earnings ledger entry for partner payout reconciliation (plain class).
 */
export type LedgerEntryState = "pending" | "paid" | "reversed";
export type LedgerSourceType = "order" | "commission";

export class EarningsLedgerEntry {
  id!: string;
  partner_id!: string;
  source_type!: LedgerSourceType;
  source_id!: string;
  gross_basis!: number;
  deductions!: number;
  fee_share!: number;
  currency!: string;
  state!: LedgerEntryState;
  audit_metadata?: Record<string, any> | null;
  created_at!: Date;

  constructor(data?: Partial<EarningsLedgerEntry>) {
    if (data) {
      Object.assign(this, data);
    }
    if (!this.id) {
      this.id = crypto.randomUUID();
    }
    this.state = this.state ?? "pending";
    this.currency = this.currency ?? "INR";
    this.created_at = new Date();
  }
}
