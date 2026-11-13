# SnehaVrinda Kala — Design System

The visual language of the storefront and admin panel. It is derived from the
two brand reference designs (`ref.png`, `ref2.png`) and is the single source of
truth for colour, type, spacing and composition. When a screen and this document
disagree, the document wins — or the document gets updated deliberately.

The concept: **an editorial Indian art house.** Parchment ground, deep brown ink,
burgundy accents, and real artwork doing most of the visual work. Chrome stays
quiet so the art carries the page. This is deliberately *not* generic SaaS: no
bluish-grey neutrals, no neon, no drop-shadow-heavy cards.

More precisely — and this is the test to apply to any new screen — it should
read like **an artist's own site that happens to sell**, not a storefront that
happens to have art in it. Section §15 is the operative rule; everything else
serves it.

---

## 1. Colour

All colours live in three places that must stay in sync:

| Layer | File |
|---|---|
| CSS variables (for `hsl(var(--x))` utilities) | `apps/storefront/app/globals.css` |
| Tailwind palette (`bg-kumkum`, `text-deep-ink`, …) | `packages/config-tailwind/index.js` |
| JS tokens (used by `packages/ui`) | `packages/ui/src/tokens.ts` |

### Surfaces

| Token | Hex | Use |
|---|---|---|
| `rang-paper` | `#F8EBDD` | The page canvas. Every default background. |
| `surface` | `#FFF7EC` | Cards, inputs, panels that sit *on* the canvas. |

### Text

| Token | Hex | Use |
|---|---|---|
| `deep-ink` | `#42170F` | All primary text and headings. A deep brown, never pure black. |
| `muted-ink` | `#6B5347` | Secondary text, captions, eyebrow labels on light. |

Text on dark bands uses `rang-paper` (and `rang-paper/75` for secondary), never
white — pure white reads cold against this palette.

### Accents

| Token | Hex | Use |
|---|---|---|
| `kumkum` | `#7B1019` | **Primary action.** Filled buttons, active nav, the cart badge. |
| `sindoor` | `#8F201D` | Hover/emphasis for primary elements, validation errors. |
| `terracotta` | `#B74620` | Eyebrow labels, secondary links, section rules. |
| `marigold` | `#E6A72E` | Optimistic highlights, campaign accents. |
| `haldi` | `#F0C45B` | Warm feature blocks, gold line art on dark. |
| `peacock` | `#176D6A` | Trust / availability (“in stock”, verified). |
| `indigo` | `#263A63` | Deep section and footer grounds. |
| `leaf` | `#557447` | Nature and craft accents. |
| `gulabi` | `#D98291` | Soft decorative accent. |

### Borders

| Token | Hex | Use |
|---|---|---|
| `sand-border` | `#E2CFB6` | Every divider and hairline. Usually at reduced opacity (`/60`, `/70`). |

### Rules

- **One accent per element.** A burgundy button does not also get a gold border.
- **Dark bands are rare and deliberate** — the craft banner and the footer only.
  Their text is `rang-paper`, their decoration `haldi/20`.
- **Never introduce a new hex.** If a screen needs a colour that does not exist
  above, add it here and to all three files in the same change.

---

## 2. Typography

| Role | Family | Token |
|---|---|---|
| Display & headings | Cormorant Garamond (serif) | `font-serif` |
| Body, nav, labels, buttons | Manrope (sans) | `font-sans` |
| Devanagari (only after language review) | Noto Sans Devanagari | `font-devanagari` |

The serif is high-contrast and editorial; the sans is quiet and mechanical.
**Headings are always serif. UI text is always sans.** No exceptions — mixing
them is what makes a page look assembled rather than designed.

### Scale

| Token | Size | Line height | Use |
|---|---|---|---|
| `display-xl` | 3.75rem | 1.1 | Hero headline (desktop) |
| `display-lg` | 3rem | 1.15 | Page titles |
| `display-md` | 2.25rem | 1.2 | Section headings |
| `display-sm` | 1.75rem | 1.25 | Sub-section headings |
| `body` | 1rem | 1.6 | Paragraphs |
| `small` | 0.875rem | 1.5 | Card copy, footer links |
| `caption` | 0.75rem | 1.4 | Eyebrows, meta, breadcrumbs |

### Details

- **Eyebrow labels** are `font-sans`, 11px, `font-semibold`, uppercase,
  `tracking-[0.22em]`, in `terracotta` (on light) or `haldi` (on dark).
- **Hero headline** breaks across three lines and is set at `leading-[1.05]`
  with `tracking-tight`. It is the largest thing on any page by a wide margin.
- **Italic serif** is reserved for the hero tagline (“Explore. Experience. Own.”)
  and pull quotes. Nowhere else.

---

## 3. Space and layout

- Content max width: **1400px** (`max-w-[1400px]`), with `px-5` on mobile,
  `sm:px-8`, `lg:px-12`.
- Section rhythm: `py-14` mobile, `lg:py-20` desktop. Sections are separated by a
  `border-sand-border/60` hairline, not by shadow or background change.
- Editorial sections use a **two-column intro grid**:
  `lg:grid-cols-[300px_1fr]` — the heading column on the left, content on the
  right. This is the signature layout from the references.
- Grids of artwork: 5-across on desktop, 3 on tablet, 2 on mobile.
- Spacing scale is fixed at 4/8/12/16/20/24/32/40/48/64/80/96. Do not use
  arbitrary values for layout gaps.

---

## 4. Components

### Buttons

- **Primary** — filled `bg-kumkum`, `text-rang-paper`, `rounded-full`, px-7 py-3.5.
  Hover → `bg-sindoor`. One per view region.
- **On dark** — filled `bg-rang-paper`, `text-kumkum`. Hover → `bg-white`.
- **Secondary** — text link with a trailing `→`, no container. See `ArrowLink`.

Buttons are pills (`rounded-full`). Cards and surfaces are nearly square
(`rounded-sm` / `rounded-lg`). That contrast is intentional.

### Arrow links

`ArrowLink` in `components/ornaments.tsx` — `text-kumkum` on light,
`rang-paper` on dark, with the arrow translating 4px on hover. This is the
default secondary action; do not invent another.

### Section intro

`SectionIntro` — eyebrow, short 40px rule, serif heading, optional description.
Takes `tone="light"` for dark grounds.

### Botanical rule

`BotanicalRule` — the orange sprig plus vertical hairline that opens editorial
sections. Purely decorative, always `aria-hidden`.

### Artwork tiles

Art-form artwork is **contained** (`object-contain`) inside a square, never
cover-cropped: the source SVGs range from 600×140 to 700×700 and carry their own
titles, so cropping slices the lettering apart. Card copy sits below the image on
its own surface.

### Header

88px tall, sticky, `bg-rang-paper/95` with backdrop blur. Three flex regions —
brand cluster (sprig, lotus mark, wordmark + tagline), centred nav, utility icons
— that cannot collide. Search collapses to an icon-width field that widens on
focus. Cart badge is an overlay on the bag and shows **zero**, not just non-zero.

### Footer

Parchment ground, four link columns, a newsletter block with consent on its own
line, and a hairline bottom bar. No dark footer — the craft banner is the only
dark band above it.

---

## 5. Icons

All icons come from `packages/ui/src/icons.tsx`:

- 24×24 viewBox, stroked, `strokeWidth={1.75}`, `fill="none"`, `currentColor`.
- `aria-hidden="true"`; the surrounding link or button carries the label.
- `IconName` is a closed union — adding an icon means adding it to the union
  *and* the `ICONS` record, so a typo fails typecheck instead of rendering
  nothing.
- Every path is validated to stay inside the viewBox. An icon whose coordinates
  leave the canvas renders as a stray mark, which is how the old set broke.

---

## 6. Motion

- Transitions are 200ms for colour, 500ms for image opacity.
- Hover on artwork: `opacity-90` on the image and the title shifting to
  `kumkum`. **No `scale-105`** — a painting does not zoom when you look at it.
- No entrance animations, no parallax. The page should feel printed.

See §18 for the full motion rules and the reduced-motion contract.

---

## 7. Accessibility

- Body text meets WCAG AA against both parchment and dark grounds.
- Every interactive element has a visible focus ring (`focus:ring-1
  focus:ring-kumkum/40`, or `focus-visible` outline for links).
- Decorative imagery (`role="presentation"`, art-form swatches, backgrounds) is
  `alt=""` + `aria-hidden`. Meaningful artwork carries a real description.
- Exactly one `<h1>` per page; headings never skip a level.
- Never rely on colour alone — active nav also changes weight, errors include text.

---

## 8. Checklist before shipping a screen

1. Is the ground `rang-paper` and text `deep-ink`? (Not white/black.)
2. Are headings serif and all UI text sans?
3. Is there **one** primary burgundy action?
4. Does the section open with an eyebrow + rule when it is a top-level section?
5. Are hairlines `sand-border` at reduced opacity, not grey?
6. Does artwork sit on its own surface without being cropped past recognition?
7. Does it hold up at 390px, 834px and 1440px, with **no horizontal overflow**
   (`scrollWidth <= clientWidth`)? §17.
8. Do focus states exist and is every heading level correct?
9. Does every work name its artist? §15.
10. Would this element be at home on a gallery wall — or does it look like a
    D2C product tile (box, shadow, badge, zoom-on-hover)? §15.
11. Is any control visible that does not work? (The slider once was. §16.)
12. Did you add a colour that is not in this document? Add it to all three
    token files, or don't add it.

---

## 9. Imagery

Artwork is the interface. Nothing else should compete with it.

- **Art-form tiles** are square, photographic, and `object-cover`. Six files live
  in `public/images/artforms/<slug>.jpg`, one per taxonomy slug. They replaced an
  older set of SVG "artwork" that had titles drawn *into* the image, which no
  amount of card styling could rescue — the lettering scaled with the artwork and
  collided with page copy.
- **Product imagery** lives in `public/images/products/`, served through
  `next/image` so it is resized and converted per breakpoint.
- All raster art is exported at **900px on the long edge, quality ~78**. The
  original 1.3MB generations were served directly and made `/shop` take 9.9s to
  paint; the same page is now 22ms.
- Use `next/image` (`fill` + `sizes`) for anything inside a layout grid. A bare
  `<img>` in a grid will ship the full file to every card.
- Decorative background art carries `alt=""` and `aria-hidden`; artwork with a
  name carries a real `alt`.

## 10. Data-backed UI

Two rules that keep the storefront honest when the catalogue is thin:

- **Seed data supplements, never replaces, live data.** The sample catalogue in
  `data/products.ts` is merged with Medusa results and deduped by handle. A
  strict either/or fallback meant that one seeded product hid the entire sample
  set and five collections rendered empty.
- **Money is always minor units.** `formatPrice` divides by 100. Seed prices are
  authored in whole rupees and converted once in `lib/catalogue.ts`. Forgetting
  this shipped `₹2,200` as `₹22`.
- **Never render a dead action.** Seed items have no Medusa variant, so their
  detail page shows the work read-only and points at the live collection and
  custom commissions instead of an "Add to cart" button that cannot work.

## 11. Navigation menus

`Discover` and `Art Forms` open real menus, built on the server in
`app/layout.tsx` and passed to the header.

- State-driven, not CSS `:hover` — hover menus cannot be reached by keyboard or
  touch.
- Close on `Escape`, on outside click, and on route change.
- `aria-expanded` + `aria-controls` on the trigger; the panel is a `ul` of links.
- On mobile the sub-links are listed inline under their parent instead of behind
  a toggle — an extra tap to reveal five links is friction for no gain.

## 12. Decorative motifs

Four shared marks carry the hand-made language. All live in
`components/ornaments.tsx`; use these rather than drawing new ones per page.

| Motif | Component | Where |
|---|---|---|
| Sprig + vertical rule | `BotanicalRule` | Opens editorial sections |
| Kalam loop border | `KalamBorder` | Hairline under the header, above the footer, bottom of artwork bands |
| Paisley field | `PaisleyField` | Faint watermark behind listing grids (`text-terracotta/[0.05]`) |
| Mandala rosette | `MandalaField` | Over dark bands and the burgundy panel (gold at `/15`–`/25`) |

Rules: every one is `aria-hidden` and purely decorative. Backgrounds stay at or
below 7% opacity on parchment and 25% on dark, so they never compete with text
or artwork. None of them animate.

## 13. Admin-managed content

Hero slides, art forms and featured categories are **editorial, not derived**.
They are stored in Postgres (`lib/site-content.ts`) and edited only at
`/admin/content`.

- Tables: `site_hero_slide`, `site_art_form`, `site_featured_category`. Each has
  `position` for ordering and `published` for visibility.
- `ensureSeeded()` creates and seeds them once. Seeding only runs on an **empty**
  table, so a redeploy never overwrites admin edits.
- Public reads fall back to the built-in defaults if Postgres is unreachable, so
  the homepage always renders.
- Writes `revalidatePath("/")`, `/art-forms` and `/admin/content`, so an edit
  appears on the storefront immediately.
- The nav menus are built from the same rows, so renaming an art form in the
  admin updates the header too.

## 14. No admin links in the storefront

The admin panel must never be linked from the public site. `/admin` is not in
the header, footer or any page body — operators navigate to it directly, and the
middleware gates it. Do not add a shortcut "for convenience"; the panel is
CRM-adjacent and exposing a door to it invites probing.

Related: `Artists` and `Sell` are `platformOnly` and are hidden entirely in
single-brand mode, where the house is the only seller and both would be dead
ends.

## 15. It is an artist's site, not a shop

This is the rule that overrides the others. SnehaVrinda Kala is an art house
with a store attached, not a store with art in it. When a layout decision is
ambiguous, resolve it the way a gallery or an artist's own site would, not the
way a D2C ecommerce template would.

What that changes in practice:

**Works are plates, not cards.** `ProductCard` has no border, no shadow, no
rounded container, no hover scale, and no badge overlay. The image sits on
parchment inside a hairline `ring-sand-border/50` frame at `aspect-[4/5]`, and
the caption below is separated by a thin rule — the visual grammar of a wall
label: title, artist (italic), then availability and price on one quiet line.
Interaction is an opacity step (`group-hover:opacity-90`) and the title
shifting to `kumkum`. That is all.

**The maker comes before the price.** Every listing names its artist. A caption
that says only a title and a number is incomplete.

**Pages open as mastheads.** `components/page-header.tsx` (`PageHeader`) is the
shared interior header: breadcrumb, eyebrow, large serif title, one line of
intent, optionally with artwork bleeding behind a dark gradient. Shop, Art
Forms, Commission, About, Artists and the Journal all use it, so no page
invents its own heading block. Pass `image` for a full masthead; omit it for a
quiet parchment one.

**Editorial bands outrank merchandising bands.** The homepage runs hero →
statement → frieze → art forms → craft journey → selected works → artist in
focus → feature strip → commission → closing. Only one band is a product grid,
and even that is a gallery wall (one large plate, smaller plates beside it),
not four identical tiles.

**The artist is a section.** The "Artist in focus" band pairs a portrait with a
short first-person quote and an entry to `/artists`. This is the single
strongest signal that the site belongs to makers rather than to a warehouse.

**Copy is written, not labelled.** "From the studio", "The hands behind the
work", "Notes from the studio", "Five stages, nothing hidden". Never "Shop
now", "Best sellers", "Add to bag" outside the cart flow itself.

### What to avoid

- Sale banners, countdowns, urgency badges, star ratings, "X people viewing".
- Best-seller rows, related-product carousels, recently-viewed strips.
- Card shadows (`shadow-lifted`, `hover:shadow-md`) on anything that is not an
  overlay or a menu.
- Gradient buttons, icon-only primary actions, stacked tag pills.
- Empty-state copy about the *system* ("Connect the Medusa backend"). Empty
  states speak about the *collection*: "Nothing in this collection just yet."

---

## 16. The hero slider

`components/hero-slider.tsx` renders the admin-managed `site_hero_slide` rows
as a real carousel.

- Every slide is mounted and cross-faded with `transition-opacity duration-700`
  rather than swapped, so the artwork never flashes and the layout never jumps.
  Inactive slides carry `pointer-events-none` and `aria-hidden`.
- Auto-advance is 7s. It pauses on `mouseenter`, on focus capture, and is
  disabled entirely under `prefers-reduced-motion`.
- Controls: previous/next buttons, one dot per slide, a swipe threshold of 40px
  on touch, and an `aria-live="polite"` counter reading `01 / 03`.
- With a single slide the whole control row is not rendered.
- The headline, tagline, eyebrow and CTA are per-slide and come from the admin
  content editor, not from a hard-coded array.

A previous version rendered the arrows and the counter as static decoration —
nothing advanced. Do not reintroduce decorative controls; if a control is
visible it must work.

---

## 17. Horizontal overflow

Decorative motifs are placed with deliberate negative offsets (`-right-10`,
`-right-16`, `-left-20`) so they bleed off their section. Without clipping that
widens the document and *every* page gains a horizontal scrollbar — this was a
real 40px regression, most visible on mobile.

Three layers of defence, all of which must stay:

1. `html, body { overflow-x: hidden; max-width: 100% }` in `globals.css`. The
   global guard.
2. Any section that hosts a motif sets `overflow-hidden`. The real fix.
3. `MandalaField` sets `overflow: hidden` on its own `<svg>`.

Verify after touching a motif or a full-bleed section:

```js
document.documentElement.scrollWidth <= document.documentElement.clientWidth
```

Check at 390, 834 and 1440. There must be no page where this is false.

---

## 18. Motion

- Transitions: 200ms for colour, 500ms for image opacity.
- `marquee-track` (the art-tradition frieze) drifts over 48s, linear, and pauses
  on hover. The list is rendered twice and translated `-50%` for a seamless
  loop.
- Under `prefers-reduced-motion: reduce`, all animation and transitions collapse
  to `0.01ms` globally and the frieze stops entirely.
- No entrance animations, no parallax, no scroll-jacking. The page should feel
  printed.

---

## 19. SEO surface

An art site lives on discovery, so the machine-readable layer is part of the
design system, not an afterthought.

**Metadata** — `layout.tsx` sets `metadataBase`, canonical, `keywords` for the
traditions we actually sell, `formatDetection` off, and Google's
`max-image-preview: large` (art listings are judged by the image).

**Structured data** — two `ld+json` blocks in the root layout:

- `ArtGallery` with `@id`, `knowsAbout` (the traditions), `areaServed`, image
  and `priceRange`. `ArtGallery` rather than `Organization` or `Store`: it tells
  search engines this is a place showing original art.
- `WebSite` with a `potentialAction` `SearchAction` pointing at
  `/search?q={search_term_string}`, so engines can offer a search box.

All URLs in the graph are absolute via `SITE_URL`. A relative URL silently
invalidates the whole graph.

**`/robots.txt`** — permissive for `*`; private and transactional routes
(`/admin`, `/api`, `/account`, `/cart`, `/checkout`, `/order/`,
`/commission-status/`, `/search`, `/_next/`) are disallowed. Named AI crawlers
(GPTBot, ClaudeBot, PerplexityBot, Google-Extended, CCBot) are allowed but
pointed at `/llms.txt`. Aggressive scrapers get the catalogue closed.

**`/sitemap.xml`** — built from every source the site actually renders from:
static routes, the static taxonomy, admin-managed art forms, the catalogue and
Medusa. Paths are deduped by a `Set`, because duplicate `<loc>` entries are a
sitemap error. `force-dynamic` with a 1h revalidate.

**`public/llms.txt`** — a hand-maintained factual summary for answer engines:
what the house is, the sections, the policies, the questions it can answer
accurately, and a short **"Do not state"** list (no international shipping, no
authentication or investment-grade claims, no invented biographies, no prices)
so a model does not confabulate from markup. Update it when the facts change.

**Open Graph** — `og:image` and `summary_large_image` Twitter card. Without an
OG image a share renders as a bare text link, which for an art site is a real
loss.
