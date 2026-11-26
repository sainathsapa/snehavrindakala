import type { MedusaRequest, MedusaResponse } from "@medusajs/types";
import { timingSafeEqual } from "crypto";
import { NOTIFICATION_MODULE } from "../../../../modules/notification";
import type { NotificationService } from "../../../../modules/notification/service";
import { hasTemplate } from "../../../../modules/notification/templates";

/**
 * POST /internal/notifications/send
 *
 * Service-to-service email sending for the storefront, authenticated with the
 * same shared secret the backend already uses to push realtime notifications
 * (INTERNAL_NOTIFY_SECRET, x-internal-secret header).
 *
 * Why not reuse /store/notifications/send? That route is reachable by anyone
 * holding the publishable key, which ships in the browser bundle. Letting it
 * send `welcome`, `login_alert` or `password_reset` would turn the shop into an
 * open relay for branded mail — useful for phishing a customer, and enough to
 * burn the sending domain's reputation. Account templates therefore live behind
 * a server-only credential, and the public route keeps its two order templates.
 *
 * Callers never supply a body: only { to, template, data }, and only registered
 * templates from the allowlist below.
 */

/** Templates the storefront may trigger from a server-side code path. */
const STOREFRONT_SERVER_TEMPLATES = new Set([
  "welcome",
  "login_alert",
  "password_changed",
  "order_cancelled",
  "order_confirmation",
]);

function authorized(header: string | null | undefined): boolean {
  const expected = process.env.INTERNAL_NOTIFY_SECRET;
  if (!expected || !header) return false;
  const given = Buffer.from(String(header));
  const want = Buffer.from(expected);
  if (given.length !== want.length) return false;
  return timingSafeEqual(given, want);
}

async function POST(req: MedusaRequest, res: MedusaResponse) {
  if (!authorized(req.headers["x-internal-secret"] as string | undefined)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { to, template, data, eventKey } = (req.body || {}) as {
    to?: string;
    template?: string;
    data?: Record<string, any>;
    eventKey?: string;
  };

  if (!to || !template) {
    return res.status(400).json({ error: "`to` and `template` are required" });
  }

  if (!hasTemplate(template) || !STOREFRONT_SERVER_TEMPLATES.has(template)) {
    return res
      .status(400)
      .json({ error: `Template "${template}" cannot be sent from this endpoint` });
  }

  const notificationService = req.scope.resolve(
    NOTIFICATION_MODULE
  ) as NotificationService;

  try {
    const notification = await notificationService.sendNotification({
      to,
      template,
      data: data || {},
      ...(eventKey ? { eventKey } : {}),
    });

    return res.status(202).json({
      id: notification.id,
      status: notification.status,
      error: notification.error_message || null,
    });
  } catch (err) {
    // Never echo the recipient or the provider's raw response: it can contain
    // the address and, for 4xx responses, part of the message body.
    const message = err instanceof Error ? err.message : "Failed to send";
    return res.status(500).json({ error: message });
  }
}

export { POST };
