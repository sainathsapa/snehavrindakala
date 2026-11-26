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

/**
 * The order's random track reference, or null.
 *
 * Never lets a missing reference cost the customer their confirmation: the email
 * is worthless without it, but an order that exists with an unsent confirmation
 * is worse.
 */
async function trackReferenceFor(
  order: Record<string, unknown>
): Promise<string | null> {
  const id = (order as any)?.id;
  if (!id) return null;
  try {
    const { publicRefForOrder } = await import("@/lib/order-ref");
    return await publicRefForOrder(String(id));
  } catch (err) {
    console.error("[email] could not allocate a track reference", err);
    return null;
  }
}

/**
 * The subset of an order the confirmation template renders.
 *
 * `track_ref` is the random reference the buyer types into /track. It is looked
 * up (or minted) here rather than stored on the order because orders live in
 * Medusa and this is the shop's own table — and because the email is the first
 * moment the reference needs to exist.
 */
function payloadFor(
  order: Record<string, unknown>,
  trackRef?: string | null
): Record<string, unknown> {
  const anyOrder = order as any;
  return {
    track_ref: trackRef ?? null,
    id: anyOrder.id,
    display_id: anyOrder.display_id,
    email: anyOrder.email,
    currency_code: anyOrder.currency_code,
    total: anyOrder.total,
    subtotal: anyOrder.subtotal,
    shipping_total: anyOrder.shipping_total,
    discount_total: anyOrder.discount_total,
    created_at: anyOrder.created_at,
    items: (anyOrder.items || []).map((item: any) => ({
      title: item.title || item.product_title,
      variant_title: item.variant_title,
      quantity: item.quantity,
      unit_price: item.unit_price,
      total: item.total,
    })),
    shipping_address: anyOrder.shipping_address || null,
  };
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

  // The invoice rides along with the confirmation: every paid order gets a PDF
  // of what was bought, at what price, from whom.
  let attachments: { filename: string; content: string; contentType: string }[] | undefined;
  try {
    const { invoiceFactsFromOrder } = await import("@/lib/invoice");
    const { buildInvoicePdf, invoiceFileName } = await import("@/lib/invoice-pdf");
    const facts = invoiceFactsFromOrder(order as never);
    attachments = [
      {
        filename: invoiceFileName(facts.invoiceNumber),
        content: buildInvoicePdf(facts).toString("base64"),
        contentType: "application/pdf",
      },
    ];
  } catch (err) {
    // A missing attachment must not cost the customer their confirmation.
    console.error("[email] could not build the invoice PDF", err);
  }

  // Prefer the internal route: it can carry the attachment and does not depend
  // on the publishable key that ships in the browser bundle.
  const internalSecret = process.env.INTERNAL_NOTIFY_SECRET;
  if (internalSecret) {
    const backendUrl = (
      process.env.MEDUSA_BACKEND_URL ||
      process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ||
      "http://localhost:9000"
    ).replace(/\/+$/, "");
    try {
      const res = await fetch(`${backendUrl}/internal/notifications/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-internal-secret": internalSecret,
        },
        cache: "no-store",
        signal: AbortSignal.timeout(15_000),
        body: JSON.stringify({
          to,
          template: "order_confirmation",
          eventKey: `order_confirmation:${(order as any).id}`,
          data: { order: payloadFor(order, await trackReferenceFor(order)) },
          ...(attachments ? { attachments } : {}),
        }),
      });
      if (res.ok) {
        const result = (await res.json().catch(() => ({}))) as { status?: string };
        return result.status === "sent";
      }
      console.error(`[email] internal confirmation failed: ${res.status}`);
    } catch (err) {
      console.error("[email] internal confirmation unreachable", err);
    }
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
        data: { order: payloadFor(order, await trackReferenceFor(order)) },
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
