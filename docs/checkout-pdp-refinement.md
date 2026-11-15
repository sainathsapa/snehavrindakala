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
- [ ] 1.1 Shared, accessible, searchable `Combobox` (WAI-ARIA 1.2) with keyboard nav,
      `aria-activedescendant`, loading / empty / invalid states, mobile-safe popup.
- [ ] 1.2 Location dataset module: countries (shipping list), states and cities per
      country in `lib/location/`, loaded **per country on demand** (never one mega bundle).
- [ ] 1.3 Postal-code suggestion that *suggests* state/city and never silently overwrites
      user input; graceful for unsupported countries.
- [ ] 1.4 Interactive, client-owned address form: inline per-field validation that keeps
      every typed value, correct `inputMode` / `autoComplete` / `type=tel` per field.
- [ ] 1.5 Address book at checkout: pick a saved address, add a new one, edit in place,
      clear default marker, switch address without restarting checkout.
- [ ] 1.6 Billing folded into an optional, consistent section (no nested duplicate selects).
- [ ] 1.7 Checkout journey: delivery → speed → total → pay, one primary action per step,
      sticky summary, guest checkout and signed order tokens untouched.

### Part 2 — Product detail page
- [ ] 2.1 Gallery preserves the artwork's natural proportions (no forced square, no crop);
      thumbnails on the rail; zoom / full-screen; mobile swipe.
- [ ] 2.2 Single price + availability block; remove the duplicate in `ProductOptions`.
- [ ] 2.3 Editorial composition: asymmetric gallery, quiet spec grid, dividers instead of cards.
- [ ] 2.4 Reading order: breadcrumb → gallery → title/art form → artist → price/availability →
      specs → purchase → shipping/authenticity → story → reviews → related → recently viewed.
- [ ] 2.5 Story section de-duplicates what the header already states.
- [ ] 2.6 Mobile buy bar respects real content height and safe areas.

### Part 3 — Verification
- [ ] 3.1 Unit tests for location search + combobox keyboard reducer + address validation.
- [ ] 3.2 `pnpm typecheck`, `pnpm test`, `pnpm build` clean.
- [ ] 3.3 Responsive review of checkout (320 / 768 / 1440) and PDP.

---

## What changed

_(filled in as work lands)_
