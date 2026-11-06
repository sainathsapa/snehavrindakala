/**
 * Commission revision tracking customer briefs and artist responses (DML).
 */
import { model } from "@medusajs/utils";

export const CommissionRevision = model.define("commission_revision", {
  id: model.text().primaryKey(),
  commission_request_id: model.text(),
  milestone_id: model.text(),
  revision_number: model.number().default(1),
  customer_brief: model.text().nullable(),
  artist_response: model.text().nullable(),
  approval_record: model.json().nullable(),
});
