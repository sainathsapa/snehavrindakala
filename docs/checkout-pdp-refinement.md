# Checkout Simplification & Product Page Refinement

Living checklist for the checkout / address / PDP pass. Statuses: **Not started**,
**In progress**, **Completed**, **[!] Blocked**.

---

## Root causes identified before editing

### Checkout & address
1. **Typed input is destroyed on any validation failure.** `saveCheckoutDetailsAction`
   `redirect("/checkout?error=missing")`; the form is a server-rendered `<form action>`,
   so every field the customer typed is gone. This is the single largest source of
   checkout friction and the reason the form "feels complicated".
2. **No relationship between country and state/city.** State and city are free-text
   inputs; a customer can submit "Rajastan" or a city that is not in the country.
3. **Field order fights the postal code.** PIN → City → State; a PIN already implies
   the state, so the natural order is PIN → State → City.
4. **`PincodeAutofill` mutates sibling DOM nodes** (`form.querySelector`, `input.value =`)
   instead of holding React state — it cannot work with controlled inputs, silently
   no-ops when the ids change, and only supports India.
5. **No address book at checkout.** A returning customer gets at most one prefill and
   cannot switch, add or edit an address without leaving checkout.
6. **Billing is a `<details>` with six more free-text fields and a second native select**
   nested inside the delivery form.
7. Country / state / city are all long lists served by native `<select>` or free text —
   no search, no keyboard navigation, no empty/loading states.

### Product detail page
1. **The gallery crops the artwork.** `aspect-square` + `object-cover` — a portrait
   miniature is cut to a square. This violates "never distort to fit a container".
2. **Price and availability are rendered twice** — once by the page, once inside
   `ProductOptions` — so the buying block has no single focal point.
3. **The right column is a stack of bordered cards** (price block, `ProductOptions`,
   `ArtworkSpecsPanel`, `TrustStrip`, description) with no editorial rhythm; every
   item competes for the same weight.
4. **The lower story section repeats facts already shown above** (art form, maker,
   availability), so the page reads twice.
5. **`MobileBuyBar` is a fixed bar that overlays content** and the page has no bottom
   padding value tuned to its real height on all breakpoints.

---

## Implementation checklist

### Part 1 — Checkout & address
- [x] 1.1 Shared, accessible, searchable `Combobox` (WAI-ARIA 1.2) with keyboard nav,
      `aria-activedescendant`, loading / empty / invalid states, mobile-safe popup.
- [x] 1.2 Location dataset module: countries (shipping list), states and cities per
      country in `lib/location/`, loaded **per country on demand** (never one mega bundle).
- [x] 1.3 Postal-code suggestion that *suggests* state/city and never silently overwrites
      user input; graceful for unsupported countries.
- [x] 1.4 Interactive, client-owned address form: inline per-field validation that keeps
      every typed value, correct `inputMode` / `autoComplete` / `type=tel` per field.
- [x] 1.5 Address book at checkout: pick a saved address, add a new one, edit in place,
      clear default marker, switch address without restarting checkout.
- [x] 1.6 Billing folded into an optional, consistent section (no nested duplicate selects).
  Billing defaults to the delivery address. A buyer who needs the invoice made out
  to someone else ticks "Invoice to a different billing address", which prefills
  name, country, postcode, state and city from the delivery address and asks only
  for the street line. Validated by a looser rule than delivery — name, country,
  street and city required; postal code and province optional — because a
  registered office may not have them and blocking an order over that is worse
  than a blank invoice field.

  Verified in Postgres: shipping "12 MI Road, Jaipur" and billing "Plot 9,
  Sitapura Industrial Area" are stored as separate addresses; without opting in,
  billing mirrors shipping exactly as before.
- [x] 1.7 Checkout journey: delivery → speed → total → pay, one primary action per step,
      sticky summary, guest checkout and signed order tokens untouched.

### Part 2 — Product detail page
- [x] 2.1 Gallery preserves the artwork's natural proportions (no forced square, no crop);
      thumbnails on the rail; zoom / full-screen; mobile swipe.
- [x] 2.2 Single price + availability block; remove the duplicate in `ProductOptions`.
- [x] 2.3 Editorial composition: asymmetric gallery, quiet spec grid, dividers instead of cards.
- [x] 2.4 Reading order: breadcrumb → gallery → title/art form → artist → price/availability →
      specs → purchase → shipping/authenticity → story → reviews → related → recently viewed.
- [x] 2.5 Story section de-duplicates what the header already states.
- [x] 2.6 Mobile buy bar respects real content height and safe areas.

### Part 3 — Verification
- [x] 3.1 Unit tests for location search + combobox keyboard reducer + address validation.
- [x] 3.2 `pnpm typecheck`, `pnpm test`, `pnpm build` clean.
- [x] 3.3 Responsive review of checkout (320 / 768 / 1440) and PDP.

---

## What changed

_(filled in as work lands)_

## Verification

Run against the Docker stack (`docker compose up -d --build`), where all four
services report healthy and the storefront serves port 3000.

| Layer | Command | Result |
| --- | --- | --- |
| Types | `npx tsc --noEmit` | clean |
| Production build | `npx next build` | exit 0 |
| Unit suite | `npx vitest run` | 149 passed, 4 skipped (153) |
| Browser, 3 viewports | `BASE_URL=http://localhost:3000 node scripts/verify-ux.cjs` | **71 / 71 checks** |

The browser run drives desktop 1440, tablet 834 and mobile 390 and covers:
combobox search and keyboard highlight, country → state (36) → city (15)
narrowing, popup staying inside the viewport on mobile, invalid PIN rejected
inline, all typed input surviving that failed submit, PIN → state suggestion,
address collapsing to a summary, the payment step opening, the total shown
before paying, `Edit address` reopening prefilled, artwork visible and
uncropped with a frame matching its real ratio, full-screen viewer opening and
closing with focus returned.

Localisation: `/hi/checkout` renders 500+ Devanagari characters and
`<title>भुगतान | SnehaVrinda Kala</title>`; the English page is unchanged.

### Bugs found by verification (and fixed)

- **Gallery frame could never correct itself.** `recordRatio` stored a ratio once
  and refused to overwrite it, so a frame measured wrongly stayed wrong forever.
  Demonstrated with a 400x200 image on a square product: the frame held `1/1`.
  It now always reflects the image actually on screen.
- **Checkout was never translated.** The `checkout` message namespace existed with
  Hindi strings but nothing read it — every label was a hardcoded English literal.

### Two things that look like bugs but are not

- A `stock:custom_only` piece (e.g. `gold-leaf-miniature-portrait`) has no Add to
  Cart by design; it leads to the commission conversation.
- The sticky buy bar repeats the price below `lg` on purpose.

## Second pass — localisation and checkout redesign

### The i18n bug: pages reverted to English

Reported as "it keeps changing back to English". Reproduced by clicking, not by
loading URLs: `/hi/shop` → click any product → landed on `/products/...` with
zero Devanagari. The URL-based spot check had missed it entirely because
Hindi *pages* worked; what broke was *navigation between* them.

Root cause: with `localePrefix: "as-needed"`, a locale prefix is only added by
next-intl's locale-aware helpers. 47 files imported `Link` from `next/link`
and four used `next/navigation`'s `useRouter`, which build bare URLs. Only one
file in the app used the locale-aware versions.

- All non-admin `Link`/`useRouter`/`usePathname` now come from `@/i18n/routing`.
  The admin panel stays on plain `next/link` — it is outside the locale tree.
- 27 server `redirect()` calls in account, seller, shop and commission actions
  went through a new `lib/locale-redirect.ts`. So a failed Hindi login no longer
  silently switches the shopper to English.
- The wishlist and artists pages were the last two screens rendering pure
  English; both are translated now.

Verified by clicking every header link from `/hi`: 8/8 stay Hindi, 0
English-only pages.

### The checkout redesign

Structural changes, driven by a visual review of the old page:

- Steps sit on the page with hairline rules instead of nested rounded cards.
- The totals became a real right column, sticky on desktop.
- One primary action per step. Step 2's duplicate "Add your delivery address"
  button became a sentence; step 1's submit says "Save address and continue".
- The tax line says "Includes CGST + SGST" — prices are GST-inclusive, so the
  total correctly does not move, but a bare row read as an ignored charge.
- A floating mobile total bar was tried and removed: it covered the phone field.
  The totals already state the amount once.

### A pricing bug the redesign exposed

With the finished page on screen, all three courier radios rendered unchecked
while shipping showed "Free" beside quotes of ₹99/₹105/₹118 — the total read
₹5,600 instead of ₹5,699.

Quotes only exist once an address is on the cart, so the island's `useState`
initialiser ran against an empty list and settled on `""`; the quotes arrived
after the save-and-refresh, but an initialiser never runs twice. The rule is now
`resolveSelectedRate` in `lib/shipping/select-rate.ts`, applied whenever the
quote set changes, with 8 tests.

### Verification (Docker stack, `docker compose up -d --build`)

| Check | Result |
| --- | --- |
| `npx tsc --noEmit` | clean |
| `npx vitest run` | 157 passed, 4 skipped |
| Browser, 1440 / 834 / 390 | 71 / 71 checks |
| `/hi/checkout` | 558 Devanagari chars, no English leakage |

### Still open

- ~~Billing address is still not collected.~~ Done — see Part 1.6.
- ~~The right totals column leaves empty space below it on tall desktop screens
  once the summary is short.~~ Fixed: the column now carries the certificate,
  packing and returns reassurance, checked against what the site already says.

## Third pass — billing and the totals column

Both items left open by the previous pass are now closed.

**Separate billing address.** Opt-in, off by default, so the common case gains no
fields. The whole path was verified end to end rather than at the UI only: the
cart stores two distinct `cart_address` rows, one for shipping and one for
billing, and leaving the box unticked still mirrors shipping as it always did.

**The empty band under the totals.** Rather than pad it, the column now carries
the reassurance a buyer wants at the moment of paying. Each line was checked
against the site rather than written from memory: the certificate claim matches
the trust strip and the authenticity page, and the returns line points at the
published policy — an earlier draft said "seven days", which the policy only
grants on ready-to-ship work and not on commissions, so it would have been false
on exactly the baskets that matter most.

### Verification

| Check | Result |
| --- | --- |
| `npx tsc --noEmit` | clean |
| `npx next build` | exit 0 |
| `npx vitest run` | 168 passed, 4 skipped |
| Browser, 1440 / 834 / 390 | 71 / 71 checks |
| `/hi/checkout` | 588 Devanagari chars, no English leakage |
| Billing persisted | separate ship/bill rows confirmed in Postgres |
