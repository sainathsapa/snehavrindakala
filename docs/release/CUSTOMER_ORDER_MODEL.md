# Customer-facing unified order model (Scenario B)

> Owner: AGENT A101 — SnehaVrinda Kala FINAL GO.
> Branch: `remediation/final-go`. Date: 2026-11-23.
>
> This document records (a) the model **as implemented** for showing a customer
> one order that spans multiple partner fulfilment groups, and (b) the policy
> decisions the owner must still make. Business outcomes are not invented here;
> where the code is silent, the item is marked **PENDING DECISION** and left for
> the owner to sign off.
>
> Source of truth:
> `apps/storefront/lib/customer-order/unified.ts`,
> `apps/storefront/lib/fulfilment/types.ts` (A47),
> `apps/storefront/db/migrations/002_partner_marketplace.sql`, and
> `docs/release/MIXED_CART_POLICY.md` (A86).

---

## 1. Implemented model (verified in code — not a decision)

- **One customer order, many fulfilment groups.** The customer still sees a
  single order, keyed by `fulfilment_group.customer_order_id` (the Medusa order
  id). Internally each owning partner gets exactly one independently managed
  `fulfilment_group` (`UNIQUE (customer_order_id, partner_id)`).
- **The view is a pure projection.** `buildCustomerOrderView(parentOrder,
  fulfilmentGroups, partnerDisplayDirectory?)` merges the parent order with its
  groups into one `CustomerOrderView`. It performs no I/O and **never mutates**
  the parent order, the groups, or any nested reference — including
  `payment_collections`. Output objects are fresh copies, so a caller cannot
  reach back into the inputs through the view.
- **Parent order / payment references are never altered or emitted.** The
  function reads only `id`, `display_id`, `created_at` and public line fields
  (`id`/`item_id`, `title`, `variant_title`, `quantity`). Payment status, amounts,
  currency, collections, customer and address data on the parent are ignored.
- **Partner identity is public display name only.** Ownership is derived from a
  group's `items[].item_id` matched to line-item ids. The internal `partner_id`
  is resolved through a caller-supplied **server-side** directory
  (`PartnerDisplayDirectory` = object / `Map` / resolver function) to the
  partner's public `display_name`. The internal id is never placed in the view.
  If no directory (or no entry) is supplied, the generic, non-identifying label
  `"Marketplace partner"` is used — never the raw id.
- **Strict private/financial-data allowlist.** The view emits only:
  `order_id`, `display_id`, `created_at`, `overall_status`, `items` (with
  `partner_display_name` + `fulfilment_status`), `fulfilment` (per-group
  progress), and a counts `summary`.
  It **never** contains: partner id or DB group id, legal name, contact email /
  phone, business or registration profiles, GSTIN, bank/payout/commission/
  earnings data, prices/taxes/discounts/currency, payment or refund fields,
  `assignment_history` (actor emails/notes), `rejection_reason`, `shipment_id`,
  `fulfilment_deadline`, or parent customer/address/payment data.
- **Unmapped items are shown, not hidden.** A parent line with no group (e.g. an
  unmapped product awaiting admin assignment) appears with
  `partner_display_name: null` and `fulfilment_status: null`. This mirrors
  `getUnassignedItems()` in `lib/fulfilment/allocate.ts`.

### Public API

```ts
overallStatus(groups: ReadonlyArray<{status}>): CustomerOverallStatus
buildCustomerOrderView(
  parentOrder: CustomerOrderSource,
  fulfilmentGroups: ReadonlyArray<FulfilmentGroup>,
  partnerDisplayDirectory?: PartnerDisplayDirectory
): CustomerOrderView
```

### Per-group progress

Each `fulfilment` entry carries `partner_display_name`, `status`, `item_count`,
`total_quantity`, `progress_stage` (0..5 along
`assigned → accepted → packing → ready_for_dispatch → dispatched → delivered`,
`-1` for `rejected`/`cancelled`) and a coarse `progress_label`
(`not_started`/`in_progress`/`shipped`/`delivered`/`cancelled`/`attention_needed`).

---

## 2. Overall-status derivation (implemented rule)

`overallStatus()` uses **only group statuses** (never parent or payment state).
Precedence, highest first:

| Condition (over N groups) | `overall_status` |
|---|---|
| N = 0 | `no_fulfilment` |
| all `delivered` | `fulfilled` |
| all `cancelled` | `cancelled` |
| any `rejected` | `attention_needed` |
| some `cancelled` (none rejected, not all cancelled) | `partially_cancelled` |
| some `delivered` (none rejected/cancelled) | `partially_fulfilled` |
| all `assigned` | `pending` |
| otherwise (at least one `accepted`/`packing`/`ready_for_dispatch`/`dispatched`) | `in_progress` |

`rejected` outranks `cancelled` because a rejected group still requires an
administrative decision and a customer-facing "needs attention" signal is safer
than implying a settled outcome. This precedence is an **implementation
convention, not an owner-signed policy** — the owner may override it (see §3).

---

## 3. Policies the owner must decide (blank decision templates)

Nothing below is read from code or inferred; fill and sign off. These mirror and
extend the open items in `MIXED_CART_POLICY.md` §2. The view deliberately makes
**no** claim about refunds, money, or who may cancel — those are owner-gated.

| # | Policy decision | Implemented today | PENDING DECISION — owner value | Owner sign-off |
|---|---|---|---|---|
| 1 | **Overall-status semantics.** Is the precedence in §2 the status the customer should see, including `attention_needed` for `rejected` and `partially_cancelled` when only some groups cancel? | §2 precedence, derived purely from group statuses. | _(blank — accept or revise precedence; define customer-facing wording)_ | |
| 2 | **Partial fulfilment.** May the order be delivered group-by-group, and what does "order complete" mean? | Groups transition independently; `partially_fulfilled` is reported, but no code blocks or requires all groups to finish. | _(blank — allowed / not allowed; completion rule)_ | |
| 3 | **Cancellation per group.** Who may cancel, at which statuses, with what notice/reason? | Partner `rejected` from `assigned`; admin `cancelGroupAsAdmin` from `assigned`/`rejected`. Mid-fulfilment (`accepted`..`dispatched`) cancellation is not an allowed transition. `rejection_reason` is stored but **not** exposed in the customer view. | _(blank — permitted actors, stages, whether to surface a reason to the customer)_ | |
| 4 | **Partial refunds.** If only some groups/items are cancelled or returned, how is the refund split, and is the partner's earning reversed only for those lines? | **Not in this module** (no financial fields by design). Refund execution is a separate admin flow; `refund_effect` is stored but not yet wired (see `PARTNER_BUSINESS_RULES.md` §2). | _(blank — partial-refund rule, per-line reversal scope, approval)_ | |
| 5 | **Refund/cancellation visibility to customer.** Should the view surface a "partial refund pending/issued" state, and once money is involved, which service owns that field? | Deliberately absent — the view never carries money state. | _(blank — owner of the customer-facing refund status and its source)_ | |
| 6 | **Partner display name source & change policy.** Which field is the public name, and should historical orders show the name at purchase time or the current name? | Uses `partner.display_name` from the server-side directory supplied by the caller. | _(blank — snapshot vs live name; rename handling)_ | |

---

## 4. Implemented vs pending — at a glance

**Implemented:** one unified customer order; all items annotated with public
partner display names; per-group fulfilment progress; deterministic overall
status from group statuses; unmapped items shown as unmapped; pure/read-only
projection; no parent/payment mutation; strict no-leak allowlist with no partner
id, no financial data, no private partner fields.

**Pending decisions (owner input):** status semantics and cancellation wording
(#1), partial-fulfilment completion rule (#2), group cancellation actors/stages
(#3), partial-refund and reversal scope (#4), customer-facing refund status
ownership (#5), and partner display-name source/snapshotting (#6). Items
**BLOCKED BY OWNER INPUT** until signed off.

**Consistency note:** whatever the owner decides here must not contradict the
signed partner agreement in `PARTNER_BUSINESS_RULES.md` (especially
cancellation/return ownership) or the mixed-cart policy in
`MIXED_CART_POLICY.md`. No value is assumed or invented.
