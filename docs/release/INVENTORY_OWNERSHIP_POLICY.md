# Inventory ownership & reservation policy — decision template (owner input required)

> Owner: AGENT A86 — SnehaVrinda Kala FINAL GO.
> Branch: `remediation/final-go`. Date: 2026-11-23.
>
> Records (a) how inventory ownership, reservation and overselling prevention are
> **implemented** and (b) the ownership decisions the owner must supply. No stock
> count, TTL value or partner identity is fabricated; where the code is silent the
> item is **PENDING DECISION**.
>
> Sources: `apps/storefront/lib/inventory.ts`, `db/schema.sql` (INV-01 schema),
> `db/migrations/002_partner_marketplace.sql`, `lib/admin-partners/platform.ts`,
> `lib/partner/types.ts`, `lib/fulfilment/allocate.ts` (all under `apps/storefront/`).

---

## 1. Who owns stock (implemented vs pending)

**Implemented:**
- Stock is tracked per **Medusa variant** in `variant_stock`
  (`variant_id`, `on_hand`, `reserved`, `sold`). `stock_reservation` rows reference a
  variant and carry `cart_id`, `quantity`, `status`
  (`active|consumed|released|expired`), `order_id` and `expires_at`.
- A variant is **never tracked automatically**. `initialiseStock(variantId, onHand)`
  is the **only** way a variant enters `variant_stock`, and it is an explicit
  admin/owner action; `on_hand` must be a non-negative integer. Untracked variants
  keep the previous `sold-works` guard behaviour, so existing products are untouched.
  `lib/inventory.ts` lines 1–19, 247–263.
- **Product→partner ownership** is a separate concept: `partner_product` maps a
  Medusa `product_id` to a `partner_id` with an approval workflow; the fulfilment
  allocator uses a `product_id → partner_id` map. (`db/migrations/002…sql` lines 79–96;
  `lib/fulfilment/allocate.ts`.)

**Gap / PENDING DECISION:** `variant_stock` and `stock_reservation` have **no
`partner_id` column**. Stock is therefore platform-wide at variant level; the system
does **not** record "this many units belong to partner X". The owner must decide:
| # | Decision (owner supplies) | Owner value | Sign-off |
|---|---|---|---|
| 1 | Is stock owned **per partner** (each partner has its own on-hand count for a variant) or **platform-wide per variant** (current model)? If per partner, the schema/behaviour change is required. | _(blank)_ | |
| 2 | Actual, authoritative `on_hand` counts — especially for one-of-a-kind works (see `OWNER_INPUT_REQUIRED.md` §Catalogue & inventory). | _(blank — no counts invented)_ | |
| 3 | Which partner/artist owns each existing product (the authoritative product→partner/artist mapping for migration/linking). | _(blank)_ | |

---

## 2. Reservation TTL behaviour (implemented)

- `RESERVATION_TTL_SECONDS = 15 * 60` — a **code constant** (15 minutes, "matching a
  checkout window"), applied in `reserveStock()` and legacy-cart `consumeReservation()`
  via `now() + ($n * interval '1 second')`. `ttlSeconds` can be overridden per call.
- `reserveStock()` is **idempotent per buyer**: an existing active, unexpired
  `(variant_id, cart_id)` reservation is kept and its TTL refreshed, not duplicated.
- Lifecycle (`lib/inventory.ts`):
  - `reserveStock()` → active (expires after TTL).
  - `consumeReservation()` → `consumed`, `reserved--`, `sold++`; binds `order_id`.
  - `linkReservationsToOrder()` → binds consumed holds to the real order id for
    later restore.
  - `releaseReservation()` → `released`, `reserved--` (payment failure / cart abandon).
  - `restoreSoldForOrder()` → `released`, `sold--` (order cancellation / eligible
    refund; used by `app/api/admin/orders/[id]/cancel/route.ts`).
  - `releaseExpiredReservations()` → `expired`, `reserved--` (cron/admin sweep).
- Availability rule: `availableStock = max(0, on_hand − reserved − sold)`.

**PENDING DECISION:** the 15-minute TTL is an implementation default, not an
owner-approved business value.
| # | Decision (owner supplies) | Owner value | Sign-off |
|---|---|---|---|
| 4 | Approved reservation TTL / checkout window (confirm or replace 15 minutes). | _(blank)_ | |
| 5 | Who runs `releaseExpiredReservations()` and on what schedule (cron/admin). | _(blank)_ | |
| 6 | Which refunds are "eligible" to call `restoreSoldForOrder()` (the code has a generic helper; the business rule for eligibility is not defined here). | _(blank)_ | |

---

## 3. One-of-a-kind works & overselling prevention (implemented)

- Every work is effectively **one of one**; the historical `sold-works` guard was a
  read, so two buyers paying in the same instant could both pass and receive a
  certificate for the same piece. The inventory module closes that.
- `reserveStock()` and `consumeReservation()` run inside `transaction()` and lock
  the stock row with `SELECT … FOR UPDATE`. `canReserve()` checks
  `availableStock + alreadyReservedForSameBuyer >= quantity`. For a variant with
  `on_hand = 1`, **one winner** claim is guaranteed.
- A legacy cart with no active reservation is handled by reserve-and-consume in the
  **same locked transaction** (`consumeReservation`), closing the double-sale race
  even for carts created before reservations existed.
- `isUniqueWork()` (`lib/sold-works.ts`) treats a work as one-of-one unless its
  `stock_type` indicates made-to-order/custom. One-of-a-kind stock must be
  initialised with `on_hand = 1` by the owner; it is never guessed.

**PENDING DECISION:** no code decides the *business* rule for "made-to-order" vs
"ready-to-ship" stock treatment at checkout; `stock_type` tags are owner-supplied
catalogue data (`lib/catalogue.ts`, `OWNER_INPUT_REQUIRED.md`).

---

## 4. Admin-assisted artist → partner mapping (implemented — never auto-promote)

- A **partner** is deliberately **not** the same as a public artist/maker
  (`site_artist`) or a Medusa admin user (`lib/partner/types.ts` header;
  migration 002 comment lines 5–7).
- `partner.artist_id` is **nullable by design** and is set only by the explicit admin
  function `linkArtist()` (`lib/admin-partners/platform.ts` lines 426–489).
- **`linkArtist()` changes only `artist_id` and `approval_history`.** It never sets
  `account_status` or `verification_status`: the code comment states "Linking alone
  cannot promote an artist to an active or verified partner." It validates that both
  the partner and the `site_artist` exist, logs the previous `artist_id`, and writes
  an audit entry. `site_artist.id` is an integer serial stored as text in
  `partner.artist_id`.
- Partner activation/verification are separate admin decisions through
  `account_status` (`pending|active|suspended|rejected`) and `verification_status`
  (`unverified|pending|verified|rejected`), with `approval_history` audit trail.
- The product→partner map used to allocate line items is authoritative and supplied
  from outside the client; partner IDs in partner-facing queries always come from the
  verified session (`PartnerContext.partnerId`), never the request.

**PENDING DECISION:** the authoritative artist→partner and product→partner mappings
are owner inputs for migration/linking (`OWNER_INPUT_REQUIRED.md` §Catalogue &
inventory). No artist is silently promoted and no mapping is inferred by code.
| # | Decision (owner supplies) | Owner value | Sign-off |
|---|---|---|---|
| 7 | Confirmed artist ↔ partner links (which `site_artist` maps to which `partner`). | _(blank)_ | |
| 8 | Confirmed product ↔ partner ownership for every product, including one-of-a-kind works. | _(blank)_ | |

---

## 5. Status

All rows in §1, §2 and §4 marked **PENDING DECISION** are **BLOCKED BY OWNER INPUT**.
The mechanics (row-locked reservations, TTL sweep, one-winner guarantee, explicit
stock initialisation, admin-only artist linking) are in place, but **no stock count,
partner ownership split, TTL approval, refund-eligibility rule or mapping is invented
or assumed**. Confirm each value out-of-band with the owner before any partner stock,
settlement or one-of-one release workflow is treated as ready.
