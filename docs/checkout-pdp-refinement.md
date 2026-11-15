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
  **Not done:** billing is not shown at all. The old page rendered a second full
  address block for billing; rather than duplicate two combobox grids the checkout
  now collects delivery only, which matches how a gallery despatches and what
  Razorpay needs. Revisit if invoices must carry a separate billing address.
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
