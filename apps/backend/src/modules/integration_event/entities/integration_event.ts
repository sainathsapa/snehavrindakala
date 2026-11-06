/**
 * Integration event ledger for idempotent webhook processing (DML).
 */
import { model } from "@medusajs/utils";

export type IntegrationEventProcessingState =
  | "received"
  | "processing"
  | "processed"
  | "failed"
  | "dead_letter";

export const IntegrationEvent = model.define("integration_event", {
  id: model.text().primaryKey(),
  provider: model.text(),
  event_id: model.text(),
  event_type: model.text(),
  received_at: model.dateTime(),
  payload: model.json().nullable(),
  signature_result: model.text().nullable(),
  processing_state: model
    .enum(["received", "processing", "processed", "failed", "dead_letter"])
    .default("received"),
  attempt_count: model.number().default(0),
  last_error: model.text().nullable(),
  processed_at: model.dateTime().nullable(),
});
