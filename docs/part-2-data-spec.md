# Part 2 — the data the storefront is already waiting for

Phase 2 Part 1 finished the interface. Every place that should show a medium, a
size, a year, a maker's biography, a region or a journal-to-tradition link is
built and live — and renders nothing, because the data behind it does not exist.

This document is the specification for that data. It is deliberately short,
because almost none of it requires a code change. It exists so the work can be
handed to whoever owns the facts, and so nobody later mistakes an empty row for
a bug.

**Nothing here may be invented.** These are one-of-one objects sold with a
certificate of authenticity. A guessed dimension or a composed biography is a
false claim about a real object, and the fastest way to lose a buyer who knows
the material.

---

## 1. What is already wired and waiting

| Surface | Reads from | Renders today |
| --- | --- | --- |
| `ProductCard` caption | `item.specs.medium`, `item.specs.dimensions` | nothing |
| Homepage plate captions | same | nothing |
| PDP `ArtworkSpecsPanel` | `specsFromProduct()` — 7 rows | dispatch only |
| PDP `ArtworkRecord` "Region" row | `site_art_form.origin` | nothing |
| PDP → maker link | `product.artist` | works (mode-aware) |
| Maker → works | derived from catalogue | works (21/21) |
| Journal → tradition | `journal_posts.art_form` (does not exist) | not built |

The first four are pure data gaps. The last needs one schema column.

---

## 2. Artwork facts — product tags

`specsFromProduct()` (`lib/catalogue.ts:150`) already reads `key:value` tags
from the Medusa product. No code change is needed; only tags are missing.

Current tags in the database are exactly three families:

```
artist:Sneha Sainath Sapa
stock:ready_to_ship | stock:made_to_order | stock:custom_only
```

### Add these tags

| Tag | Example | Notes |
| --- | --- | --- |
| `medium:` | `medium:Hand-painted natural pigment on handmade paper` | Materials and support, phrased like a museum label |
| `dimensions:` | `dimensions:38 × 28 cm` | Use `×` (not `x`); height × width for flat work, H × W × D for objects |
| `year:` | `year:2024` | Year of completion, four digits. Omit if not established |
| `framing:` | `framing:Unframed; framing available on request` | State the delivered state first |
| `edition:` | `edition:Unique, one of one` | For multiples only; omit for unique works |
| `care:` | `care:Keep out of direct sunlight` | Practical only |

Rules:

- **Omit a tag rather than guessing.** A missing row is honest; a wrong one is not.
- `dispatch` is currently derived from stock type and is already correct — do
  not add a `dispatch:` tag unless a specific work genuinely differs.
- The panel drops empty values (`lib/catalogue.ts:175`), so an absent tag simply
  produces no row. There is no need to enter blanks.

### Volume

21 products are published. 0 carry a medium or dimension today. Target: all 21
tagged with at least `medium` and `dimensions`.

---

## 3. Tradition region — `site_art_form.origin`

The `origin` column already exists and is already rendered by the PDP record
block. It is empty for all six traditions, so the Region row never appears.

| slug | Suggested shape (fill with the real thing) |
| --- | --- |
| `painting` | `<region>, <state>` |
| `folk` | … |
| `home-decor` | … |
| `textile` | … |
| `paper` | … |
| `wearable` | … |

The field is free text and is stored in `origin` (English) and `origin_hi`.

**These are geography, not folklore.** State where the tradition is practised;
do not add origin legends.

---

## 4. Hindi descriptions — `site_art_form.description_hi`

All six traditions have `description_hi` empty, so `/hi` product pages show the
English description next to Hindi labels. That mismatch is visible and slightly
awkward, but machine-translating art-historical copy would be worse.

Six short paragraphs are needed, ideally from someone who reads the material.
Same applies to `story_hi`, `materials_hi`, `origin_hi` and `quote_hi`.

Names are already translated and working (`name_hi`), which is why the Hindi
record shows `पारंपरिक और लोक कला` correctly today.

---

## 4a. The two modes, and what each one requires

`PLATFORM_MODE` (env; `lib/settings.ts`) selects between two products that share
one codebase. **Every item in this document must hold in both.** Getting this
wrong is not cosmetic: it produces 404s.

| | `single-brand` (default) | `platform` (multi-vendor) |
| --- | --- | --- |
| Seller | SnehaVrinda Kala only | Many makers |
| `/makers` | **200** — derived from `product.artist` | **404** (by design) |
| `/artists` | **404** (by design) | **200** — from the artists module |
| `/sell` | **404** | **200** |
| Artist data | none; names live on products | Medusa `artist` module |

### The bug this already caused

The PDP record block linked every maker to `/makers#<slug>`. In platform mode
that route 404s, so **all 21 product pages had a dead maker link** — and it was
invisible in development, because the local env is `single-brand`.

Now resolved per mode (`products/[handle]/page.tsx`):

- single-brand → `/makers#<slugify(artist)>`
- platform → `/artists/<real artist slug>`, falling back to `/artists` when the
  artist has no module record yet

The fallback matters: the artists module currently holds **zero** records, so a
guessed slug would have produced a 404 where a working directory link dominates.
Verified: `/makers` 404s and `/artists` 200s under `PLATFORM_MODE=platform`, on
the homepage and the PDP alike.

### What Part 2 must respect

1. **Never hardcode `/makers`** in new surfaces. Use the same branch as the PDP.
2. **`site_artist` (§5) is single-brand only.** In platform mode the artists
   module already carries `display_name`, `slug`, `bio`, `disciplines`,
   `techniques` and `portrait_media_id`. Building a second artist table for
   platform mode would create two competing directories.
3. **Tags and `origin` (§2, §3) are mode-independent** — they hang off products
   and traditions, which both modes share. Safe everywhere.
4. **Journal links (§6) are mode-independent** for the same reason.
5. When testing any Part 2 change, **run it once in each mode**. The default env
   hides every platform-only fault.

## 5. Maker biography — the one real schema change

There is no artist table the storefront reads. `/makers` derives its entries
from `product.artist` and shows only a name and a count. A biography, a
portrait and a region cannot be stored anywhere yet.

### Proposed table

```sql
CREATE TABLE IF NOT EXISTS site_artist (
  id           SERIAL PRIMARY KEY,
  slug         TEXT UNIQUE NOT NULL,   -- matches slugify(product.artist)
  name         TEXT NOT NULL,
  bio          TEXT NOT NULL DEFAULT '',
  portrait     TEXT NOT NULL DEFAULT '', -- /images/artists/<slug>.jpg
  region       TEXT NOT NULL DEFAULT '',
  years_active TEXT NOT NULL DEFAULT '',
  published    BOOLEAN NOT NULL DEFAULT true,
  position     INTEGER NOT NULL DEFAULT 0,
  -- Hindi overlay, same pattern as site_art_form
  name_hi      TEXT NOT NULL DEFAULT '',
  bio_hi       TEXT NOT NULL DEFAULT '',
  region_hi    TEXT NOT NULL DEFAULT ''
);
```

`slug` must equal `slugify(product.artist)` so `/makers#<slug>` and the PDP
maker link resolve without a second mapping. `slugify` is in `lib/slugs.ts`.

No seed rows. The directory already works without this table; it would simply
gain a biography, a portrait and a region where supplied.

**`site_artist` is a single-brand concern.** In platform mode makers come from
the Medusa artists module (`medusa.listArtists`), which already provides a real
`slug`, `bio`, `disciplines` and `portrait_media_id` — see §4a. Do not build a
second artist directory that duplicates it.

### Content needed

- One biography per maker, written by the maker or with their consent.
- A portrait photograph, with permission to publish it.
- Region, and years active if they wish to state them.

**Do not draft these on the maker's behalf.** A biography is a claim about a
living person.

---

## 6. Journal → tradition link

`journal_posts` (`lib/site-content.ts:851`) has no art-form column, so a Journal
article cannot point at a tradition and a tradition page cannot list its
articles. The Journal↔tradition cross-links in Part 1 were deferred for this
reason.

### Proposed columns

```sql
ALTER TABLE journal_posts ADD COLUMN IF NOT EXISTS art_form TEXT NOT NULL DEFAULT '';
ALTER TABLE journal_posts ADD COLUMN IF NOT EXISTS artist_slug TEXT NOT NULL DEFAULT '';
```

`art_form` holds a taxonomy slug (`folk`, `textile`, …), matching
`site_art_form.slug`. Empty means unlinked and renders no cross-link.

Then two small additions, both already sketched: an "In the journal" block on
`/art-forms/[slug]`, and a "Related tradition" line on `/journal/[slug]`.

---

## 7. Photography — the largest gap

Six product photographs exist for twenty-one works. See
`docs/catalogue-expansion-plan.md` §11 for the full count and why image
reallocation was dropped rather than faked.

Fifteen more photographs are needed, one per untagged work. `madhubani-celebration`
currently renders the "Image coming soon" plate, which is correct behaviour but
weak for a shop.

For each photograph: one main image at least 1600px on the long edge, plus any
detail shots. Same naming convention, `public/images/products/<handle>.jpg`.

---

## 8. Order of work, and why

1. **Product tags** (§2) — cheapest, and unlocks the most surfaces: card
   captions, homepage plates, and four PDP spec rows. Pure data entry.
2. **`origin`** (§3) — one field, six rows, makes the Region row appear.
3. **Photography** (§7) — highest impact on trust, most expensive. Independent
   of the rest.
4. **Hindi descriptions** (§4) — needs a writer, not a developer.
5. **`site_artist`** (§5) — schema plus code plus consent. Single-brand only;
   in platform mode point at the existing artists module instead (§4a).
6. **Journal link** (§6) — smallest remaining code change; do last.

Each step must be checked in **both modes** (§4a). The local default is
`single-brand`, which hides every platform-only fault — that is exactly how the
maker-link 404 reached every product page unnoticed.

---

## 9. What still will not be real when this is done

Recorded plainly so the result is not overclaimed:

- `edition` and `care` will stay empty on most works unless genuinely known.
- Only one maker exists in the catalogue, so `/makers` remains a single entry.
- Provenance chains, exhibition history and condition reports are not modelled
  at all. They are not required for this storefront, but buyers of original art
  sometimes ask, and there is currently no field to answer with.
