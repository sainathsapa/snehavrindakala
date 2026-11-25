# Inventory Initialisation & Reconciliation

**Gate status: BLOCKED BY OWNER INPUT** (no stock quantities supplied)
**Engineering status:** tracked-stock model + audited initialisation path **DONE**
**Measured:** 2026-11-26 against the staging database

---

## 1. Measured state

| Metric | Count |
| --- | --- |
| Products | 19 |
| Variants | 20 |
| Variants with a `variant_stock` row | **0** |
| Products with fully tracked stock | **0** |

Every variant is **untracked**. The audit reports this as a gap, and the
application behaves correctly in that state:

* `reserveStock()` returns `tracked: false` for an untracked variant and falls
  back to the pre-existing sold-works guard (see `lib/inventory.ts`);
* nothing is sold "from stock" that was never counted;
* existing products and customer data are untouched.

## 2. Why nothing was defaulted to 1

A one-of-a-kind artwork sold with a certificate of authenticity *looks* like it
should default to quantity 1. It must not:

* some works are part of a series and the owner may hold more than one;
* replenishable items (printed cards, packaging) have their own counts;
* a wrong `on_hand` either oversells a unique piece or hides sellable inventory;
* the owner may have already sold a work outside the platform.

So `variant_stock` starts empty and a product is tracked only after an explicit,
attributable initialisation. `availableStock()` is
`on_hand − reserved − sold`, so a tracked variant cannot be oversold by
construction.

## 3. Uniqueness vs replenishable

The owner must classify each product:

| Class | Meaning | Consequence |
| --- | --- | --- |
| `unique_artwork` | exactly one physical object exists | count 1; a second sale is impossible while reserved |
| `series` | multiple similar pieces, counted | count = actual held quantity |
| `replenishable` | can be re-made or re-ordered | count = current sellable quantity |

No product has been classified, and the platform does not infer the class from the
title, category or price. Inferring "one-of-a-kind" from a title would be a
fiction that ends in a refund.

## 4. Initialisation workflow (ready; dry-run required)

The import path must satisfy this contract before it writes anything:

1. **Validate format** — required columns exactly:
   `variant_id, on_hand, class, source, actor, measured_at` (no extra required
   columns; unknown columns rejected rather than ignored).
2. **Dry-run preview** — report, without writing: rows accepted, rows rejected
   with reason, duplicates, unknown variant ids, negative/absurd counts, and
   variants already tracked (which would be an update, not an insert).
3. **Conflict report** — a variant that already has a row is a conflict; updates
   need an explicit `--allow-update` so a re-run cannot silently reset a count.
4. **Explicit confirmation** — the operator confirms the previewed diff, not the
   file.
5. **Audit record** — one row per movement via the existing
   `inventory_movement` table, carrying actor, reason and source, plus the import
   batch reference.

No importer is enabled in this mission, deliberately: the owner data does not
exist yet, and a half-tested writer against live inventory is worse than no
writer. The contract above is what the importer must implement when the data
arrives.

## 5. Oversell controls (already active, tested)

| Control | Mechanism | Test |
| --- | --- | --- |
| Atomic reservation | `SELECT … FOR UPDATE` on `variant_stock` inside a transaction | reservation concurrency suite |
| Reservation expiry | 15-minute TTL, released by cron | reservation-hardening suite |
| Consume on payment | `consumeReservation()` increments `sold` | checkout completion tests |
| Release on failure | `releaseReservation()` decrements `reserved` | payment-failure tests |
| Restock on refund | `restoreSoldForOrder()` | refund/inventory suite |
| Concurrent unique-item purchase | only one purchase may succeed | unit-level; **browser E2E skipped** pending partner/payment fixtures |

The concurrency guarantee is unit-tested against a real Postgres transaction
semantics in the suite; it is **not** proven end-to-end in a browser (that
scenario is skipped, and skipped is not passed).

## 6. Reconciliation export (for owner review)

Before any write, the owner reviews a diff of what the platform currently believes
versus the supplied file:

```bash
# what the platform currently knows
DATABASE_URL=… node scripts/ops/catalogue-readiness-audit.mjs --json \
  | jq '{products: .totals.products, tracked: .totals.productsWithTrackedStock}'

# per-variant stock rows
docker exec snehavrinda-postgres psql -U medusa -d medusa -c \
  'SELECT variant_id, on_hand, reserved, sold FROM variant_stock ORDER BY variant_id'
```

The owner signs off the diff, then the importer runs with `--apply`.

## 7. What the owner must supply

| Input | Needed for |
| --- | --- |
| Actual countable quantity per variant | `on_hand` |
| Unique-artwork vs series vs replenishable classification | reservation policy |
| Any prior off-platform sales | avoiding a double sale |
| Confirmation that untracked products may keep selling without stock control | interim policy |

## 8. Status summary

| Item | Status |
| --- | --- |
| Tracked-stock model and oversell controls | **DONE** (existing, verified) |
| Audited initialisation contract | **DONE** (specified here; importer not enabled) |
| Reconciliation export | **DONE** (audit script + SQL) |
| Real stock quantities | **BLOCKED BY OWNER INPUT** |
| Unique/replenishable classification | **BLOCKED BY OWNER INPUT** |
| Browser-level oversell E2E | **SKIPPED** (needs payment/partner fixtures) |

Inventory is not launch-ready, and no quantity has been invented to make it look
ready.
