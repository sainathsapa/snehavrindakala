/**
 * Immutable earnings ledger entry for partner payout reconciliation (DML).
 */
import { model } from "@medusajs/utils";

export type LedgerEntryState = "pending" | "paid" | "reversed";
export type LedgerSourceType = "order" | "commission";

export const EarningsLedgerEntry = model.define("earnings_ledger_entry", {
  id: model.text().primaryKey(),
  partner_id: model.text(),
  source_type: model.enum(["order", "commission"]),
  source_id: model.text(),
  gross_basis: model.number(),
  deductions: model.number().default(0),
  fee_share: model.number().default(0),
  currency: model.text().default("INR"),
  state: model.enum(["pending", "paid", "reversed"]).default("pending"),
  audit_metadata: model.json().nullable(),
});
