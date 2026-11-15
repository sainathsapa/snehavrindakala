# Catalogue Expansion Plan

**Status:** proposed — no records created, no data invented.
**Owner action required** for every field marked *(owner)*.

---

## 1. Why this is the priority

The storefront is strongest where it has real data and weakest where it has
none. At the time of writing the live catalogue holds **21 products attributed
to a single maker**, against a taxonomy of **6 art forms** and an editorial
library of **6 essays**. Every other improvement — structured data, ISR,
collection pages, the Makers page — is scaffolding around a small collection.

Nothing in this document fabricates an artwork, a biography, a provenance or a
dimension. It describes the record shape the code already expects and the
process for filling it honestly.

## 2. What the code already supports

`ArtworkSpecs` in `apps/storefront/lib/catalogue.ts` is the authoritative field
list. The UI renders a row only when a value exists, so a partial record is
valid and simply shows fewer rows.

| Field | Source key | Notes |
|---|---|---|
| `dimensions` | product tag `dimensions` | e.g. `46 × 61 cm`. Include units. |
| `medium` | product tag `medium` | Materials actually used. |
| `framing` | product tag `framing` | `Unframed`, `Framed — teak`, etc. |
| `year` | product tag `year` | Year completed. |
| `edition` | product tag `edition` | Omit entirely for one-of-one works. |
| `dispatch` | product tag `dispatch` | Optional override; defaults by stock type. |
| `care` | product tag `care` | Only where there is real guidance. |

Tags are written from the admin product editor and mirrored to Medusa tags so
the store API returns them (`scripts/backfill-tags.mjs` exists for this).

## 3. Target shape of the collection

Aim for **breadth before depth**, because SEO and browsing both need more than
one shelf with more than one work on it.

| Art form | Works now | Target | Why |
|---|---|---|---|
| Painting | 3 | 12–15 | Highest commercial intent. |
| Folk | 5 | 12–15 | Strongest educational search demand. |
| Home decor | 4 | 8–10 | Lower price point, higher conversion. |
| Textile | 3 | 8–10 | Distinct buyer; good gifting intent. |
| Paper | 3 | 6–8 | Supports the journal and journal-set SKUs. |
| Wearable | 3 | 6–8 | Small-format entry price. |

Counts taken from the `CollectionPage` structured data on each `/shop/<form>`
page, which reports what the shelf actually renders. No art form currently holds
more than five works, and three is the floor — which means every collection page
is a thin page by search standards, however good its design.

A shelf needs roughly six works before it stops reading as a placeholder, and
ten before it can carry a category keyword on its own merits.

## 4. Required data per published work

Minimum for the record to be useful to a buyer and to search:

1. **Title** *(owner)* — the work's own name, not a category label.
2. **Maker** *(owner)* — the artist's name as they write it.
3. **Medium** *(owner)* — real materials.
4. **Dimensions** *(owner)* — measured, with units.
5. **Year** *(owner)* — completion year.
6. **Three or more photographs**, at least one full-frontal on a neutral ground,
   one detail, one scale reference *(owner)*.
7. **Description** — written by or with the maker; what it is and how it was
   made. No invented history.
8. **Price and stock type** — `ready_to_ship`, `made_to_order`, `custom_only`.
9. **Art-form tag** — one of the six taxonomy slugs.

Optional and only when true: framing, edition (prints only), care notes,
provenance/exhibition history.

## 5. Description standard

Each description should answer, in the maker's own terms:

- What is it, from what, by whom?
- Which tradition does it belong to, and what does that tradition do here?
- What was difficult, unusual or particular about *this* work?
- What should a buyer know about hanging, storing or using it?

**Prohibited:** invented ancestry, invented exhibition history, invented
regional attribution, invented awards, invented "certificates of authenticity"
that the business does not actually issue.

## 6. Makers

`/makers` derives its list from the `artist` field on published products. That
means:

- A maker appears automatically once their first work is published.
- Two spellings of one name create two entries by design — merge by editing the
  product records, never by fuzzy matching.
- No biography is rendered anywhere today. If biographies are wanted, they need
  a real source (the maker, verbatim) and a new field — not placeholder text.

**Owner action:** confirm the correct published spelling of each maker's name,
and whether portraits may be used.

## 7. Photography

The site's photography layer is where the art-house claim is most at risk. The
manifesto band and the craft-journey band currently reuse a small pool of
images, one of which also appears as a product photo.

Minimum standard for new work images:

- Consistent background and lighting across the collection.
- Long edge ≥ 2000 px for the PDP zoom.
- No watermarks, no phone-camera crops for primary images.
- File names that identify the work, so alt text and sitemaps stay legible.

## 8. Process (repeatable, no invented data)

1. Maker supplies title, medium, dimensions, year, photographs, description
   *(owner)*.
2. Product created in `/admin/products` with those fields and the art-form tag.
3. Description written with the maker; unverifiable claims removed.
4. Publish. `specs` populate automatically from tags.
5. Re-run `node scripts/check-redirects.mjs <origin>` if any handles changed.
6. Spot-check the PDP: `Product` and `VisualArtwork` blocks should carry only
   the fields that were actually supplied.

## 9. How success is measured

- Number of published works per art form (target: ≥ 6 in every form).
- Percentage of works with a complete spec set (target: ≥ 80%).
- Number of distinct makers on `/makers`.
- Organic landing pages: art-form essays and journal posts are already the
  strongest content; collection pages can only compete once each shelf holds
  enough works to deserve a page.

## 10. Explicitly out of scope here

- Writing any artwork record.
- Writing any artist biography.
- Choosing a maker's name spelling.
- Issuing provenance or authenticity documentation.

These are the owner's to supply. The code is ready for them; the data is not
something this project may invent.

## 11. Photography: the actual constraint

An earlier proposal for this phase included "reallocate images to reduce
repetition". Inspection showed the premise was wrong, and the task was dropped
rather than faked.

What exists:

| Asset | Count |
| --- | --- |
| Real photographs of a specific work (`public/images/products/`) | **6** |
| Art-form category photographs, reused as stand-ins | 6 |
| Products in the catalogue | **21** |

There is no pool of unused photography to draw on, so "reallocation" could only
mean pointing one work at a photograph of a *different* work. That is the one
thing this project must not do: a picture of the wrong painting is worse than no
picture, because it is a false claim about a one-of-one object.

Measured state of the catalogue grid, for the record:

- `/shop` shows 21 cards drawn from 12 distinct images, with no image used more
  than three times. (An earlier note claimed five; that figure counted repeats
  across the *homepage*, which stacks the same photo in several sections, not
  repeats across the listing.)
- `madhubani-celebration` has no image at all and renders an "Image coming soon"
  plate. This is honest and needs no code change.

What would actually fix it is **15 more photographs**, one per untagged work.
Until they exist, the homepage orders the works that do have their own photo
first (`app/[locale]/page.tsx`, `orderedForDisplay`) so the lead positions show
real work; that is ordering only and hides nothing.

Related: no art form carries a Hindi description (`description_hi` is empty for
all six), so `/hi` product records show the English description. Machine
translating art-historical copy would be worse than the gap.
