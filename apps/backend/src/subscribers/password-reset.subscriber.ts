/**
 * Password reset subscriber.
 *
 * Medusa's `POST /auth/customer/emailpass/reset-password` generates a reset
 * token and emits `auth.password_reset`; the token never travels back over HTTP,
 * so something inside the backend has to mail it. Without this subscriber the
 * whole reset flow is a dead end: the customer is told a link is coming and no
 * link exists.
 *
 * The token is the credential. It is emailed to the address on the account and
 * never logged, never returned to a caller, and never written to the
 * notification row (the row stores the rendered body only after the send).
 *
 * Scope: customer resets only. Admin/user resets are handled in the admin panel
 * by an operator who is already signed in, and mailing those tokens to an
 * address we have not verified would widen the blast radius for no benefit.
 */

import { NOTIFICATION_MODULE } from "../modules/notification";
import type { NotificationService } from "../modules/notification/service";

/** One hour: long enough for a locked-out customer, short enough to be safe. */
const RESET_TOKEN_TTL_MINUTES = 60;

export const config = {
  event: "auth.password_reset",
};

export default async function passwordResetSubscriber(args: any): Promise<void> {
  const { event, container } = args;
  const data = event?.data || {};
  const entityId: string | undefined = data.entity_id || data.entityId;
  const token: string | undefined = data.token;
  const actorType: string = data.actor_type || data.actorType || "customer";

  if (actorType !== "customer") {
    console.log(`[password-reset] ignoring a ${actorType} reset`);
    return;
  }

  if (!entityId || !token) {
    console.error(
      "[password-reset] event carried no entity_id or token; nothing to send"
    );
    return;
  }

  // Resolve the address. A reset for an unknown identity must not throw: the
  // request path already answered 201 to avoid leaking which emails exist.
  let email = "";
  try {
    const customerService = container.resolve("customer");
    const customer = await customerService.retrieveCustomer(entityId, {
      select: ["id", "email"],
    });
    email = String(customer?.email || "");
  } catch (err) {
    console.log(
      `[password-reset] no customer for ${entityId.slice(0, 8)}…; skipping`
    );
    return;
  }

  if (!email) {
    console.error("[password-reset] customer has no email address");
    return;
  }

  const notificationService = container.resolve(
    NOTIFICATION_MODULE
  ) as NotificationService;

  try {
    const notification = await notificationService.sendNotification({
      to: email,
      template: "password_reset",
      // eventKey makes a duplicate emit idempotent at the service layer.
      eventKey: `password_reset:${entityId}:${token.slice(-12)}`,
      data: {
        token,
        email,
        expires_in_minutes: RESET_TOKEN_TTL_MINUTES,
      },
    });
    console.log(
      `[password-reset] ${notification.status === "sent" ? "sent" : notification.status} for customer ${entityId.slice(0, 8)}…`
    );
  } catch (err) {
    // The customer is locked out; a silent failure here is the worst outcome.
    console.error("[password-reset] could not send the reset email", err);
  }
}
