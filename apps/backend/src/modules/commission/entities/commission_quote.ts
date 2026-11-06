/**
 * Versioned commission quote (DML).
 */
import { model } from "@medusajs/utils";

export type QuoteStatus = "draft" | "sent" | "accepted" | "expired" | "declined";

export const CommissionQuote = model.define("commission_quote", {
  id: model.id().primaryKey(),
  commission_request_id: model.id(),
  version: model.number().default(1),
  scope: model.text(),
  deliverables: model.text().nullable(),
  total_minor: model.number().default(0),
  tax_minor: model.number().default(0),
  fee_share_minor: model.number().default(0),
  deposit_rules: model.json().nullable(),
  milestone_schedule: model.json().nullable(),
  status: model.enum(["draft", "sent", "accepted", "expired", "declined"]).default("draft"),
  expiry_at: model.dateTime().nullable(),
  medusa_order_id: model.text().nullable(),
});
