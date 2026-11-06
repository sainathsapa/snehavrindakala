/**
 * Private reference/customer upload for a commission request (DML).
 */
import { model } from "@medusajs/utils";

export const CommissionAttachment = model.define("commission_attachment", {
  id: model.text().primaryKey(),
  commission_request_id: model.text(),
  object_key: model.text(),
  mime_type: model.text(),
  size_bytes: model.number(),
  original_filename: model.text().nullable(),
  scan_complete: model.boolean().default(false),
  scan_passed: model.boolean().default(false),
  scan_result: model.text().nullable(),
  retention_delete_at: model.dateTime().nullable(),
});
