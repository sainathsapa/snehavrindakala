# SnehaVrinda Kala — Product Experience Upgrade: Master Checklist

Living document. Update as work progresses. Statuses: **Not started**, **Completed**, **[!] Blocked**.

---

## Phase 1 — Critical reliability (purchase journey)

### 1.1 Guest order confirmation via signed token — **Completed**
- What: `/order/[id]` must render the order for a guest when a valid `?t=<token>` is present.
- Why: A paid guest currently hits a "we can't show this" dead end.
- Files: `app/[locale]/order/[id]/page.tsx`, `lib/order-token.ts` (exists), `lib/medusa.ts`.
- Deps: `issueOrderToken` already called in `checkout/complete/route.ts`.
- Acceptance: `/order/<id>?t=<valid>` shows items/total for no-session; tampered/expired token → friendly refusal; no PII leak without token.
- Status: **Completed** (token branch added; verify rejects bad/expired).

### 1.2 Reliable confirmation email — **Completed (verified by inspection + graceful degradation)**
- What: completion route already calls `sendOrderConfirmation`; ensure failures never break order and are logged.
- Acceptance: missing email / transport → order still completes; returns boolean.
- Status: **Completed** (existing behaviour confirmed; no regression).

### 1.3 Confirmation states & next steps — **Completed**
- What: paid order page shows success banner, "what happens next" timeline, shipping expectations.
- Files: `app/[locale]/order/[id]/page.tsx`.
- Acceptance: success banner present; timeline shown; returns/track links reachable.
- Status: **Completed**.

### 1.4 Payment failure / cancellation recovery — **Completed**
- What: Razorpay cancel/fail keeps cart, offers retry, clear message.
- Files: `components/razorpay-checkout.tsx`, `components/checkout-client.tsx`.
- Acceptance: cancel → cart preserved, retry offered; failed → clear message.
- Status: **Completed** (existing cancel/fail handled; verified copy + retry).

### 1.5 Courier quote failure + out-of-stock during checkout — **Completed**
- What: explicit banner when no courier quote; block pay if stock fails.
- Files: `components/checkout-client.tsx`, `app/[locale]/checkout/page.tsx`.
- Acceptance: no-quote state explanatory; checkout surfaces error from completion.
- Status: **Completed** (no-quote copy present; completion error surfaced).

---

## Phase 2 — Product experience

### 2.1 Structured product attributes (dimensions, medium, framing, year, edition, dispatch, care) — **Completed**
- Read from `key:value` tags (`dimensions:`, `medium:`, `framing:`, `year:`, `edition:`, `care:`, `dispatch:`) via `specsFromProduct`; dispatch falls back to a truthful stock-type phrase.
- Files: `lib/catalogue.ts`, `components/artwork-specs-panel.tsx`. Acceptance: absent values never render; no invented data.
- Status: **Completed**.
### 2.2 PDP premium layout: gallery zoom, spec panel, story, trust strip — **Completed**
- Full-screen lightbox gallery (keyboard: Esc, ←/→), thumbnail rail, spec panel, trust strip, dispatch line, "commission a similar piece".
- Files: `components/product-gallery.tsx`, `components/trust-strip.tsx`, `app/[locale]/products/[handle]/page.tsx`.
- Status: **Completed** (build + typecheck verified).
### 2.3 Wishlist (persistence, merge after login, page, empty state) — **Completed**
- Persistent in localStorage for guests and signed-in users on the same browser; header count; `/wishlist` page with empty state and add-to-cart.
- Files: `lib/wishlist-store.ts`, `lib/hooks/use-wishlist.ts`, `components/wishlist-button.tsx`, `components/wishlist-link.tsx`, `app/[locale]/wishlist/page.tsx`, `app/api/store/product-variant/route.ts`.
- Tests: 13 passing in `wishlist-store.test.ts`.
- Signed-in customers also get a server copy (`customer_wishlist`, keyed by Medusa customer id) so the list follows them across devices. Merging is a union on mount — a stale tab cannot delete what was saved elsewhere — and guests are never written to the server. Removals are explicit and replace the stored list. Covered by `tests/wishlist-store.test.ts`.
### 2.4 Verified-purchaser reviews (submit, moderation, accurate counts) — **Completed**
- Backend `review` module: DML entity + migration + service (public list, approved-only summary, duplicate guard, moderation). Store API `GET/POST /store/reviews` verifies purchase against the order module (fail-closed) and queues every review as `pending`.
- Storefront: PDP review section (rating summary + list + sign-in-gated form via server action), `StarRating`, `/api/admin/reviews` moderation routes, `/admin/reviews` queue, nav entry.
- Files: `apps/backend/src/modules/review/*`, `apps/backend/src/api/store/reviews/route.ts`, `apps/storefront/components/product-reviews.tsx`, `components/star-rating.tsx`, `app/[locale]/products/[handle]/review-actions.ts`, `app/api/admin/reviews/*`, `app/admin/reviews/page.tsx`, `lib/medusa.ts` (listReviews/submitReview).
- Tests: 8 backend (`review-service.test.ts`); ratings only ever shown when approved reviews exist.
- Limitation: purchase verification relies on the order module being wired; when it is not, reviews are unverified (never fabricated).
### 2.5 Related artworks + recently viewed — **Completed**
- Files: `components/relative-artworks.tsx`, `components/recently-viewed.tsx`.
- Status: **Completed**.

## Phase 3 — Discovery
### 3.1 Shop sort (newest, price) + filters (price, form, medium, availability) — **Completed**
### 3.2 Active filter indicators, result counts, clear-all, empty state — **Completed**
### 3.3 Mobile filter drawer — **Completed**
- Files: `lib/shop-filters.ts`, `components/shop-controls.tsx`, `app/[locale]/shop/page.tsx`, `app/[locale]/shop/[category]/page.tsx`, `tests/shop-filters.test.ts`.
- State lives in the URL (shareable, server-filtered). Empty-result state offers "clear filters".
- Tests: 8 passing in `shop-filters.test.ts`.
### 3.4 Taxonomy consistency (Medusa categories ↔ art-forms) — **Completed (form chips derived from live catalogue)**
- Filter chips are built from the collections actually present in the catalogue, so a chip never leads to an empty shelf.

## Phase 4 — Commission
### 4.1 Reference uploads (signed URLs, size/type limits, progress) — **Completed (private filesystem storage; signed-URL/S3 not used — project uses a local volume)**
- `/api/store/commission-upload` writes to `MEDIA_ROOT/commission-private` (the project's real storage: filesystem + `storefront_media` docker volume, not S3 — confirmed). Files are private, served only via an admin-guarded path later. Keys travel as JSON in a hidden form field; backend persists `commission_attachment` rows.
- Files: `app/api/store/commission-upload/route.ts`, `lib/commission-upload.ts`, `components/commission-form.tsx`, `app/[locale]/custom-art/actions.ts`, `lib/medusa.ts`, `apps/backend/src/api/store/commissions/route.ts`.
- Tests: 10 passing in `tests/commission-upload.test.ts`.
- Note: no malware scan pipeline wired (no scanner in the codebase); files are stored privately and staff-reviewed.
### 4.2 Improved brief (dimensions, medium, budget, deadline, occasion) — **Completed**
- Added "What is it for?" occasion/intended-use selector (maps to existing `intended_use`), kept dimensions/budget/deadline/PIN.
- Status: **Completed**.

## Phase 5 — Artistic experience & navigation
### 5.1 Homepage three-journey hierarchy refinement — **Not started** (existing hierarchy judged sound; no churn)
### 5.2 Navigation: currency/language visibility, breadcrumbs — **Completed (breadcrumbs)**
- PDP now shows a visible `Home / Shop / Category / Title` breadcrumb (`<ol aria-current>`) mirroring the existing JSON-LD trail. Currency/language switchers were already labelled in the mobile sheet — deliberately left in place.
### 5.3 Mobile-first pass (sticky PDP action, filter drawer, targets) — **Completed (sticky PDP action)**
- `components/mobile-buy-bar.tsx` pins price + primary action (add to cart / view cart / request commission) to the bottom of the viewport on `lg:hidden`; shares `useAddToCart`; PDP gets `pb-24 lg:pb-10` so content is never covered. Filter drawer and touch targets were delivered in Phase 3.
### 5.4 Editorial/journal → product linking — **Completed (verified existing)**
- Journal post footer already routes into Art Forms, Learn and Shop; no schema change needed.

## Phase 6 — Ops, a11y, performance, production
### 6.1 Admin: product attributes, review moderation — **Completed (review moderation)**
- `/admin/reviews` moderation queue with approve/reject; nav entry under Products.
### 6.2 Accessibility audit (focus, contrast, listbox semantics) — **Completed**
- Search dropdown: proper `combobox`/`listbox`/`option` roles, `aria-expanded`/`aria-controls`/`aria-autocomplete`, `aria-selected` highlight, and full keyboard nav (ArrowUp/Down with wrap, Enter opens highlighted result, Escape closes). Logic extracted to `lib/search-keyboard.ts` with 10 tests.
- Fixed a real bug: search-result price was `₹${price/100}` (hardcoded rupee + wrong unit); now uses `formatPrice(price, currency)`.
- Focus rings upgraded from `focus:` to `focus-visible:` on header/mobile search; mobile buy bar respects `env(safe-area-inset-bottom)`.
- Contrast verified against tokens: muted-ink 6.07:1, deep-ink 13.16:1, terracotta 4.58:1, kumkum 9.28:1 on rang-paper — all meet WCAG AA (terracotta at the 4.5 line for normal text).
- Existing `aria-pressed` toggles (wishlist, filters) and `aria-expanded`/`aria-controls` drawer already correct.
### 6.3 Regression: typecheck, lint, tests, build — **Completed**
- Storefront typecheck ✓, **423 tests pass (4 skipped) across 44 files**, build ✓. Backend typecheck ✓, 90 tests pass. (Counts corrected: this line read 97/49 for several months after both suites grew, which is the kind of stale number that makes a green run look reassuring when nothing has been checked.)
### 6.4 Production readiness notes — **Completed**
- Reviews fail closed (unverified when order module absent; never fabricated). Ratings render only from approved reviews. Search degrades to an empty list on backend error; PDP reviews render nothing if the fetch fails.


### 6.5 Honesty pass: things the site claimed without evidence — **Completed**
- **The picture is not always the work.** 15 of 19 listings carried a generated
  illustration. The PDP now says so and `/admin/products` marks `Stand-in photo`;
  replacing the file removes the disclosure automatically.
- **The size was never measured.** Dimensions came from the seed script and were
  copied onto certificates. Certificates now print a size only when the order
  item carries `measured:yes`; the PDP labels it "as stated by the studio, not yet
  measured". `docs/PHOTO-AND-MEASUREMENT-BRIEF.md` lists all 19 works.
- **Honest empty states.** `/admin/outbox` shows messages that never left, with
  the reason (`no-transport`, `transport-error`), read-only by design.
- **The art-form essays existed only in the header.** `story`, `origin`,
  `materials`, `quote` were 0 characters in all six rows in both languages; the
  seed now writes them and the backfill fills existing rows. "Origin" renamed
  "Regions & traditions covered", because the field mixes places and traditions.
- **One dye, two names.** `हरड़` (harad) settled with `हरदा` (harda) given
  alongside and the botanical name *Terminalia chebula*.
- **The scheduled job has a caller.** A `cron` compose service posts to
  `/api/cron/cart-reminders` with `CRON_SECRET` in a header; a crontab line in a
  doc was a step that got skipped.
- **Settings that never reached a container.** The storefront service block was
  missing `CRON_SECRET`, `FROM_EMAIL`, `AWS_SES_*`, `SHIPROCKET_BASE_URL`,
  `REFUND_APPROVAL_THRESHOLD`, `ABANDONED_CART_HOURS`, `PLATFORM_MODE`,
  `STOREFRONT_BASE_URL` and the generated webhook secrets; each fell back to a
  default while looking configured. `tests/deployment-env.test.ts` walks every
  `process.env` read and requires it in the service block whose code reads it.
- **The Razorpay provider switch is built and off.** `CHECKOUT_RAZORPAY_PROVIDER=1`
  opts in, needs keys *and* the webhook secret, and logs a fallback when it is set
  but incomplete. Both checkout routes now agree on one provider, so no cart can
  get a second payment session.
- **Off-site backups have a hook.** `scripts/offsite-push.sh` verifies gzip,
  never overwrites at the destination, and says "not configured" out loud; the
  nightly `backup` service calls it. The destination is still infrastructure.

### 6.6 Known limits, stated rather than scheduled away — **Open, by design**
- Static rendering (ADR-0005) is deferred with a measurable trigger, not dropped.
- Checkout still runs on `pp_system_default`; the Razorpay provider path needs one
  sandbox purchase before the flag goes on.
- The sold-work guard is a check, not a reservation: two simultaneous payers can
  both pass it. Inventory reservations at add-to-cart are the fix.
- Shipping falls back to ₹0 when the Shiprocket quote fails.
- Admin uploads write to local disk (`app/api/admin/upload/route.ts` says so).
- Real photographs, dimensions, maker bios, SES credentials and the Razorpay
  webhook secret are owner/ops input. No code can supply them.

---

## Verification log
- Baseline `pnpm --filter @snehavrinda-kala/storefront run typecheck` at `d25ece7`: **pass**.
