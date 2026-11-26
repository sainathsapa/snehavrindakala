"use client";

/**
 * Consent banner + consent-gated ecommerce bridge.
 *
 * Rendered only when a GA measurement id is configured. The layout pushes
 * `consent: default { analytics_storage: 'denied' }` before `gtag('config')`;
 * this component is the only place that upgrades that grant, and only after a
 * visitor presses Accept (or a returning visitor's saved choice is replayed).
 *
 * The ecommerce events are wired here rather than scattered through client
 * islands so that every send passes through the same gate. Product data comes
 * from a JSON payload the product page renders; cart/checkout/purchase signals
 * reuse the custom events and routes the storefront already has.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Link, usePathname } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import {
  GA_MEASUREMENT_ID,
  getAnalyticsConsent,
  setAnalyticsConsent,
  applyAnalyticsConsent,
  CONSENT_CHANGED_EVENT,
  OPEN_CONSENT_EVENT,
  REFUND_EVENT,
  trackViewItem,
  trackAddToCart,
  trackBeginCheckout,
  trackPurchase,
  trackRefund,
  type ConsentChoice,
  type GA4Product,
} from "@/lib/analytics";

function readProductPayload(): GA4Product | null {
  if (typeof document === "undefined") return null;
  const node = document.getElementById("svk-ga4-product");
  if (!node) return null;
  try {
    const parsed = JSON.parse(node.textContent || "") as Partial<GA4Product>;
    if (!parsed || typeof parsed.handle !== "string" || typeof parsed.title !== "string") {
      return null;
    }
    return parsed as GA4Product;
  } catch {
    return null;
  }
}

/** next-intl strips the locale prefix, but guard against a raw path too. */
function plainPath(pathname: string): string {
  return pathname.replace(/^\/(hi|en)(?=\/|$)/, "") || "/";
}

export function AnalyticsConsent() {
  const t = useTranslations("consent");
  const pathname = usePathname();
  const [choice, setChoice] = useState<ConsentChoice | null>(null);
  const [visible, setVisible] = useState(false);
  const [ready, setReady] = useState(false);
  const lastPath = useRef<string | null>(null);
  const viewed = useRef<Set<string>>(new Set());
  const checkoutFired = useRef(false);

  useEffect(() => {
    // Replay a stored decision on every page load; with no decision, the banner
    // is shown and GA stays denied.
    const stored = getAnalyticsConsent();
    if (stored) applyAnalyticsConsent(stored);
    setChoice(stored);
    setVisible(stored === null);
    setReady(true);

    const onConsentChanged = () => setChoice(getAnalyticsConsent());
    const onOpen = () => setVisible(true);
    window.addEventListener(CONSENT_CHANGED_EVENT, onConsentChanged);
    window.addEventListener(OPEN_CONSENT_EVENT, onOpen);
    return () => {
      window.removeEventListener(CONSENT_CHANGED_EVENT, onConsentChanged);
      window.removeEventListener(OPEN_CONSENT_EVENT, onOpen);
    };
  }, []);

  const accept = useCallback(() => {
    setAnalyticsConsent("granted");
    setChoice("granted");
    setVisible(false);
  }, []);

  const decline = useCallback(() => {
    setAnalyticsConsent("denied");
    setChoice("denied");
    setVisible(false);
  }, []);

  // view_item / begin_checkout / purchase on route arrival.
  useEffect(() => {
    if (!ready || !GA_MEASUREMENT_ID) return;
    const path = plainPath(pathname || "/");
    if (lastPath.current === path) return;
    lastPath.current = path;

    const product = readProductPayload();
    if (path.startsWith("/products/") && product && !viewed.current.has(product.handle)) {
      viewed.current.add(product.handle);
      trackViewItem(product);
    }

    if (path === "/checkout") {
      if (!checkoutFired.current) {
        checkoutFired.current = true;
        trackBeginCheckout();
      }
    } else {
      // Re-arm the next time the buyer enters checkout.
      checkoutFired.current = false;
    }

    const paid = new URLSearchParams(window.location.search).get("paid") === "1";
    const order = path.match(/^\/order\/([^/]+)$/);
    if (order && paid) {
      // trackPurchase de-duplicates by order id at module scope.
      trackPurchase({ id: order[1] });
    }
  }, [pathname, ready]);

  // add_to_cart — the shared hook dispatches this after a successful add.
  useEffect(() => {
    const onCartChanged = () => {
      const product = readProductPayload();
      if (product) trackAddToCart(product, 1);
    };
    window.addEventListener("svk:cart-changed", onCartChanged);
    return () => window.removeEventListener("svk:cart-changed", onCartChanged);
  }, []);

  // refund — no customer-facing refund-success island exists yet; the helper
  // and this bridge are ready for the component that will dispatch the event.
  useEffect(() => {
    const onRefund = (event: Event) => {
      const detail = (event as CustomEvent<{
        id: string;
        value?: number;
        currency?: string;
      }>).detail;
      if (detail?.id) trackRefund(detail);
    };
    window.addEventListener(REFUND_EVENT, onRefund);
    return () => window.removeEventListener(REFUND_EVENT, onRefund);
  }, []);

  if (!GA_MEASUREMENT_ID || !visible) return null;

  return (
    <>
      {/* The Zoho chat button floats at a very high z-index of its own, so the
          banner sits above it: underneath, the copy is unreadable and the
          buttons are unclickable. */}
      <section
        role="region"
        aria-label={t("regionLabel")}
        aria-live="polite"
        className="fixed inset-x-0 bottom-0 z-[2147483000] border-t border-haldi/30 bg-[#2A120C] px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-rang-paper shadow-[0_-8px_30px_rgba(0,0,0,0.25)] sm:px-8"
      >
      <div className="mx-auto flex max-w-[1400px] flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="max-w-2xl">
          <h2 className="font-serif text-base font-semibold text-haldi">
            {t("title")}
          </h2>
          <p className="mt-1 font-sans text-[13px] leading-relaxed text-rang-paper/80">
            {t("body")}{" "}
            <Link
              href="/policies/cookie"
              className="text-haldi underline underline-offset-2 hover:text-rang-paper"
            >
              {t("cookieLink")}
            </Link>{" "}
            ·{" "}
            <Link
              href="/policies/privacy"
              className="text-haldi underline underline-offset-2 hover:text-rang-paper"
            >
              {t("privacyLink")}
            </Link>
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <button
            type="button"
            onClick={decline}
            className="rounded-full border border-rang-paper/40 px-5 py-2 font-sans text-[13px] font-medium text-rang-paper transition-colors hover:border-rang-paper"
          >
            {t("decline")}
          </button>
          <button
            type="button"
            onClick={accept}
            className="rounded-full bg-haldi px-5 py-2 font-sans text-[13px] font-semibold text-[#2A120C] transition-colors hover:bg-rang-paper focus:outline-none focus-visible:ring-2 focus-visible:ring-rang-paper"
          >
            {t("accept")}
          </button>
        </div>
      </div>
        {choice === "denied" && (
          <span className="sr-only">{t("deniedStatus")}</span>
        )}
      </section>
    </>
  );
}

/**
 * Small control for the cookie policy: lets a visitor reopen the banner and
 * change an earlier decision. It is a client component in the same island as
 * the banner so both use the same custom-event name.
 */
export function CookieSettingsButton({ className = "" }: { className?: string }) {
  const t = useTranslations("consent");
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(OPEN_CONSENT_EVENT))}
      className={className}
    >
      {t("settingsLabel")}
    </button>
  );
}
