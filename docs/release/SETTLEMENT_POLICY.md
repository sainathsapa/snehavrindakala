# Settlement policy — SnehaVrinda Kala

> Status: **policy description, not a promise that payouts are live.**
> Settlement is owner-gated. No commission **rate**, payout provider, payout
> terms or legal partner identity is assumed here — see
> `docs/release/OWNER_INPUT_REQUIRED.md` ("Partner business", "Finance & legal").
> Never put keys or secrets in this document, source, tickets or chat.

## What a settlement batch is

A settlement batch (`settlement_batch`, migration
`apps/storefront/db/migrations/003_marketplace_finance.sql`) is an internal
accounting object. It groups payable, unassigned rows of the immutable partner
earnings ledger (`partner_earnings_ledger`) for one period. The batch and its
line items (`settlement_batch_item`) are created by
`apps/storefront/lib/finance/settlement.ts` and exposed through:

- `GET/POST /api/admin/settlements` — `apps/storefront/app/api/admin/settlements/route.ts`
- `GET/POST /api/admin/settlements/[id]` — `apps/storefront/app/api/admin/settlements/[id]/route.ts`
- read-only admin view — `apps/storefront/app/admin/marketplace/settlements/page.tsx`
- read-only partner view — `apps/storefront/app/partner/settlements/page.tsx`

## Hard preconditions (owner input required)

A batch cannot be created until an **active, configured, approved** commission
policy exists. `policyConfigured()` in
`apps/storefront/lib/finance/commission-policy.ts` is the single guard; the
`POST /api/admin/settlements` route returns HTTP 409 with
`"UNCONFIGURED: no active approved commission policy — refusing to create a
settlement"` while it is false. Commission is never guessed: exactly one of
`rate_percent` / `fixed_amount` must be explicitly configured, `refund_effect`,
`rate_basis`, tax/shipping inclusion and `payable_when` must be set by a person,
and a policy can only become `active` from `approved` with a recorded
`approved_by` (`activatePolicy`). Supplying these values is an owner decision
recorded in `docs/release/OWNER_INPUT_REQUIRED.md`; this document invents none.

Only earning rows that are `entry_type = 'earning'`, unassigned
(`settlement_batch_id IS NULL`), linked to a configured policy and with a
positive `payable_amount` are eligible (`selectPayableEntries`,
`listEligibleLedgerEntries`). Persisting a batch only writes a settlement marker
onto the ledger rows; money values are never `UPDATE`d.

## State machine

```
calculated ──approve──▶ approved ──initiate──▶ payment_initiated ──confirm──▶ payment_completed
                          │                        │
                          └──────── fail ───────────┴──▶ payment_failed
```

The status column and its CHECK constraint live in `settlement_batch` (migration
003). Every transition is a guarded, conditional `UPDATE ... WHERE status = <expected> RETURNING *`
in `apps/storefront/lib/finance/settlement.ts`; a stale or wrong-state call
throws ("batch not found or in the wrong state") instead of silently advancing.

| From | Action | To | Gate / recorded fields |
|------|--------|----|------------------------|
| `calculated` | `approveBatch(id, approver)` | `approved` | `approver` identity is required; sets `approved_by`, `approved_at` |
| `approved` | `markPaymentInitiated(id, actor, provider)` | `payment_initiated` | requires `actor` and `provider`; sets `payment_initiated_by`, `provider` |
| `payment_initiated` | `confirmPayment(id, providerRef, confirmation)` | `payment_completed` | requires a non-empty `providerRef` **and** real provider confirmation; sets `payout_reference`, `provider_confirmation` |
| `approved` or `payment_initiated` | `failPayment(id, reason)` | `payment_failed` | requires a `reason`; sets `failure_reason` |

`payment_failed` is a terminal record of a failed payout attempt; the runbook
for creating a corrected batch is an operational decision, not an automatic
retry. `payment_completed` is the only status that means money moved.

### Dual control and permissions

- All state transitions go through `POST /api/admin/settlements/[id]` with the
  `settlements:write` permission and a signed-in admin identity; reads need
  `finance:read`. The library functions deliberately assume the caller already
  checked permission at the API boundary (see the header comment of
  `settlement.ts`).
- `approve`, `initiate`, `confirm` and `fail` are separate actions with separate
  audit rows written via `auditFinanceAction()` (`partner_audit_log`):
  `settlement.created`, `settlement.approved`, `settlement.payment_initiated`,
  `settlement.payment_completed`, `settlement.payment_failed`. The actor email and
  role are taken from the admin session, not the request body.
- Note the boundary honestly: the settlement batch itself enforces that an
  approver identity exists and that each step is attributed and audited, but
  migration 003 does **not** add a SQL `CHECK` that the settlement approver
  differs from the initiator. Separating those two people is an operational
  control for the owner to enforce via distinct admin accounts/roles; where a
  `requester <> approver` check *is* enforced in the database it is on refunds
  (`refund_execution`, migration 004 — see `REFUND_AND_RETURN_POLICY.md`).

## Why "record created" is not "paid"

Creating a batch (`status = 'calculated'`) only selects ledger rows, sums them and
writes rows. No bank/UPI call is made, no `provider` or `payout_reference` is set,
and nothing reaches a partner. Approving and initiating are internal permissions
and intent. A batch becomes `payment_completed` **only** via `confirmPayment`
with real provider confirmation. The read-only admin page states this directly:
"a batch is only paid once its status is `payment_completed` with a provider
confirmation."

The live payout call/verification itself is **not** implemented in this codebase:
the settlement module records the transfer and its confirmation, but does not
call a payout API. Until a payout provider integration exists and is configured
with owner-supplied credentials, `confirm` can only be used honestly when an
operator has actually verified the transfer at the provider and supplies the
matching reference and confirmation object. This is a known owner-gated gap
recorded in `docs/release/OWNER_INPUT_REQUIRED.md` ("Payout provider ... and who
is authorized to confirm payouts").

## Provider confirmation requirement

`hasProviderConfirmation()` in `settlement.ts` accepts a confirmation only when:

- `confirmation.confirmed === true`, and
- either a success `status` (`captured`, `success`, `succeeded`, `paid`,
  `completed`, case-insensitive) **or** a non-empty `provider_event_id`.

A missing/blank `providerRef`, or a confirmation that fails that check, is
rejected with "Provider confirmation is required before a batch can be marked
paid". The stored `provider_confirmation` JSON and `payout_reference` are the
audit evidence that money moved; an internal status string alone is not.
Operators must not mark a batch `payment_completed` on the basis of an
unverified internal record or a browser/UI success message — the same
provider-is-the-source-of-truth rule used for payments (see
`RECONCILIATION_RUNBOOK.md`) applies to payouts.

## Partner visibility boundaries

Partners see **only their own** data, read-only, through the tenant portal:

- `apps/storefront/app/partner/earnings/page.tsx` and
  `apps/storefront/app/partner/statements/page.tsx` call `getPartnerEarnings(ctx)`
  from `apps/storefront/lib/partner/repository.ts`, which binds `ctx.partnerId`.
  Access requires the `earnings:read` partner permission.
- `apps/storefront/app/partner/settlements/page.tsx` uses `tenantQuery` with a
  `WHERE sbi.partner_id = {partner}` predicate and explicitly does **not** sum
  the batch's global total, so one partner cannot see another partner's figures.
- Partner pages assert that no payout is executed from the portal and that
  `payment_completed` is final only once the provider has confirmed it.

Platform-wide batch listing (`listBatches`, the admin settlement page) is an
internal admin view gated on `finance:read` / `partners:read`; it is not exposed
to partners. Per the shared contract
(`docs/release/AGENT_CONTRACT.md`), all partner-facing reads derive the tenant
id from server-side session context — a `partner_id` from a request body, query
or header is never used in a query.

## Verification (no live money)

Local, deterministic tests cover the state machine and guards without moving
money:

```
cd apps/storefront
npx vitest run tests/finance-policy.test.ts
npx vitest run tests/allocation.test.ts
```

Do **not** run `pnpm test` / `pnpm typecheck` (the Lead integrates those).
Schema checks are `node scripts/migrate.mjs` and `node scripts/verify-schema.mjs`
from `apps/storefront`. Verifying a real payout end-to-end additionally needs the
owner-supplied payout provider credentials and written authorization — none are
present in this repository.
