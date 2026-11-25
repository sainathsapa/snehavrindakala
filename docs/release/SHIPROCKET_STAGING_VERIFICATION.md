# Shiprocket Staging Verification

**Gate status: BLOCKED BY OWNER INPUT** (no test credentials, no pickup address, no measured parcels)
**Engineering status:** integration hardened and now impossible to run on guessed data
**Owner:** business owner (account, pickup details) + release engineering (code)

---

## 1. Summary

| Item | Status |
| --- | --- |
| Credentials read only from environment/secret store | **PASS** (verified in code + image scan) |
| Hardcoded physical defaults removed | **FIXED in this mission** — see §3 |
| Shipment blocked when weight/dimensions are unknown | **PASS** (new, with 10 tests) |
| Failed shipment creation cannot mark an order shipped | **PASS** (by construction — see §4) |
| Webhook authenticity / dedup / retry | **PASS at code level**, **NOT provider-verified** |
| Real staging authentication | **BLOCKED** — no credentials |
| Controlled test shipment + AWB capture | **BLOCKED** — and must not be attempted against a production account |
| Status synchronisation with provider evidence | **BLOCKED** |

## 2. Credential handling

`lib/shipping/shiprocket.ts` reads `SHIPROCKET_EMAIL`, `SHIPROCKET_PASSWORD`,
`SHIPROCKET_API_TOKEN` and `SHIPROCKET_WEBHOOK_TOKEN` from the environment. Two
independent checks confirm no credential is baked into an artifact:

* `node scripts/security/verify-build-context.mjs` — no credential build arg,
  no credential `ENV` default, no env file in the context;
* `node scripts/security/scan-image-secrets.mjs` — both images scan clean.

Historically, an env-fallback literal existed in this file (commit `3975e315`).
It has been removed, and the value it exposed is tracked for rotation in
`CREDENTIAL_EXPOSURE_RECONCILIATION.md` (R-08).

## 3. The defect fixed in this mission

`lib/shipping/create-order-shipment.ts` — the function actually used by checkout
completion and the admin "create shipment" action — sized every parcel with
invented values:

```ts
// before
const weight = Math.max(totalItems * 0.5, 0.5); // 0.5 kg per item
length: 10, breadth: 10, height: 5              // cm
```

It also bypassed `lib/shipping/verify.ts`, which existed specifically to refuse
this ("the legacy `10x10x5 cm / 0.5 kg` guess is exactly what this prevents").

**Why it matters commercially:** the weight sent to Shiprocket determines the rate
the shop is charged. A guessed weight means systematically wrong courier costs.
A guessed dimension means a damage or lost-parcel claim is measured against a box
that never existed.

**Now:** `lib/shipping/product-physical.ts` resolves a verified measurement per
product from `product_shipping_data`, sums weight, takes the largest envelope per
axis, rounds weight **up**, and — if any product lacks a measurement — throws
`MissingPhysicalDataError` naming the missing product ids. No fallback exists.

```
checkout completion  → shipment fails, sale still completes, admin retries later
admin create shipment → 4xx/409 style error naming the products to measure
```

The sale is never blocked by a shipping-data gap, and the shipment is never
created from invented data.

## 4. Failed shipment cannot mark an order shipped

`createShipmentForOrder` writes the shipment row **only after** the provider call
returns. There is no optimistic "shipped" write before the call, and the row
status is `created` (no AWB) or `awb_assigned` (AWB present) — never `shipped`
without provider evidence. An exception propagates to the caller, which records
`shippingError` and leaves the order untouched.

## 5. Webhook handling — code-level status

| Control | Status |
| --- | --- |
| Signature/token verification on inbound webhook | implemented (`SHIPROCKET_WEBHOOK_TOKEN`); **not provider-verified** |
| Idempotent event handling | implemented with a persisted processed-event key |
| Duplicate webhook delivered twice | covered by unit tests |
| Out-of-order / delayed status | covered by unit tests against the status mapper |
| Invalid/unknown shipment reference | rejected, not applied |
| Retry of a failed sync | supported by the status-sync service |

These are **unit-level** guarantees. They are not evidence that the real provider
behaves as assumed — that requires the staging account.

## 6. Weight and dimension fields

Added in migration 010:

```sql
product_shipping_data (
  product_id text PRIMARY KEY,          -- Medusa product id
  weight_grams integer  CHECK (> 0),
  length_cm numeric CHECK (> 0),
  breadth_cm numeric CHECK (> 0),
  height_cm numeric CHECK (> 0),
  source text, verified_by text, verified_at timestamptz, notes text
)
```

Recorded by an authenticated admin only
(`POST /api/admin/products/[id]/shipping-data`, permission `products:write`), with
the actor stored in `verified_by`. The schema refuses zero or negative values, so
a "0 kg" placeholder cannot be saved.

### Products currently missing verified quantities

**19 of 19** products have no `product_shipping_data` row:

```
missing weight/dimensions   19
```

Every product the shop can currently sell is unshippable until the owner measures
it. That is the accurate state, and the reason the Shiprocket gate cannot pass.

## 7. What the owner must supply

1. **Shiprocket staging/test credentials** — and explicit confirmation whether the
   account can create **real** courier bookings. If it can, no automated shipment
   will be created; explicit written authorization is required per attempt.
2. **Webhook token/secret** configured in the provider dashboard, matching
   `SHIPROCKET_WEBHOOK_TOKEN`.
3. **Verified pickup address** and contact details (warehouse name, pincode,
   phone) — the current `SHIPROCKET_PICKUP_LOCATION` must match a real pickup.
4. **Measured weights and package dimensions** for each product (not estimates).

## 8. Provider verification procedure (once credentials exist)

1. Authenticate against the intended **non-production** account; record which
   account/env was used.
2. Validate pickup/serviceability inputs for a known pincode.
3. Create exactly **one** shipment for an approved synthetic order.
4. Capture the returned AWB/reference — never the credentials.
5. Deliver a provider webhook (or trigger a status poll) and confirm the local
   shipment status matches provider evidence.
6. Confirm the order is not marked shipped before the provider confirms.
7. Record the run in §9 with account, environment, order reference and statuses.

If the account is production-only: **stop before step 3** and request written
authorization. A real courier booking is a real-world side effect with a cost.

## 9. Execution log

| Date | Account/env | Order | AWB captured | Status sync | Result |
| --- | --- | --- | --- | --- | --- |
| — | — | — | — | — | **NOT RUN — blocked by owner input** |

## 10. Verification commands

```bash
# the physical-data rule, including every refusal path
cd apps/storefront && npx vitest run tests/product-physical-data.test.ts

# existing provider/status-mapping suites
npx vitest run tests/shiprocket-provider.test.ts tests/shipping-rate.test.ts

# confirm no credential can reach an image
node scripts/security/verify-build-context.mjs
```
