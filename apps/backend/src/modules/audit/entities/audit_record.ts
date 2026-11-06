/**
 * Audit record for security-sensitive operations (DML).
 */
import { model } from "@medusajs/utils";

export const AuditRecord = model.define("audit_record", {
  id: model.id().primaryKey(),
  actor: model.text(),
  actor_role: model.text().nullable(),
  action: model.text(),
  entity: model.text(),
  entity_id: model.text(),
  before: model.json().nullable(),
  after: model.json().nullable(),
  request_correlation_id: model.text().nullable(),
});
