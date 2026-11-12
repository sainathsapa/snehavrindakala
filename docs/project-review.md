# Project review — flows, gaps and what to do next

A pass over SnehaVrinda Kala looking for anything broken, missing, or harder
than it needs to be. Findings are ordered by how much damage they do, not by
how easy they are to fix. Everything marked **Shipped** is on `main`.

---

## The short version

The architecture is sound — Medusa v2 for commerce, custom modules for the
parts Medusa does not model (commissions, artists, payouts, audit), a Next.js
storefront, and a large custom admin. The data model is well thought through and
the domain concepts (stock type, commission state machine, milestone proofs,
earnings ledger) are real, not placeholders.

The problems were not in the design. They were in the seams:

1. **The storefront did not build.** Not "had a bug" — `next build` failed
   outright. This had been broken and nobody had run the build.
2. **Money moved wrongly.** The checkout displayed one total and charged
   another, because the shipping selection never left the browser.
3. **Two endpoints trusted the client.** Order completion accepted any payment
   id. That is a free-goods hole.
4. **The admin was reachable by anyone.** No middleware at all.
5. **Credentials were in the repo.** A live Shiprocket password and the Medusa
   admin password were hard-coded as fallbacks.
6. **Tests were red.** Both suites failed; one tested a method that did not
   exist.

None of these are exotic. They are the failures you get when a codebase grows
fast and the build, the tests, and the checkout are not on the path anyone
walks.

---

## What was fixed

### Shipped — build and money

| Problem | Effect | Fix |
|---|---|---|
| `app/checkout/page.tsx` was a Server Component calling `useState` | `next build` failed; the storefront could not be deployed at all | Split into a server component (data) and a client island (`components/checkout-client.tsx`) |
| Shipping selection written to state that was never sent | Customer saw ₹1,247, was charged ₹1,202 (or vice versa) | Selection is sent to the payment session; the server only accepts a rate it quoted for that PIN |
| Payment session created before payment | Charge reflected a stale cart | Session created on click, from the current cart and courier |
| `POST /api/store/checkout/complete` accepted any `payment_id` | Anyone could complete a cart without paying | HMAC signature verification (timing-safe), capture check, order-id match, amount match |
| Tax was computed on the wrong amount and hard-coded `"MH"` | Every out-of-state order took the wrong GST branch; tax was added instead of extracted | `lib/tax.ts` is the source of truth: inclusive extraction, `SELLER_HOME_STATE` from env |
| `/order/[id]` fell back to the **admin** API for visitors | Anyone with an order id saw full customer PII | Only reads the customer's own order; actionable empty state otherwise |

### Shipped — security

| Problem | Fix |
|---|---|
| No middleware: `/admin/*` and `/api/admin/*` open to the internet | `middleware.ts` requires a signed session for both; APIs get 401, pages redirect with `next` |
| Live Shiprocket email + password hard-coded as a fallback | Env only; clear error when unset |
| Medusa admin email + password hard-coded as a fallback | Env only; refuses to authenticate as a fixed account |

> **Still needs action:** those credentials were committed in `d8894ec` and
> remain in git history. Removing them from the working tree does not remove
> them from the repository. **Rotate the Shiprocket password and the Medusa
> admin password now**, then consider history rewriting if the repo is public.

### Shipped — UX

| Problem | Fix |
|---|---|
| Cart had no visible state; add-to-cart gave no lasting feedback | Live badge in the header, driven by a `svk:cart-changed` event |
| Checkout read as a wall of fields with no next step | Address first, then couriers, then one pay button — ordered the way the customer thinks |
| `saved` was required before any payment UI appeared, with no way to know that | Explicit "Continue to delivery details" link and a saved confirmation |
| Custom-art form collected dimensions and consent, then dropped them | Fields forwarded to the backend; consent and dimensions persisted |
| One URL flag (`?error=missing`) for all validation failures | Per-field errors via `useActionState`; minimum brief length, PIN and date checks |
| Commission status page was a dead end with a broken tracker | All 15 backend statuses mapped to an 8-step customer timeline; terminal states explained; brief echoed; mailto pre-filled with the reference |
| `/search` called `notFound()` with no query | Real search box with art-form shortcuts; zero-result state offers next steps |
| Account order rows had mismatched JSX (`</a>` closing a `<div>`) | Fixed; rows link to the order and to a return request |
| 404 used Tailwind tokens that do not exist (`ink`, `muted`) | Real tokens, sane height, useful links |
| `pnpm test` ran Playwright with no config and no tests | Vitest + 15 storefront tests; backend suite repaired to 26 passing |

---

## What is still missing

Ordered by what it would cost you if a real customer hit it.

### 1. Guest checkout has nowhere to land — **high**

`/order/[id]` now correctly refuses to show an order to someone with no session.
But guest checkout is the default path: a customer pays and has no account. The
confirmation page cannot show them their order, and nothing emails them.

- The order confirmation email does not exist. `FROM_EMAIL`, SES credentials,
  and the notification module are all wired, but nothing sends.
- Right now a guest who pays sees a page telling them to check an email that
  never arrives.

**Do this first:** make the completion route send a confirmation email (order
summary + a signed, expiring link to the order). That single piece turns the
guest path from broken to complete.

### 2. Commission attachments — **high**

The custom-art copy promises: *"Reference files are uploaded via a private,
short-lived signed URL."* There is no upload control. The media upload exists
for admin (`/api/admin/upload`), and the backend has `commission_attachment`
with a scan state, but a customer cannot send a reference.

This is the most visible gap between what the site claims and what it does. A
commission brief without a reference image is a much weaker brief.

### 3. Admin pages ship to the browser, then ask — **medium**

`app/admin/layout.tsx` is `"use client"` and checks the session in a `useEffect`.
The middleware now stops the data, but the HTML for each admin page still goes
out before the redirect. Two consequences:

- Admin pages are `force-dynamic` and always render a "Checking access…"
  spinner, so the admin feels slower than it is.
- Any future server-rendered admin content would leak before the check.

**Fix:** make the layout a Server Component that reads the session and renders
the nav server-side, with a small client island only for the mobile toggle. This
also lets each page fetch its data on the server instead of through
`useEffect` + `fetch`, which would remove most of the admin's loading states.

### 4. The admin has two sources of truth — **medium**

Some admin pages read Medusa's own API (`lib/admin.ts`), others query Postgres
directly (`pg` pools opened per request: refunds, tax, settings, returns). Each
`pg` helper opens a pool and calls `pool.end()`, which is expensive and will
exhaust connections under load.

Consolidate on one path — `lib/admin.ts` for Medusa resources, and one shared
pool for the custom tables.

### 5. No Playwright coverage — **medium**

`test:e2e` is still declared but unimplemented. The journeys that most deserve a
test are the ones that were broken: add to cart → checkout → pay (with a
Razorpay mock) → order confirmation, and commission submit → status page.

### 6. Smaller things worth doing

- **`artFormSlugs` and Medusa categories are two separate taxonomies.** `/shop`
  lists live categories, `/art-forms` lists the hard-coded slugs, and they can
  disagree. Decide which is authoritative and derive the other.
- **`PLATFORM_MODE` is read but barely used.** Only the settings page references
  it. In single-brand mode the "Sell" nav item and `/seller` should disappear.
- **`flushSync`-style coupling:** `addToCartAction` returns a message, but the
  header badge refreshes by event. If a page adds to cart without firing the
  event, the badge goes stale. Consider firing it inside the action itself.
- **Currency is hard-coded to `inr`** in several `formatPrice` fallbacks. If a
  second region is ever added this will silently mislabel prices.
- **`components/add-to-cart.tsx` and `components/product-options.tsx` duplicate
  add-to-cart logic.** One of them should use the other.
- **`.env.example` had no `SELLER_HOME_STATE` / `GST_RATE`.** Added — but real
  deployments need `SHIPROCKET_*` and `MEDUSA_ADMIN_*` set explicitly now that
  the fallbacks are gone.

---

## Suggested order

1. **Rotate the two leaked passwords.** Nothing else matters while they are live.
2. **Order confirmation email**, so guest checkout completes.
3. **Commission reference uploads**, so the commission flow matches its copy.
4. **Server-rendered admin layout**, to remove the spinner and the pre-check
   flash.
5. **Consolidate the admin data layer** on one path with one pool.
6. **Playwright for the two purchase journeys**, to stop the checkout
   regressions above from coming back.

---

## Verification, as run

```
apps/storefront   next build          ✓ compiles (was: Failed to compile)
apps/storefront   tsc --noEmit        ✓ clean
apps/storefront   vitest run          ✓ 15 passed
apps/backend      tsc --noEmit        ✓ clean
apps/backend      vitest run          ✓ 26 passed (was: 20 failing)
```

Not verified: any flow that needs a live Medusa, Postgres, Razorpay or
Shiprocket. The checkout, payment and shipment paths are correct by inspection
and by unit test of their pure logic, but they have not been exercised against
the real services.
