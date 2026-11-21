# Photographs and measurements: what the studio has to do

The shop is deployable and the catalogue is browsable. Two things on it are
still not true, and no amount of code can make them true — both need somebody
standing in front of the actual object:

* **The pictures.** 15 of the 19 published works have a generated illustration
  instead of a photograph. The product page now says so on those listings, and
  `/admin/products` marks them *Stand-in photo*, so a buyer is not misled and the
  studio can see the backlog. The disclosure disappears by itself the moment a
  real photograph replaces the file.
* **The sizes.** Every work states a dimension, and every one of those strings
  came from a seed script rather than from a tape. A certificate of authenticity
  printing an unmeasured size is a document asserting something nobody checked,
  so the certificate now omits dimensions until the studio ticks *I have measured
  this work* on the product's edit page. The product page still shows the size,
  labelled "as stated by the studio, not yet measured".

Neither is a place to guess. A wrong number on a signed certificate, or an
illustration presented as the piece, is worse than an honest gap.

## What to do, per work

1. Photograph it: front, back, a detail, and a shot with something for scale.
2. Replace `apps/storefront/public/images/products/generated-<handle>.jpg` with a real
   photograph at the same path (any name that does not start with `generated-`).
   Or upload through `/admin/products/<id>/edit`.
3. Measure it with a tape, in centimetres, and correct the dimensions on the same page.
4. Tick **I have measured this work**. That is what lets the certificate print the size.

## The works

| Work | Dimensions on the listing | Picture |
| --- | --- | --- |
| `art-pendant` | 3 cm | photograph |
| `bidriware-silver-inlay-box` | 12 cm × 8 cm | stand-in |
| `block-printed-table-runner` | 180 cm × 33 cm | stand-in |
| `custom-portrait-commission` | Commissioned to size | stand-in |
| `embroidered-cotton-throw` | 180 cm × 130 cm | photograph |
| `gold-leaf-miniature-portrait` | 18 cm × 13 cm | stand-in |
| `gond-tree-of-life` | 60 cm × 60 cm | stand-in |
| `hand-marbled-paper-journal` | A5, 120 pages | stand-in |
| `hand-painted-terracotta-vase` | 22 cm × 14 cm | photograph |
| `hand-thrown-stoneware-bowl` | 16 cm × 7 cm | stand-in |
| `hand-woven-ikat-stole` | 200 cm × 70 cm | stand-in |
| `kalamkari-penwork-panel` | 70 cm × 45 cm | stand-in |
| `lacquer-wooden-pen-case` | 17 cm × 5 cm | stand-in |
| `madhubani-celebration` | 50 cm × 35 cm | stand-in |
| `madhubani-folk-painting` | 45 cm × 30 cm | photograph |
| `pattachitra-scroll-panel` | 60 cm × 35 cm | stand-in |
| `phulkari-embroidered-dupatta` | 220 cm × 90 cm | stand-in |
| `silver-filigree-earrings` | 4 cm drop | stand-in |
| `warli-harvest-painting` | 55 cm × 40 cm | stand-in |

## How to check progress

`/admin/products` lists *Stand-in photo* and *Size unmeasured* chips. When
both are gone from a row, that work is fully honest:

```sql
-- works still showing an illustration
select handle from product where thumbnail like '%generated-%' and deleted_at is null;

-- works still unmeasured
select p.handle from product p
  join product_tags pt on pt.product_id = p.id
  join product_tag t on t.id = pt.product_tag_id
 where t.value like 'dimensions:%' and p.deleted_at is null
   and not exists (
     select 1 from product_tags mpt join product_tag mt on mt.id = mpt.product_tag_id
      where mpt.product_id = p.id and mt.value = 'measured:yes');
```

Current state: **15 of 19 works have a stand-in picture; 0 of 19 are marked measured.**
