"use client";

import { useEffect, useState } from "react";
import Script from "next/script";
import { CONSENT_CHANGED_EVENT, getAnalyticsConsent } from "@/lib/analytics";

/**
 * Zoho SalesIQ chat widget.
 *
 * Loaded from the public widget URL rather than pasted inline, so the container
 * id lives in one environment variable: `NEXT_PUBLIC_ZOHO_SALESIQ_CODE`. Without
 * it nothing renders, which keeps a staging box from routing real chats into the
 * shop's inbox.
 *
 * Two things worth knowing about the loading order:
 *
 *  · The `$zoho.salesiq.ready` stub has to exist *before* the widget script runs,
 *    which is why it is a separate, earlier Script.
 *  · The widget is not loaded at all until the visitor has answered the consent
 *    banner. It is a third-party script that sets its own cookies, so loading it
 *    first and asking afterwards would be exactly the practice the banner exists
 *    to avoid — and its floating button sits at a very high z-index, which puts
 *    it on top of the banner before that question is even answered.
 */
export function ZohoSalesIQ() {
  const code = process.env.NEXT_PUBLIC_ZOHO_SALESIQ_CODE;
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    if (!code) return;
    // Any answer is enough: the visitor has been asked, so the widget may load.
    // The value only decides whether analytics is granted, not whether chat is.
    const check = () => setAllowed(getAnalyticsConsent() !== null);
    check();
    window.addEventListener(CONSENT_CHANGED_EVENT, check);
    return () => window.removeEventListener(CONSENT_CHANGED_EVENT, check);
  }, [code]);

  if (!code || !allowed) return null;

  return (
    <>
      <Script id="zoho-salesiq-stub" strategy="afterInteractive">
        {`window.$zoho=window.$zoho || {};$zoho.salesiq=$zoho.salesiq||{ready:function(){}}`}
      </Script>
      <Script
        id="zsiqscript"
        strategy="afterInteractive"
        defer
        src={`https://salesiq.zohopublic.in/widget?wc=${code}`}
      />
    </>
  );
}
