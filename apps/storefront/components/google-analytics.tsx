"use client";

import Script from "next/script";
import { useEffect, useState } from "react";
import {
  GA_MEASUREMENT_ID,
  analyticsConfigured,
  getAnalyticsConsent,
} from "@/lib/analytics";

/**
 * Loads Google Analytics 4 (gtag) — and nothing else.
 *
 * Two details this file exists to get right:
 *
 *  1. **The URL is `gtag/js`.** The snippet from the GA console is
 *     `googletagmanager.com/gtag/js?id=…`; `gtm.js` is Tag Manager, a different
 *     product, and loading it here would give you a container that fires nothing.
 *  2. **Consent is decided before the tag configures itself.** Google's consent
 *     mode is set to `analytics_storage: denied` in the same script that defines
 *     gtag, and only flipped to `granted` once the visitor has answered the
 *     banner. Setting it after `config` would collect a pageview from someone
 *     who has not agreed yet, which is exactly what the banner exists to prevent.
 *
 * Nothing renders when NEXT_PUBLIC_GA_MEASUREMENT_ID is empty, so a development
 * machine or a staging box sends no hits at all.
 */
export function GoogleAnalytics() {
  const [consent, setConsent] = useState<"granted" | "denied" | null>(null);

  useEffect(() => {
    setConsent(getAnalyticsConsent());

    const onChange = (event: Event) => {
      const detail = (event as CustomEvent<{ choice?: string }>).detail;
      if (detail?.choice === "granted" || detail?.choice === "denied") {
        setConsent(detail.choice);
      } else {
        setConsent(getAnalyticsConsent());
      }
    };

    window.addEventListener("svk:consent-changed", onChange);
    return () => window.removeEventListener("svk:consent-changed", onChange);
  }, []);

  if (!analyticsConfigured()) return null;

  return (
    <>
      <Script
        id="ga-lib"
        async
        strategy="afterInteractive"
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
      />
      <Script id="ga-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          window.gtag = window.gtag || gtag;
          gtag('consent', 'default', {
            ad_storage: 'denied',
            ad_user_data: 'denied',
            ad_personalization: 'denied',
            analytics_storage: 'denied',
          });
          gtag('js', new Date());
          gtag('config', '${GA_MEASUREMENT_ID}', { anonymize_ip: true });
        `}
      </Script>
      <Script id="ga-consent" strategy="afterInteractive">
        {`
          // Re-state the visitor's stored choice once gtag exists, so a returning
          // visitor who already accepted is not treated as a new denied one.
          (function () {
            try {
              var stored = localStorage.getItem('svk:analytics-consent');
              if (stored === 'granted' || stored === 'denied') {
                gtag('consent', 'update', { analytics_storage: stored });
              }
            } catch (e) {}
          })();
        `}
      </Script>
    </>
  );
}
