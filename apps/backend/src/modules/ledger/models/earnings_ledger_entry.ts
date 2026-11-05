import { Entity, Property } from "@mikro-orm/core";

@Entity({ tableName: "earnings_ledger_entry" })
export class EarningsLedgerEntry {
  id!: string;
  partner_id!: string;
  source_type!: "order" | "commission";
  source_id!: string;
  gross_basis!: number;
  deductions!: number;
  fee_share!: number;
  currency!: string;
  state!: "pending" | "paid" | "reversed";
  audit_metadata?: string | null;
  created_at!: Date;
}
