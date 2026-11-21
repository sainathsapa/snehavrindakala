import type { MedusaRequest, MedusaResponse } from "@medusajs/types";
import { NOTIFICATION_MODULE } from "../../../../modules/notification";
import type { NotificationService } from "../../../../modules/notification/service";
import { hasTemplate } from "../../../../modules/notification/templates";

/**
 * POST /store/notifications/send
 *
 * Send a transactional email through the notification module.
 *
 * The storefront owns checkout completion, and Medusa events are not
 * guaranteed for every path (a cart completed after the order was already
 * marked paid emits nothing). This lets completion send the confirmation
 * deterministically, reusing the same templates and transport.
 *
 * Deliberately restrictive: only registered templates, only a caller holding
 * the publishable key, and never a caller-supplied body. That stops this from
 * becoming an open email relay.
 */

/** Templates a storefront caller is permitted to trigger. */
const STOREFRONT_TEMPLATES = new Set(["order_confirmation", "cart_reminder"]);

async function POST(req: MedusaRequest, res: MedusaResponse) {
  const notificationService = req.scope.resolve(
    NOTIFICATION_MODULE
  ) as NotificationService;

  const { to, template, data } = (req.body || {}) as {
    to?: string;
    template?: string;
    data?: Record<string, any>;
  };

  if (!to || !template) {
    return res.status(400).json({ error: "`to` and `template` are required" });
  }

  if (!hasTemplate(template) || !STOREFRONT_TEMPLATES.has(template)) {
    return res
      .status(400)
      .json({ error: `Template "${template}" cannot be sent from this endpoint` });
  }

  try {
    const notification = await notificationService.sendNotification({
      to,
      template,
      data: data || {},
    });

    return res.status(202).json({
      id: notification.id,
      status: notification.status,
      error: notification.error_message || null,
    });
  } catch (err) {
    return res.status(500).json({
      error: err instanceof Error ? err.message : "Failed to send notification",
    });
  }
}

export { POST };
