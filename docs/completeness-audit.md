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

## 5. Test rows exist, and none of them are buyer-facing

Three rows in the product table come from testing rather than from the house.

| handle | status | reachable by a buyer? |
|---|---|---|
| `admin-image-probe` | draft | no |
| `test-delete-product` | draft | no |
| `test-category-journey` | **published** | no |

`test-category-journey` is the odd one: it is published, yet its product page
returns 404, it is absent from `/shop`, from the sitemap and from search results
— it has no category and no price, so every listing path skips it. That is why
`/shop` renders 21 cards while 22 products are published; the difference is this
row, not a lost product.

They are left in place because deleting catalogue rows is the owner's call, not
a side effect of an audit. They should be deleted before the store opens.

## 6. What is deliberately unfinished

These are not defects. They are gaps that cannot be closed from code without
fabricating something.

| Gap | Size | Why it is not done here |
|---|---|---|
| Real photographs | 16 of 22 published | A photograph of a different work is a false claim about a one-of-one object |
| Dimensions | 22 of 22 published | Nothing may be estimated; a wrong size is a returned order. No dimension data exists anywhere — `product.metadata` holds only `stock_type` and `artist` |
| Product description | 1 (`madhubani-celebration`) | Needs the owner's words |
| Artist biography | 1 maker | A factual claim about a named living person; needs their text and consent |
| Hindi review | 1 word (`हरड़`) | Authentic name for the dye nut, but the register needs a native reader |

The single product without a description renders correctly: the section is
omitted rather than left as an empty heading, and the page still carries the
tradition prose, the maker, the price and the commission path.

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
