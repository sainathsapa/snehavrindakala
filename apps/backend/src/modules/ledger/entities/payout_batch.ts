/**
 * Payout batch grouping ledger entries for a partner over a period (DML).
 */
import { model } from "@medusajs/utils";

export type PayoutBatchStatus = "draft" | "submitted" | "paid" | "failed" | "reconciled";

export const PayoutBatch = model.define("payout_batch", {
  id: model.id().primaryKey(),
  partner_id: model.id(),
  period_start: model.text(),
  period_end: model.text(),
  line_item_count: model.number(),
  total_amount_minor: model.number(),
  currency: model.text().default("INR"),
  provider_reference: model.text().nullable(),
  status: model
    .enum(["draft", "submitted", "paid", "failed", "reconciled"])
    .default("draft"),
  approved_by: model.text().nullable(),
  reconciled_at: model.dateTime().nullable(),
});
