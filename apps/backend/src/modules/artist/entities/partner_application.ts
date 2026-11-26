/**
 * Partner application entity (DML).
 * Reviewed by admin before a partner record is activated.
 */
import { model } from "@medusajs/utils";

export const PartnerApplication = model.define("partner_application", {
  id: model.text().primaryKey(),
  artist_id: model.text().nullable(),
  applicant_name: model.text(),
  email: model.text(),
  phone: model.text().nullable(),
  disciplines: model.json().nullable(),
  portfolio_references: model.json().nullable(),
  pricing_range: model.text().nullable(),
  capacity: model.text().nullable(),
  production_times: model.text().nullable(),
  packaging_ability: model.text().nullable(),
  review_status: model.enum(["pending", "approved", "rejected"]).default("pending"),
  reviewer_id: model.text().nullable(),
  review_notes: model.text().nullable(),
});
