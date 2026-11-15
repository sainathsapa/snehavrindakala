# 0005 — Static rendering is blocked by the currency cookie, not the locale header

- **Status:** open, not adopted
- **Date:** recorded after an attempt that was reverted

## Context

Every route in the storefront renders per request (`ƒ` in the build output, 129
of them). The catalogue is wrapped in `unstable_cache` with a 60s revalidate, so
the cost is bounded, but no page is served from a prerendered cache.

The obvious suspect was `app/layout.tsx`, which read the `x-locale` header to
write `<html lang>`:

```ts
const locale = (await headers()).get("x-locale") || "en";
```

Reading a header opts the whole subtree out of static rendering, and the root
layout wraps everything.

## What was tried

Next 15.5 exposes the segment above a root layout as a *root param*, so the
header read can be replaced:

```ts
import { locale } from "next/root-params";
```

This needed `experimental: { rootParams: true }` in `next.config.js`, which is
present in this version. The change compiled and built.

Two things went wrong:

1. `app/not-found.tsx` renders under the root layout but *outside* the
   `[locale]` segment, so the param does not exist there and the build failed
   with `TypeError: (0, e.H) is not a function`. Guarding the call with
   try/catch made the build pass — and introduced the second problem by hiding
   the failure.
2. With the guard in place, `/hi` rendered `<html lang="en">`. The root param
   resolved to nothing on every route, so the catch swallowed it and fell
   through to English. A silently downgraded `lang` attribute is worse for
   screen readers and search engines than the header read it replaced.

Result: **129 → 128 dynamic routes.** One route became static. Not worth the
`lang` regression, so the change was reverted.

## What the attempt did establish

The root layout was never the main blocker. `app/[locale]/layout.tsx:174` calls
`getPreferredCurrency()`, which reads `cookies()`:

```ts
const activeCurrency = await getPreferredCurrency();
```

That feeds the currency switcher in the header. A cookies read in a layout makes
every page beneath it dynamic, so replacing the header read could not have helped
the pages it was aimed at.

The middleware also sets `x-pathname` and `x-locale` on every request
(`middleware.ts:124-145`) and its matcher covers all page routes, which is a
second, independent reason pages cannot be static.

An additional dependency: `listCatalogue()` falls back to `localeFromRequest()`,
which reads `next/headers`. Anything that calls the catalogue without passing a
locale explicitly is dynamic by construction.

## Options, none chosen

- **Move currency to the client.** Read the cookie in a client component and
  keep the layout free of `cookies()`. Unblocks the layout, but the currency
  switcher and every price then need a client boundary, and a price that differs
  between server and client HTML is a hydration mismatch.
- **Accept per-request rendering.** The catalogue cache already limits the
  database work. If traffic is modest this is simply correct, and the ISR work
  is premature.
- **Prerender only the pages that touch nothing dynamic** (`/about`, `/faq`,
  `/disclaimer`, the policy pages). This needs the root layout and middleware
  both to stop forcing dynamic, so it is the same work, not a shortcut.

## Outcome

Reverted. The site renders per request, as it did before. This note exists so
the next attempt starts from the real cause — the currency cookie and the
middleware — rather than the locale header, which is only a symptom.
