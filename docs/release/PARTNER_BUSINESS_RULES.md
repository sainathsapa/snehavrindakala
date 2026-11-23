# Partner business rules — decision template (owner input required)

> Owner: AGENT A86 — SnehaVrinda Kala FINAL GO.
> Branch: `remediation/final-go`. Date: 2026-11-23.
>
> This document lists **every business decision that must be supplied by the owner**
> before partner settlements can be activated. These values cannot be inferred from
> code and are **never invented, defaulted or guessed**. Each row below is a blank
> template for the owner to fill, with the exact code/DB field that will hold it where
> one exists.
>
> Governing rule: **settlements are disabled until a commission policy is explicitly
> configured, approved and active.** No rate, payout term or partner identity is
> seeded by any migration (see `apps/storefront/db/migrations/003_marketplace_finance.sql`
> header and `lib/finance/types.ts` header). All paths below are relative to
> `apps/storefront/` unless stated otherwise.

---

## 1. Why settlements are currently disabled

- `commission_policy` is created **empty** by migration 003. `rate_percent` /
  `fixed_amount` have no defaults and a CHECK requires exactly one of them to be set.
- `commission_policy.status` defaults to `draft`; activation is only legal from
  `approved` **with a non-empty `approved_by`** (`lib/finance/commission-policy.ts`
  → `activatePolicy`).
- `policyConfigured()` returns true only for a policy that is `active`, has an
  approver, validates, and is inside its `effective_from`/`effective_to` window.
- The settlements API hard-refuses with HTTP 409 `UNCONFIGURED` when no configured
  policy exists (`app/api/admin/settlements/route.ts`), and the calculation layer
  throws "No active configured commission policy: refusing to settle"
  (`lib/finance/settlement.ts` → `selectPayableEntries`).
- A batch can only become `payment_completed` with real provider confirmation;
  creating a batch never moves money (`confirmPayment` / `hasProviderConfirmation`).

**Status: BLOCKED BY OWNER INPUT — settlements stay OFF until every decision below is
supplied in a signed document / approved partner-agreement record and the policy is
created, approved and activated by an authorised admin.**

---

## 2. Decisions held in the `commission_policy` table

Each row is a field the owner must decide and an authorised admin must enter. No
value is pre-filled by the application: the migration seeds none, and validation
rejects a missing or ambiguous rate.

| # | Decision (owner supplies) | `commission_policy` field | Allowed / observed values in code | Owner value | Owner sign-off |
|---|---|---|---|---|---|
| 1 | Commission **rate** — percent of basis **or** fixed amount per item | `rate_percent` **or** `fixed_amount` | Exactly one must be set (CHECK: `(rate_percent IS NOT NULL) <> (fixed_amount IS NOT NULL)`). Percent must be `> 0` and `<= 100`; fixed must be `> 0`. Both/neither ⇒ commission computes as **0** and validation fails. | _(blank — never guessed)_ | |
| 2 | Commission **basis**: gross item value or post-discount value | `rate_basis` | `gross_item_value` \| `discounted_item_value` | _(blank)_ | |
| 3 | Is **tax** included in the commission basis? | `tax_included` | boolean, must be set explicitly (no implicit default accepted by validation) | _(blank)_ | |
| 4 | Is **shipping** included in the commission basis? | `shipping_included` | boolean, must be set explicitly | _(blank)_ | |
| 5 | Effect of a **refund / cancellation** on earned commission | `refund_effect` | `reverse_earnings` \| `no_reversal` | _(blank)_ | |
| 6 | **When** an earning becomes payable | `payable_when` | `order_paid` \| `order_delivered` \| `return_window_elapsed` | _(blank)_ | |
| 7 | **Scope** of the policy (who it applies to) | `scope` + `scope_ref` | `global` \| `partner` \| `category` \| `product`; `scope_ref` required unless `global` | _(blank)_ | |
| 8 | Settlement **currency** | `currency` | free text, default column value `INR` — confirm explicitly | _(blank)_ | |
| 9 | Policy **effective window** | `effective_from`, `effective_to` | `effective_from` required and valid; `effective_to` optional, must be after `effective_from` | _(blank)_ | |
| 10 | Policy **name / version** for the agreement record | `name`, `version` | name required; version integer (default 1) | _(blank)_ | |

**Implementation note (important, do not misread):** `computeCommission` computes
`basis = (gross or gross − discount) + tax if included + shipping if included`,
then `commission = percent-of-basis or fixed`, and `payable = basis − commission`
(`lib/finance/commission-policy.ts`). `buildRefundReversal` writes a **new negative
row** linked by `reverses_entry_id`; historical money values are never UPDATEd
(`lib/finance/ledger.ts`).

**Wiring gap to record as pending:** `refund_effect` and `payable_when` are currently
**validated and stored but not consulted by the refund or settlement-selection code**
(no runtime branch reads them — verified by search across `apps/storefront`). Select
the intended value in the table above, and record that wiring the selected behaviour
into refund execution / payout eligibility is a **pending implementation decision**
to be completed and QA'd before those fields can be relied on automatically.

---

## 3. Decisions with **no** commission-policy field (record in the signed partner agreement)

These are required to activate settlements but are **not** represented in
`commission_policy`. They are supplied as an operational input / agreement record;
the named table column is where the system records the outcome where one exists.

| # | Decision (owner supplies) | Where it is recorded | Allowed / observed values in code | Owner value | Owner sign-off |
|---|---|---|---|---|---|
| 11 | **Settlement frequency / payout period** (e.g. weekly, monthly) and payout terms | `settlement_batch.period_start` / `period_end` — supplied by the operator when each batch is created | API requires valid, ordered dates; **no** frequency field exists in `commission_policy`. Frequency is an operational cadence, not a stored rule. | _(blank)_ | |
| 12 | **Payout provider** (bank / UPI / other) | `settlement_batch.provider`; `payout_reference`; `provider_confirmation` | `provider` is free text, recorded at `payment_initiated`; confirmation must be real (`confirmed: true` + success status or event id) — no adapter/provider is configured by default. | _(blank)_ | |
| 13 | Who is **authorised to approve / confirm payouts** | `settlement_batch.approved_by`, `payment_initiated_by`; admin permission gates | API gates: `finance:read`, `settlements:write` (`app/api/admin/settlements/route.ts`); approver identity required. Name the authorised people. | _(blank)_ | |
| 14 | **TDS / withholding** treatment (CA to confirm) | **No field exists** in `commission_policy`, `partner_earnings_ledger` or `settlement_batch` | Current commission maths has **no TDS deduction**. If TDS applies, this is a **gap**: the decision must be recorded externally and the deduction/behaviour implemented before settlements rely on it. | _(blank)_ | |
| 15 | **Legal identity** of each real partner | `partner.legal_name`, `registration_details`; link via `partner.artist_id` | Migration 002 creates no partner rows. `account_status` / `verification_status` are set by admin approval workflow, never auto-promoted (see `INVENTORY_OWNERSHIP_POLICY.md`). | _(blank)_ | |
| 16 | **Signed partner agreements** (proof of 1–15) | External signed document / partner-agreement record; reference in `partner.registration_details` and/or `partner_audit_log` | No structured agreement column exists. Confirm sign-off out-of-band; config is not activated without validated, approved rules (`OWNER_INPUT_REQUIRED.md` §"How to provide these safely"). | _(blank)_ | |
| 17 | **Cancellation / return ownership responsibility** per partner | External agreement (see also `MIXED_CART_POLICY.md`) | No per-partner responsibility field exists. Owner decides who bears return shipping and cancellation cost. | _(blank)_ | |

---

## 4. Activation checklist (all must be true)

1. All 17 decisions above are filled and signed off by the owner/CA.
2. An authorised admin creates `commission_policy` rows with exactly one of
   `rate_percent` / `fixed_amount`, explicit `tax_included` / `shipping_included`,
   chosen `rate_basis`, `refund_effect`, `payable_when`, scope, currency and window.
3. `validatePolicy` passes for each row (`lib/finance/commission-policy.ts`).
4. Each policy is moved `draft → approved` with `approved_by` set, then `→ active`
   via `activatePolicy` only from `approved`.
5. `policyConfigured(...)` returns true; the settlements API `configured` flag is true
   and `POST /api/admin/settlements` no longer returns 409.
6. The pending wiring gaps in §2 (refund_effect / payable_when) and the TDS gap in §3
   are either implemented+QA'd or explicitly waived in writing by the owner.

**No rate, basis, provider, frequency, TDS term, legal identity or agreement is
fabricated anywhere in this repository. Until the above is complete, the answer to
"are settlements live?" is NO.**
