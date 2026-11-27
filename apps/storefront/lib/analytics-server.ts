/**
 * Telling Google Analytics about a payment from the server.
 *
 * The browser already reports the funnel, and roughly a third of those reports
 * never arrive: an ad-blocker, a closed tab, a buyer who pays and immediately
 * closes the app. A paid order is the one event that must not be lost, so the
 * webhook reports it too, through GA4's Measurement Protocol.
 *
 * Inert unless GA4_API_SECRET is set: creating that secret is a step in the GA4
 * admin, and an integration that throws without it would break payments to
 * satisfy a report.
 *
 * No personal data is sent. `client_id` is a stable hash of the order id, which
 * lets GA4 attribute the purchase to the session that began it without carrying an
 * email or a phone number into an advertising system.
 */

import { createHash } from "crypto";

const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || "";
const GA_API_SECRET = process.env.GA4_API_SECRET || "";

export function analyticsServerConfigured(): boolean {
  return Boolean(GA_MEASUREMENT_ID && GA_API_SECRET);
}

export interface PurchaseLine {
  item_id?: string | null;
  item_name?: string | null;
  price?: number | null;
  quantity?: number | null;
}

/** A stable pseudo-id: the same order always maps to the same client. */
function clientIdFor(orderId: string): string {
  return createHash("sha256").update(`svk:${orderId}`).digest("hex").slice(0, 32);
}

/**
 * Report a purchase. Never throws and never blocks: a report is worth less than a
 * payment confirmation, and the caller is a webhook the provider will retry.
 */
export async function sendPurchaseToGA4(input: {
  orderId: string;
  value: number;
  currency?: string | null;
  transactionId?: string | null;
  items?: PurchaseLine[];
}): Promise<boolean> {
  if (!analyticsServerConfigured()) return false;

  const payload = {
    client_id: clientIdFor(input.orderId),
    events: [
      {
        name: "purchase",
        params: {
          transaction_id: input.transactionId || input.orderId,
          value: Number(input.value || 0),
          currency: (input.currency || "INR").toUpperCase(),
          items: (input.items ?? [])
            .filter((item) => item.item_id)
            .map((item) => ({
              item_id: String(item.item_id),
              item_name: item.item_name || undefined,
              price: Number(item.price ?? 0),
              quantity: Number(item.quantity ?? 1),
            })),
        },
      },
    ],
  };

  try {
    const url = `https://www.google-analytics.com/mp/collect?measurement_id=${encodeURIComponent(
      GA_MEASUREMENT_ID
    )}&api_secret=${encodeURIComponent(GA_API_SECRET)}`;

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      // A stuck analytics endpoint must not hold a webhook open.
      signal: AbortSignal.timeout(4000),
    });

    if (!res.ok) {
      console.error("[ga4] purchase report rejected", res.status);
      return false;
    }
    return true;
  } catch (error) {
    console.error("[ga4] purchase report failed", (error as Error).message);
    return false;
  }
}
