export interface SendNotificationInput {
  to: string;
  template: string;
  data?: Record<string, any>;
  channel?: "email" | "whatsapp" | "sms";
  /** Files to attach (base64 content). Used for invoice PDFs. */
  attachments?: { filename: string; content: string; contentType?: string }[];
}

/** Fine-grained delivery state from migration 005. `sent` (the historical
 *  `status`) only means the provider accepted the message; these values carry
 *  the retry lifecycle and the verified SES delivery lifecycle. */
export type NotificationDeliveryStatus =
  | "queued"
  | "accepted"
  | "retrying"
  | "dead_lettered"
  | "failed_terminal"
  | "skipped"
  | "delivered"
  | "bounced"
  | "complained"
  | "rejected"
  | "delivery_delayed";

export type NotificationErrorKind = "retryable" | "terminal";
