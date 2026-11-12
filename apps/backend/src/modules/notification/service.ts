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
import { renderTemplate, type TemplateContext } from "./templates";
import { sendEmail } from "./transport";

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
      if (channel === "email") {
        const outcome = await this.sendViaSES(
          to,
          template,
          templateData || {}
        );
        // "skipped" means SES is not configured (development). That is not a
        // failure — recording it as one would make the admin queue look broken.
        notification.status = outcome === "sent" ? "sent" : "skipped";
      } else {
        console.log(
          `[Notification] channel "${channel}" is not implemented; skipping (template="${template}")`
        );
        notification.status = "skipped";
      }
    } catch (err) {
      notification.status = "failed";
      notification.error_message =
        err instanceof Error ? err.message : String(err);
      console.error(
        `[Notification] Failed to send "${template}" to ${to}:`,
        err
      );
    }

    await this.manager_.persistAndFlush(notification);

    return notification;
  }

  private templateContext(): TemplateContext {
    return {
      storefrontUrl: (
        process.env.STOREFRONT_URL ||
        process.env.NEXT_PUBLIC_STOREFRONT_URL ||
        "https://snehavrinda.in"
      ).replace(/\/+$/, ""),
      contactEmail:
        process.env.CONTACT_EMAIL ||
        process.env.NEXT_PUBLIC_CONTACT_EMAIL ||
        "hello@snehavrinda.in",
      currency: process.env.MEDUSA_CURRENCY_CODE?.toUpperCase() || "INR",
    };
  }

  private async sendViaSES(
    to: string,
    template: string,
    templateData: Record<string, any>
  ): Promise<"sent" | "skipped"> {
    if (!to) {
      throw new Error(
        `Cannot send "${template}": no recipient address was provided`
      );
    }

    const rendered = renderTemplate(
      template,
      this.templateContext(),
      templateData
    );

    return sendEmail({
      to,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    });
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
