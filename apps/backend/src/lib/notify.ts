/**
 * Backend → storefront realtime notifications.
 *
 * When something happens in Medusa that an operator needs to know about (a new
 * paid order, a new commission brief, a refund), the subscriber posts to the
 * storefront's notifications endpoint. The storefront writes the row and
 * publishes it over Postgres LISTEN/NOTIFY, so every open admin tab updates.
 *
 * Fire-and-forget by design: a notification is a courtesy, never a reason to
 * fail the business operation that triggered it.
 */

export interface RealtimeNotification {
  title: string;
  message: string;
  type?: "info" | "success" | "warning" | "error";
  link?: string | null;
  audience?: string;
}

function storefrontBaseUrl(): string | null {
  const url =
    process.env.STOREFRONT_URL ||
    process.env.NEXT_PUBLIC_STOREFRONT_URL ||
    process.env.STOREFRONT_BASE_URL;
  return url ? url.replace(/\/+$/, "") : null;
}

/**
 * True when a secret is configured for the internal notify endpoint.
 * Without it the storefront route would (correctly) reject us, so we skip the
 * call instead of generating 401 noise in the logs.
 */
function notifySecret(): string | null {
  return process.env.INTERNAL_NOTIFY_SECRET || null;
}

export async function pushRealtimeNotification(
  notification: RealtimeNotification
): Promise<boolean> {
  const baseUrl = storefrontBaseUrl();
  const secret = notifySecret();

  if (!baseUrl || !secret) {
    // Expected in local development; not an error.
    console.log(
      "[notify] skipped (STOREFRONT_URL or INTERNAL_NOTIFY_SECRET unset)",
      notification.title
    );
    return false;
  }

  try {
    const res = await fetch(`${baseUrl}/api/internal/notifications`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-secret": secret,
      },
      signal: AbortSignal.timeout(5000),
      body: JSON.stringify({
        title: notification.title,
        message: notification.message,
        type: notification.type || "info",
        link: notification.link || null,
        audience: notification.audience || "admin",
      }),
    });

    if (!res.ok) {
      console.error(`[notify] storefront responded ${res.status}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[notify] push failed", err);
    return false;
  }
}
