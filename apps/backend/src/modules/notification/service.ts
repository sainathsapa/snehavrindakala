/**
 * Notification service. Transactional email/message records (DML).
 *
 * DML entities are registered with MikroORM via
 * MedusaServiceModelObjectsSymbol.
 */
import { Notification } from "./entities/notification";
import { MedusaServiceModelObjectsSymbol } from "@medusajs/utils";
import { randomUUID } from "crypto";
import type { SendNotificationInput } from "./types";

const MODEL_OBJECTS = {
  Notification,
};

export class NotificationService {
  protected readonly manager_: any;

  constructor({ manager }: { manager: any }) {
    this.manager_ = manager;
  }

  async sendNotification(data: SendNotificationInput): Promise<any> {
    const { to, template, data: templateData, channel = "email" } = data;

    const notification = this.manager_.getRepository(Notification).create({
      id: randomUUID(),
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
      notification.error_message =
        err instanceof Error ? err.message : String(err);
    }

    await this.manager_.persistAndFlush(notification);

    return notification;
  }

  private async sendViaSES(
    channel: string,
    to: string,
    template: string,
    templateData: Record<string, any>
  ): Promise<void> {
    const { AWS_SES_ACCESS_KEY_ID, FROM_EMAIL } = process.env;

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
  } = {}): Promise<{ notifications: any[]; count: number }> {
    const { recipient, status, template, offset = 0, limit = 50 } = filter;
    const where: Record<string, any> = {};
    if (recipient) where.recipient = recipient;
    if (status) where.status = status;
    if (template) where.template = template;

    const [notifications, count] = await this.manager_.findAndCount(
      Notification,
      where,
      {
        offset,
        limit,
        orderBy: { created_at: "DESC" },
      }
    );

    return { notifications, count };
  }
}

// Register DML entities with Medusa/MikroORM metadata at module load time.
(NotificationService as any)[MedusaServiceModelObjectsSymbol] = MODEL_OBJECTS;
