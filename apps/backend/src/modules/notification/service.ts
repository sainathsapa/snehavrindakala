import { Notification } from "./entities/notification";
import type { SendNotificationInput } from "./types";

export class NotificationService {
  protected readonly manager_: any;

  constructor({ manager }: { manager: any }) {
    this.manager_ = manager;
  }

  async sendNotification(data: SendNotificationInput): Promise<Notification> {
    const { to, template, data: templateData, channel = "email" } = data;

    const notification = new Notification({
      recipient: to,
      channel,
      template,
      data: templateData || {},
      status: "pending",
    });

    try {
      await this.sendViaSES(channel, to, template, templateData || {});
      notification.status = "sent";
    } catch (err) {
      notification.status = "failed";
      notification.error_message = err instanceof Error ? err.message : String(err);
    }

    return this.manager_.persistAndFlush(notification);
  }

  private async sendViaSES(
    channel: string,
    to: string,
    template: string,
    templateData: Record<string, any>
  ): Promise<void> {
    const {
      AWS_SES_ACCESS_KEY_ID,
      FROM_EMAIL,
    } = process.env;

    if (!AWS_SES_ACCESS_KEY_ID || !FROM_EMAIL) {
      console.log(
        `[Notification] (dev) ${channel} to ${to}: template="${template}"`,
        templateData
      );
      return;
    }
  }

  async listNotifications(filter: {
    recipient?: string;
    status?: string;
    template?: string;
    offset?: number;
    limit?: number;
  } = {}): Promise<{ notifications: Notification[]; count: number }> {
    const { recipient, status, template, offset = 0, limit = 50 } = filter;
    const where: Record<string, any> = {};
    if (recipient) where.recipient = recipient;
    if (status) where.status = status;
    if (template) where.template = template;

    const [notifications, count] = await this.manager_.findAndCount(
      Notification,
      {
        where,
        skip: offset,
        take: limit,
        orderBy: { created_at: "DESC" },
      }
    );

    return { notifications, count };
  }
}
