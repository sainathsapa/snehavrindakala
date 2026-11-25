# Catalogue Media Completeness

**Gate status: BLOCKED BY OWNER INPUT** (measured, not assumed)
**Measured:** 2026-11-26 against the staging database via `scripts/ops/catalogue-readiness-audit.mjs`
**Owner:** business owner (artwork photography)

---

## 1. Method

```bash
DATABASE_URL=… node scripts/ops/catalogue-readiness-audit.mjs
```

The audit reads the live catalogue and classifies every product's media. It never
edits anything and never invents a value.

Classification rules:

| Class | Meaning |
| --- | --- |
| `local_verified_file` | a `/…` path whose file actually exists under `apps/storefront/public` |
| `generated_placeholder` | filename marks the asset as generated art (`generated-*`), i.e. not a photograph of the real object |
| `broken_local_path` | a local path with no file on disk |
| `external_unverified` | a remote URL (reachability not asserted here) |
| `missing` | no thumbnail at all |

A `generated_placeholder` is **not** a code defect and it is not a broken image —
the page renders. It is a business-data gap: the store is presenting a stand-in
image for a one-of-a-kind artwork that the buyer will pay for.

## 2. Measured result

| Metric | Count |
| --- | --- |
| Products | 19 |
| Variants | 20 |
| **Verified local media files** | **4** |
| **Generated placeholder media** | **15** |
| Broken local paths | 0 |
| Missing thumbnails | 0 |
| External unverified | 0 |

So **15 of 19 published products (79%) are illustrated by generated stand-ins**,
not by photographs of the actual work. Four have real local files.

## 3. Why this blocks launch

* Each of these works is sold as a one-of-a-kind object with a certificate of
  authenticity. A generated image cannot represent the object the buyer receives,
  and a mismatch here is a consumer-protection and returns problem, not an
  aesthetic one.
* The product page, the OpenGraph image and the cart thumbnail all derive from
  the same field, so the placeholder propagates everywhere a buyer can see it.
* No code change fixes this. The owner must supply photographs.

## 4. What the owner must supply

For each of the 15 placeholder products:

1. Original photographs — at least one front view and one detail view.
2. Confirmation that the photo is of the actual item in stock (not a similar
   piece from the same series).
3. The measurement data required by shipping (see
   `PRODUCT_PARTNER_MAPPING_REPORT.md` and the shipping-data section of
   `INVENTORY_INITIALIZATION_AND_RECONCILIATION.md`).

### Accepted technical envelope

| Property | Requirement |
| --- | --- |
| Formats | JPEG or WebP (PNG accepted for transparent cut-outs) |
| Minimum long edge | 1600 px |
| Maximum file size | 1.5 MB after optimisation |
| Orientation | landscape or square; portrait must still read at card size |
| Naming | `<product-handle>-01.jpg`, `<product-handle>-02.jpg` |
| Location | `apps/storefront/public/images/products/` for locally served assets |

Uploading to Sanity instead of the repository is also supported — the storefront
resolves remote URLs — but `external_unverified` then applies until a human
confirms the URL renders.

## 5. Intake workflow (ready to use)

1. Owner supplies files through the agreed shared drive, **not** chat.
2. A reviewer checks each file against the technical envelope above.
3. The reviewer sets the product thumbnail through the admin product editor.
4. Re-run `node scripts/ops/catalogue-readiness-audit.mjs` and confirm
   `generated_placeholder` reaches 0 for that product.
5. Record the reviewer and date in the release tracker.

The audit is the acceptance test: the gate closes when
`placeholderOrBrokenMedia == 0`.

## 6. Bulk import safety

There is deliberately **no** bulk media importer in this mission. Writing media
is not idempotent in a useful way and a bad bulk run would overwrite good
thumbnails. Media is set per product through the admin editor, which is audited.
If a bulk tool is wanted later it must implement the dry-run contract in
`INVENTORY_INITIALIZATION_AND_RECONCILIATION.md §4` first.

## 7. Status summary

| Item | Status |
| --- | --- |
| Audit tooling | **DONE** — reproducible, JSON output, `--strict` fails on gaps |
| Measurement | **DONE** — 4 verified / 15 placeholder of 19 |
| Real photographs supplied | **BLOCKED BY OWNER INPUT** |
| Per-product media review completed | **BLOCKED BY OWNER INPUT** |

Launch gate remains **BLOCKED** until every published product has a verified
photograph of the actual item.
