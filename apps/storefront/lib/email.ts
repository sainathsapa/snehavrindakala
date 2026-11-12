/**
 * Storefront → notification module.
 *
 * The storefront completes orders, so it is the place that knows a payment
 * succeeded. Rather than reimplement email rendering here, it asks the backend
 * notification module to send, which keeps one set of templates and one
 * transport.
 *
 * Never throws: a failed email must not fail a paid order.
 */

interface OrderNotificationPayload {
  to?: string | null;
  order: Record<string, unknown>;
}

export async function sendOrderConfirmation(
  order: OrderNotificationPayload["order"] & { email?: string | null }
): Promise<boolean> {
  const to = order?.email;
  if (!to) {
    console.warn(
      "[email] order has no email address; skipping confirmation",
      (order as any)?.id
    );
    return false;
  }

  const backendUrl = (
    process.env.MEDUSA_BACKEND_URL ||
    process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ||
    "http://localhost:9000"
  ).replace(/\/+$/, "");

  const publishableKey =
    process.env.MEDUSA_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY ||
    "";

  try {
    const res = await fetch(`${backendUrl}/store/notifications/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-publishable-api-key": publishableKey,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
      body: JSON.stringify({
        to,
        template: "order_confirmation",
        data: {
          order: {
            id: order.id,
            display_id: (order as any).display_id,
            email: order.email,
            currency_code: (order as any).currency_code,
            total: (order as any).total,
            subtotal: (order as any).subtotal,
            shipping_total: (order as any).shipping_total,
            items: ((order as any).items || []).map((item: any) => ({
              title: item.title || item.product_title,
              variant_title: item.variant_title,
              quantity: item.quantity,
              unit_price: item.unit_price,
              total: item.total,
            })),
            shipping_address: (order as any).shipping_address || null,
          },
        },
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(
        `[email] confirmation request failed: ${res.status} ${body}`
      );
      return false;
    }

    const result = await res.json();
    // "skipped" means no transport is configured (development). The customer
    // link still works, so this is not an error — but it is not a send either.
    return result.status === "sent";
  } catch (err) {
    console.error("[email] failed to reach the notification service", err);
    return false;
  }
}
