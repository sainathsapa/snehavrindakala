/**
 * Notification record for transactional emails/messages (plain class).
 */
export type NotificationStatus = "pending" | "sent" | "delivered" | "failed" | "bounced";
export type NotificationChannel = "email" | "whatsapp" | "sms";

export class Notification {
  id!: string;
  recipient!: string;
  channel!: NotificationChannel;
  template!: string;
  data?: Record<string, any> | null;
  status!: NotificationStatus;
  provider_message_id?: string | null;
  error_message?: string | null;
  created_at!: Date;
  updated_at!: Date;

  constructor(data?: Partial<Notification>) {
    if (data) {
      Object.assign(this, data);
    }
    if (!this.id) {
      this.id = crypto.randomUUID();
    }
    this.status = this.status ?? "pending";
    this.created_at = new Date();
    this.updated_at = new Date();
  }
}
