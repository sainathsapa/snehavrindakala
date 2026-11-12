/**
 * Notification record for transactional emails/messages (DML).
 *
 * `skipped` means the message was rendered and logged but no transport was
 * configured (local development / CI). It is deliberately distinct from
 * `failed` so a dev environment does not look like an outage.
 */
import { model } from "@medusajs/utils";

export type NotificationStatus =
  | "pending"
  | "sent"
  | "delivered"
  | "failed"
  | "bounced"
  | "skipped";
export type NotificationChannel = "email" | "whatsapp" | "sms";

export const Notification = model.define("notification", {
  id: model.text().primaryKey(),
  recipient: model.text(),
  channel: model.enum(["email", "whatsapp", "sms"]),
  template: model.text(),
  data: model.json().nullable(),
  status: model
    .enum(["pending", "sent", "delivered", "failed", "bounced", "skipped"])
    .default("pending"),
  provider_message_id: model.text().nullable(),
  error_message: model.text().nullable(),
});
