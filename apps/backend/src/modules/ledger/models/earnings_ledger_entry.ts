/**
 * Immutable earnings ledger entry for partner payout reconciliation.
 */
export type LedgerEntryState = "pending" | "paid" | "reversed";

export class EarningsLedgerEntry {
  id!: string;
  partner_id!: string;
  source_type!: "order" | "commission";
  source_id!: string;
  gross_basis!: number;
  deductions!: number;
  fee_share!: number;
  currency!: string;
  state!: LedgerEntryState;
  audit_metadata?: string | null;
  created_at!: Date;
}

export type EarningsLedgerEntryInput = Partial<
  Omit<EarningsLedgerEntry, "id" | "created_at">
> & { id?: string };
