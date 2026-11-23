# Refund and return policy — SnehaVrinda Kala

> Status: **policy description, not a promise that live refunds are enabled.**
> Refunds and returns move money and stock, so every money-moving step is
> owner-gated and provider-confirmed. This document invents no refund window,
> commission rate, or credential. Owner inputs are tracked in
> `docs/release/OWNER_INPUT_REQUIRED.md` ("Payments (Razorpay)", "Email (SES)",
> "Partner business", "Finance & legal"). Never put keys or secrets in this
> document, source, tickets or chat.

Relevant code and schema:

- `apps/storefront/db/migrations/004_payment_reconciliation.sql` — `refund_execution`
- `apps/storefront/db/migrations/003_marketplace_finance.sql` — `partner_earnings_ledger`
- `apps/storefront/lib/refund-approvals.ts` — two-person approval on `order_refunds`
- `apps/storefront/lib/payments/refund-execution.ts` — provider execution
- `apps/storefront/lib/payments/refund-provider.ts` — provider adapter
- `apps/storefront/lib/returns/process.ts` — return eligibility, decisions, restock
- `apps/storefront/lib/finance/ledger.ts` — ledger reversal rows

## Two-person approval (requester != approver)

Refund approval is a permission, not a transfer. `order_refunds` starts as
`pending` for refunds at or above `REFUND_APPROVAL_THRESHOLD` and is
auto-approved below it (the threshold is owner-supplied; a blank value falls
back to the code default, and zero means "every refund needs two people" — see
`refundApprovalThreshold()` and `needsSecondApproval()` in
`lib/refund-approvals.ts`). No threshold amount is asserted in this document.

Two distinct controls enforce separation of duties:

1. **Decision gate** — `canDecide()` / `decideRefund()` in `lib/refund-approvals.ts`
   refuse to let the requester approve their own refund
   (`requested_by === actor` -> error). Routes
   `POST /api/admin/refunds` and the order refund route
   `POST /api/admin/orders/[id]/refund` use signed-in admin identity from the
   session, not the request body.
2. **Execution gate** — `refund_execution` carries a SQL
   `CHECK (requested_by <> approved_by)` (migration 004), and
   `assertDualControl()` in `lib/payments/refund-execution.ts` repeats the check
   before any provider call. In `POST /api/admin/refunds/execute`
   (`apps/storefront/app/api/admin/refunds/execute/route.ts`) the requester is
   read from the approval row and the approver from the session; a match returns
   HTTP 403 with "You requested this refund, so someone else has to execute it."
   Execution also requires `refunds:approve` plus a signed-in identity.

The intent is deliberate: a single compromised or hurried account, or the person
who made the mistake being refunded, cannot both ask for and release the money.

## Full vs partial refunds

The refund amount is supplied explicitly in minor units (paise) in
`POST /api/admin/orders/[id]/refund`. The route reads the order's
`refundable_total` (falling back to `total`), subtracts the sum of existing
`pending`, `approved` and `completed` refunds, and rejects any amount that
exceeds the remaining refundable total (`remainingRefundable`). This permits a
**full** refund (the full remaining total) or a **partial** refund (any positive
amount within it); the rules do not force one or the other, and no fixed
percentage or window is encoded. Refund window / policy rules are an owner
decision — `docs/release/OWNER_INPUT_REQUIRED.md` lists "Approval of refund
policy (windows, partial-refund rules)" as outstanding.

Creating a refund request is explicitly **not** a payout: the endpoint responds
`"Recorded. The refund is released from the payments dashboard."` A row in
`order_refunds` (even `status = 'approved'`) means permission was granted, not
that money moved.

## Provider confirmation before success

`lib/payments/refund-execution.ts` is the only path that can say money moved:

1. Re-verify approval: `order_refunds` status must be `approved` or `completed`,
   have a recorded `approved_by`, and belong to the same order.
2. Claim an `idempotency_key` with `INSERT ... ON CONFLICT DO NOTHING` into
   `refund_execution` (status `initiated`). Only the caller that claimed the row
   contacts the provider. A replay returns the stored execution with `reused: true`
   and makes **no** second provider call.
3. Call the injected `RefundProvider.refund()`. On error the row is set to
   `failed` with `failure_reason`.
4. Mark `provider_confirmed` **only** if `isProviderRefundConfirmed()` accepts
   the provider status (`processed`, `confirmed`, `success`, `succeeded`,
   `completed`, `captured`). Otherwise the row stays `initiated` with a note that
   the provider has not confirmed — not a silent success.
   `provider_refund_id` and `provider_response` are stored as evidence.
5. `syncRefundStatus()` can refresh an execution from the provider, but a
   provider that has not confirmed never becomes `provider_confirmed` through
   that path.

The live adapter `RazorpayRefundProvider` refuses to be constructed without
owner-supplied `RAZORPAY_KEY_ID` / `RAZORPAY_SECRET` (or
`RAZORPAY_KEY_SECRET`) and requires a real `paymentId` — it never guesses one.
Without credentials in production, `getRefundProvider()` returns an
`UnconfiguredRefundProvider` that throws loudly. Tests use `TestRefundProvider`,
which returns deterministic fake ids and is **not** evidence of real money
movement. The execute response itself says it plainly: "The provider confirmed
this refund; money has moved" vs "The provider has not confirmed this refund
yet; nothing is final."

## Ledger reversal as new rows

Partners earn through the append-only `partner_earnings_ledger` (migration 003).
Corrections are never in-place edits: `buildRefundReversal()` in
`lib/finance/ledger.ts` creates a **new** `refund_reversal` row with
negative money values (gross, discount, tax, shipping, commission, payable),
`reverses_entry_id` pointing at the original entry, and its own unique
`idempotency_key`. `postEntries()` inserts with
`ON CONFLICT (idempotency_key) DO NOTHING`, so a redelivered event cannot post a
second reversal. The `refund_execution.ledger_reversal_key` column ties the
provider refund to the reversal row that must be posted. Historical money values
are never `UPDATE`d.

Whether a refund reverses earnings at all is a per-policy owner setting:
`commission_policy.refund_effect` is `reverse_earnings` (default) or
`no_reversal`, chosen by a person, not inferred.

## Returns: restock eligibility is owner-gated

Return rules live in `apps/storefront/lib/returns/process.ts`. Eligibility is a
pure decision that takes the return window as an **explicit argument**;
`configuredReturnWindowDays()` reads `RETURN_WINDOW_DAYS` and returns `null` when
unset. An unconfigured window makes a return ineligible with the reason
"Return window is not configured; owner decision required." — no default window
is invented. `DELIVERED_STATUSES`, reject-with-reason requirements
(`decideReturn`), and status transitions are code rules; the actual window and
policy are owner input (`docs/release/OWNER_INPUT_REQUIRED.md`, "Approval of
refund policy").

Restocking is decided conservatively by `restockDecision()`: digital, custom and
made-to-order items are never restocked, and a physical item is restocked only
when its recorded condition is in `RESTOCKABLE_CONDITIONS`
(`new`, `as_new`, `unopened`, `sealed`, `like_new`, `excellent`, `good`,
`resellable`). The refund execution row records `inventory_restored` so a
reviewer can see what happened. Note the honest boundary: when there is no
resellable item/condition to restore, stock is not blindly put back — actual
inventory restoration (`lib/inventory.ts` `restoreSoldForOrder`) is a deliberate
action, and whether a given return qualifies remains an owner/operator decision
within these rules. `return_requests` has no decision/refund-link columns, so
decision metadata and the refund link are recorded in `audit_log`
(`updateReturn`, `linkRefund`, `getLinkedRefund`).

## Customer notification requires SES (owner-gated)

The storefront does not send email by itself. `apps/storefront/lib/email.ts`
delegates to the backend notification service (`POST
/store/notifications/send`), whose transport is SES. SES is not configured in
this repository: `docs/release/OWNER_INPUT_REQUIRED.md` lists the verified
sender/domain, `AWS_REGION`, SES credentials via IAM role or secret manager,
`FROM_EMAIL`, and one controlled test recipient as outstanding inputs. Until
those exist, sends are reported as `skipped` (no transport) rather than `sent`,
and `sendOrderConfirmation()` returns `false`. The same applies to other
outbound mail (e.g. `lib/work-alerts.ts` keeps `notified_at` as an operator
mark, never claiming a letter was sent).

Therefore a customer-facing "your refund/return was completed" notification is
**owner-gated**: it must not be treated as delivered until SES is configured
and delivery is verified to the controlled test recipient. Do not claim a
customer was notified based on a local status change or a queued outbox row.
The outbox (`apps/storefront/lib/outbox.ts`, admin view
`apps/storefront/app/admin/outbox/page.tsx`) is the durable record of attempted
delivery (`sent` with an SES message id vs `skipped`/`failed`).

## Verification (no live money)

Local, deterministic tests:

```
cd apps/storefront
npx vitest run tests/refund-approvals.test.ts
npx vitest run tests/refund-execution.test.ts
npx vitest run tests/finance-policy.test.ts
```

Do **not** run `pnpm test` / `pnpm typecheck` (the Lead integrates those).
Verifying a real refund end-to-end needs owner-supplied sandbox Razorpay keys, a
real payment id, and SES delivery verification — none are present in this
repository.
