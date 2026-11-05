export interface SendNotificationInput {
  to: string;
  template: string;
  data?: Record<string, any>;
  channel?: "email" | "whatsapp" | "sms";
}
