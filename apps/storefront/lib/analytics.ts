/**
 * GA4 consent gate + ecommerce events.
 *
 * Everything the storefront sends to Google goes through `sendGAEvent`, which
 * refuses to run unless BOTH conditions hold: a measurement id is configured
 * and the visitor has explicitly granted analytics consent. The layout sets
 * `analytics_storage: denied` before `gtag('config')`, so an event fired before
 * the banner is answered is also refused by Google itself.
 *
 * This module is deliberately free of React and of any database import: the
 * consent banner imports it from a client component.
 */

export const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

export const CONSENT_STORAGE_KEY = "svk:analytics-consent";
export const CONSENT_CHANGED_EVENT = "svk:consent-changed";
export const OPEN_CONSENT_EVENT = "svk:open-consent";
export const REFUND_EVENT = "svk:refund";

export type ConsentChoice = "granted" | "denied";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

/** Can we talk to GA at all in this environment? */
export function analyticsConfigured(): boolean {
  return Boolean(GA_MEASUREMENT_ID);
}

export function getAnalyticsConsent(): ConsentChoice | null {
  if (typeof window === "undefined") return null;
  try {
    const value = window.localStorage.getItem(CONSENT_STORAGE_KEY);
    return value === "granted" || value === "denied" ? value : null;
  } catch {
    // Private mode / blocked storage: stay denied.
    return null;
  }
}

function gtagCommand(...args: unknown[]): void {
  if (typeof window === "undefined" || !analyticsConfigured()) return;
  window.dataLayer = window.dataLayer || [];
  if (typeof window.gtag === "function") {
    window.gtag(...args);
  } else {
    window.dataLayer.push(args);
  }
}

/** Apply an already-known choice to gtag without re-persisting it. */
export function applyAnalyticsConsent(choice: ConsentChoice): void {
  gtagCommand("consent", "update", {
    analytics_storage: choice,
    ad_storage: choice,
    ad_user_data: choice,
    ad_personalization: choice,
  });
}

/** Store the visitor's choice and apply it immediately. */
export function setAnalyticsConsent(choice: ConsentChoice): void {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(CONSENT_STORAGE_KEY, choice);
    } catch {
      // A choice that cannot be remembered still applies to this page view.
    }
  }
  applyAnalyticsConsent(choice);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(CONSENT_CHANGED_EVENT));
  }
}

/**
 * The single gate for every GA4 event. Called by the five ecommerce helpers
 * below and by nothing else.
 */
export function sendGAEvent(
  name: string,
  params: Record<string, unknown> = {}
): void {
  if (!analyticsConfigured()) return;
  if (getAnalyticsConsent() !== "granted") return;
  gtagCommand("event", name, params);
}

export interface GA4Item {
  item_id?: string;
  item_name: string;
  item_brand?: string;
  item_category?: string;
  price?: number;
  quantity?: number;
  item_image?: string;
}

export interface GA4Product {
  handle: string;
  title: string;
  price?: number | null;
  currency?: string;
  artist?: string;
  image?: string;
}

function toItem(product: GA4Product, quantity = 1): GA4Item {
  return {
    item_id: product.handle,
    item_name: product.title,
    item_brand: product.artist || "SnehaVrinda Kala",
    price: product.price ?? undefined,
    quantity,
    ...(product.image ? { item_image: product.image } : {}),
  };
}

/** GA4: a product detail page was viewed. */
export function trackViewItem(product: GA4Product): void {
  sendGAEvent("view_item", {
    currency: (product.currency || "INR").toUpperCase(),
    value: product.price ?? 0,
    items: [toItem(product)],
  });
}

/** GA4: a product was added to the cart. */
export function trackAddToCart(product: GA4Product, quantity = 1): void {
  sendGAEvent("add_to_cart", {
    currency: (product.currency || "INR").toUpperCase(),
    value: (product.price ?? 0) * quantity,
    items: [toItem(product, quantity)],
  });
}

/** GA4: the buyer reached the checkout step. */
export function trackBeginCheckout(summary?: {
  value?: number;
  currency?: string;
  items?: GA4Item[];
}): void {
  sendGAEvent("begin_checkout", {
    currency: (summary?.currency || "INR").toUpperCase(),
    value: summary?.value ?? 0,
    items: summary?.items ?? [],
  });
}

/**
 * Purchase events can be emitted more than once when a confirmation page is
 * refreshed or a client island remounts. Key the de-duplication on the order
 * id, at module scope so it survives component remounts within a page load.
 */
const reportedPurchases = new Set<string>();

export function trackPurchase(order: {
  id: string;
  value?: number;
  currency?: string;
  items?: GA4Item[];
}): void {
  if (!order?.id || reportedPurchases.has(order.id)) return;
  reportedPurchases.add(order.id);
  sendGAEvent("purchase", {
    transaction_id: order.id,
    currency: (order.currency || "INR").toUpperCase(),
    value: order.value ?? 0,
    items: order.items ?? [],
  });
}

/** GA4: a refund was completed for an order. */
export function trackRefund(order: {
  id: string;
  value?: number;
  currency?: string;
}): void {
  if (!order?.id) return;
  sendGAEvent("refund", {
    transaction_id: order.id,
    currency: (order.currency || "INR").toUpperCase(),
    value: order.value ?? 0,
  });
}

/** Test hook: clear the purchase de-duplication set between cases. */
export function resetPurchaseDedupeForTests(): void {
  reportedPurchases.clear();
}
