"use client";

import Script from "next/script";

/**
 * Zoho SalesIQ chat widget.
 *
 * Loaded from the public widget URL rather than pasted inline, so the container
 * id lives in one environment variable: `NEXT_PUBLIC_ZOHO_SALESIQ_CODE`. Without
 * it nothing renders, which is what keeps a staging box from routing real chats
 * into the shop's inbox.
 *
 * The `$zoho.salesiq.ready` stub has to exist *before* the widget script runs —
 * the widget calls into it during boot — which is why the stub is a separate,
 * earlier Script rather than part of the same inline block. `defer` on the widget
 * is reproduced with `afterInteractive`, and the loader URL keeps `defer`
 * semantics so it never blocks first paint.
 */
export function ZohoSalesIQ() {
  const code = process.env.NEXT_PUBLIC_ZOHO_SALESIQ_CODE;
  if (!code) return null;

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
