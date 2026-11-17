# Completeness audit

Run against the deployed container on `localhost:3000` after `fc31ae0`.
Every number below was measured, not recalled. Re-run the listed command to
reproduce it.

The point of this file is to be able to say "nothing is broken" and mean it,
and to separate that from the things that are *deliberately* not finished
because they need the owner's data.

---

## 1. Nothing links to a broken page

Every internal `href` reachable from the main entry points was collected and
requested.

```
74 internal links · 0 broken
```

Entry points crawled: `/`, `/shop`, `/about`, `/art-forms`, `/journal`,
`/learn`, `/makers`, `/search`, `/track`, `/contact`, `/faq`, `/hi`,
`/hi/shop`, `/hi/about`.

## 2. Nothing in the sitemap is missing

```
110 URLs · 55 Hindi · 220 hreflang alternates · 110/110 return 200
```

Each English page is emitted as a twin pair with `alternates.languages`, which
is what makes the Hindi pages discoverable at all.

## 3. Nothing is untranslated

```
784 keys in en.json · 784 keys in hi.json · 0 missing · 0 extra
1 value identical in both: track.emailHint = "you@example.com"
```

The single identical value is an email format hint, which should not be
translated. Every other Hindi string differs from its English source.

## 4. No placeholder copy reached the page

```
0 matches for TODO / FIXME / lorem / ipsum / placeholder / XXX / TBD
```

searched across both message files, which is where all user-visible prose lives.

## 5. Test rows existed, and none were buyer-facing

Three rows in the product table came from testing rather than from the house.
All three were confirmed never ordered before anything was touched: the join
from `order_line_item` to `product_variant` was checked against real orders
first (it found six line items across four real products), so an empty result
for the test rows meant something.

| handle | status | reachable by a buyer? |
|---|---|---|
| `admin-image-probe` | draft | no |
| `test-delete-product` | draft | no |
| `test-category-journey` | published | no |

All three were already soft-deleted (`deleted_at` set) when this audit began,
which is why `test-category-journey` returned 404 and appeared in no listing
despite its `status` being `published`. Their variants were not, so those were
soft-deleted to match — Medusa's own removal path, reversible, and respected by
the admin stats and export queries, which both filter `deleted_at IS NULL`.

This also settles a count that had been drifting: `/shop` renders 21 cards while
an unfiltered `status='published'` query returned 22. The extra row was the
soft-deleted test product. There was never a lost product.

**Every count in this document now filters `deleted_at IS NULL`.** Earlier
drafts of it did not, which is how the discrepancy survived this long.

## 6. What is deliberately unfinished

These are not defects. They are gaps that cannot be closed from code without
fabricating something.

| Gap | Size | Why it is not done here |
|---|---|---|
| Real photographs | 16 of 21 live | A photograph of a different work is a false claim about a one-of-one object |
| Dimensions | 21 of 21 live | Nothing may be estimated; a wrong size is a returned order. No dimension data exists anywhere — `product.metadata` holds only `stock_type` and `artist` |
| Product description | 1 (`madhubani-celebration`) | Needs the owner's words |
| Artist biography | 1 maker | A factual claim about a named living person; needs their text and consent |
| Hindi review | 1 word (`हरड़`) | Authentic name for the dye nut, but the register needs a native reader |

The single product without a description renders correctly: the section is
omitted rather than left as an empty heading, and the page still carries the
tradition prose, the maker, the price and the commission path.

It is worth knowing that `madhubani-celebration` is **not an unsold listing**.
It appears in three order line items, so buyers have already paid for a work
whose page says nothing about it. Of everything in this table, that is the
cheapest and most valuable gap to close: it needs a paragraph, not a
photographer or a tape measure.

## 7. Re-running this audit

```bash
# links
for u in / /shop /about /art-forms /journal /learn /makers /search /track /faq; do
  curl -s "http://localhost:3000$u" | grep -oE 'href="/[^"#?]{0,80}"'
done | sed 's/href="//; s/"//' | grep -vE "^/(_next|images|api)" | sort -u

# sitemap
curl -s http://localhost:3000/sitemap.xml | grep -c "<loc>"

# translation coverage
node -e 'const k=o=>Object.entries(o).flatMap(([a,b])=>typeof b==="object"?k(b).map(x=>a+"."+x):[a+"."+b]);
const e=k(require("./messages/en.json")),h=k(require("./messages/hi.json"));
console.log(e.length,h.length,e.filter(x=>!h.includes(x)).length)'
```
