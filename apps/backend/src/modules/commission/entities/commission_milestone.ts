/**
 * Commission milestone with proof upload and approval tracking (DML).
 */
import { model } from "@medusajs/utils";

export type MilestoneStatus =
  | "pending"
  | "in_progress"
  | "proof_submitted"
  | "approved"
  | "rejected"
  | "completed";

export const CommissionMilestone = model.define("commission_milestone", {
  id: model.text().primaryKey(),
  commission_request_id: model.text(),
  commission_quote_id: model.text().nullable(),
  name: model.text(),
  sequence: model.number().default(0),
  description: model.text().nullable(),
  due_date: model.dateTime().nullable(),
  status: model.enum([
    "pending",
    "in_progress",
    "proof_submitted",
    "approved",
    "rejected",
    "completed",
  ]).default("pending"),
  proof_object_key: model.text().nullable(),
  approval_record: model.json().nullable(),
});
