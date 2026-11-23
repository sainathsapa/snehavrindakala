# Mixed-cart / multi-partner order policy — decision template (owner input required)

> Owner: AGENT A86 — SnehaVrinda Kala FINAL GO.
> Branch: `remediation/final-go`. Date: 2026-11-23.
>
> This document records (a) the model **as implemented** for carts that span more
> than one partner, and (b) the policies the owner must still decide. Business
> outcomes are not invented here; where the code is silent, the item is marked
> **PENDING DECISION** and left blank for the owner.
>
> Source of truth: `apps/storefront/db/migrations/002_partner_marketplace.sql`,
> `lib/fulfilment/{types,allocate,store}.ts` (all under `apps/storefront/`).

---

## 1. Implemented model (verified in code — not a decision)

- **One parent customer order.** A customer still sees a single order. Internally
  it is keyed by `fulfilment_group.customer_order_id` (the Medusa order id).
  (`lib/fulfilment/types.ts` header; migration 002 comment at lines 98–99.)
- **One fulfilment group per partner.** `fulfilment_group` has
  `UNIQUE (customer_order_id, partner_id)`; a partner can never get two groups for
  the same order. `allocateItemsToPartners()` groups line items by the partner that
  owns each product and produces one group per distinct partner.
  (`lib/fulfilment/allocate.ts`; `assertNoDuplicateAllocation`.)
- **Partner identity is server-derived.** Partner IDs are **never** trusted from
  the client; all partner-facing reads/writes are scoped by the verified session's
  `PartnerContext.partnerId` and the DB layer. (Per the FINAL GO governing rules and
  `lib/partner/types.ts`.) The partner for a line comes from an authoritative
  `product_id → partner_id` map passed to allocation.
- **Unmapped items are not invented.** Line items whose product has no partner
  mapping are intentionally omitted from groups and remain **unassigned**, to be
  mapped by an admin before fulfilment — no partner identity is fabricated.
  (`getUnassignedItems()`; `listAllocationQueue()` finds `status='assigned'`.)
- **Append-only status history.** Every transition writes an `AssignmentEvent` into
  `assignment_history`; `fulfilment_group` also stores `rejection_reason`,
  `fulfilment_deadline` and `shipment_id`.
- **Strictly forward-only status machine** (`lib/fulfilment/allocate.ts` →
  `TRANSITIONS`, `TERMINAL_STATUSES`):

  ```
  assigned ──> accepted ──> packing ──> ready_for_dispatch ──> dispatched ──> delivered (terminal)
      ├──────> rejected ──> cancelled (terminal)
      └──────> cancelled (terminal, admin)
  ```

  `rejected` can only go to `cancelled`; `delivered` and `cancelled` are terminal.
- **No financial fields in fulfilment.** Fulfilment types deliberately contain
  **no payment, refund, price or payout fields**; partner fulfilment cannot read or
  mutate financial state (`lib/fulfilment/types.ts` header). Refund execution and the
  earnings ledger live in separate admin-only modules.
- **Admin repair tools.** `reassignGroup()` moves a group to another partner only if
  that partner exists and is `active`, keeps one-group-per-partner, and records the
  move in history. `cancelGroupAsAdmin()` cancels through the same status machine.
  (`lib/fulfilment/store.ts`.)

---

## 2. Policies the owner must decide (blank decision templates)

None of the values below are read from code or inferred; fill and sign off.

| # | Policy decision | Implemented today | PENDING DECISION — owner value | Owner sign-off |
|---|---|---|---|---|
| 1 | **Partial fulfilment.** May a customer order be delivered group-by-group, and must all groups reach `delivered` before the parent order is considered complete? | Groups transition independently, so per-partner partial fulfilment is structurally possible. **No order-level aggregation rule** exists; no code blocks or requires all groups to finish. | _(blank — e.g. allowed / not allowed; how the customer order status is presented)_ | |
| 2 | **Cancellation per group.** Who may cancel a group, at which statuses, and with what reason/notice? | Partner `rejected` from `assigned`; admin `cancelGroupAsAdmin` from `assigned`/`rejected`. Cancellation from `accepted`…`dispatched` is **not** an allowed transition. Reason stored in `rejection_reason`. | _(blank — permitted actors and stages; whether mid-fulfilment cancellation is needed)_ | |
| 3 | **Partial refunds.** If only some groups/items are cancelled or returned, how is the refund split, and is the partner's earning reversed only for those lines? | **Not implemented here** — no refund fields in fulfilment. Refund execution is a separate admin flow; `buildRefundReversal` creates one negative ledger row per original entry. `refund_effect` (`reverse_earnings`/`no_reversal`) is stored but **not yet wired** to refund execution (see `PARTNER_BUSINESS_RULES.md` §2). | _(blank — partial-refund rule, per-line reversal scope, approval)_ | |
| 4 | **Return shipping bearer.** Which party pays return freight, and under what conditions (defect, buyer remorse, wrong item)? | **Not represented anywhere** — no field in `fulfilment_group`, `partner_earnings_ledger` or `settlement_batch` for return-shipping responsibility. | _(blank — per-partner / per-reason responsibility)_ | |
| 5 | **Deadline rules.** How is `fulfilment_deadline` computed, what is the grace period, and what happens on breach (escalation, auto-cancel, customer notice)? | `fulfilment_deadline` column exists and is **shown in the admin allocations view**, but **no SLA/enforcement logic** reads it — no auto-cancel, escalation or breach action. | _(blank — deadline formula, grace, breach action)_ | |
| 6 | **Unassigned-item handling.** How long may an unmapped item remain unassigned, and who must map it? | Unmapped items stay unassigned and surface in the admin "assigned" queue; there is no timeout or auto-assignment. | _(blank — owner of mapping, any escalation SLA)_ | |

---

## 3. Implemented vs pending — at a glance

**Implemented:** one parent order; one fulfilment group per partner with a DB
uniqueness constraint; grouping by authoritative product→partner map; unassigned
items left unmapped rather than fabricated; append-only history; forward-only status
machine with reject/cancel branches; partner-scoped reads; admin reassign/cancel;
no financial data in the partner fulfilment surface.

**Pending decisions (owner input):** partial-fulfilment completion rule (#1),
cancellation actors/stages (#2), partial-refund and reversal scope (#3), return-shipping
responsibility (#4), fulfilment-deadline computation and breach action (#5), and
unassigned-item ownership/SLA (#6). Also pending implementation: wiring `refund_effect`
and `payable_when` into automated behaviour — recorded in `PARTNER_BUSINESS_RULES.md`.

**Consistency note:** whatever the owner decides in this document must not contradict
the signed partner agreement recorded for `PARTNER_BUSINESS_RULES.md` (especially
cancellation/return ownership, item 17 there). No value here is assumed or invented;
the status column is **BLOCKED BY OWNER INPUT** for every row above until signed off.
