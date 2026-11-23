# Engineering Gap Closure — Shared Agent Contract

> Branch: `remediation/engineering-gap-closure` (from `remediation/final-go` @ `4a597ca`)
> Lead / migration owner: **AGENT 00**. Read this before writing any code.

## Governing rules
1. **Never rewrite history, never force-push, never reset.** Do not commit, stage,
   checkout, merge or otherwise touch git — the Lead integrates all work.
2. **No owner-input fabrication**: no credentials, partner identities, rates,
   GSTIN, stock values, legal sign-off, or live payments/emails/payouts/deploys.
   Sandbox/test adapters only.
3. **Tenant isolation**: partner IDs always from the signed server-side session,
   never from client input. Preserve this invariant in every change.
4. **No weakened assertions.** Add tests; do not delete or loosen existing ones.
5. **Fail closed** on unknown roles/secrets/invalid signatures.
6. Work only inside your **owned files** listed below. If you need a change in a
   file you do not own, submit a request in your final report instead of editing.
7. The Lead re-runs the full suite and decides gate status. Agents may report
   single-file test results but may never mark a gate PASS.

## Migration ownership (STRICT)
AGENT 00 is the sole migration coordinator. Reserved filenames (do not deviate,
do not create other `NNN_*.sql` files):

| Agent | Reserved migration | Purpose |
|---|---|---|
| A03 | `005_notification_retry.sql` | attempts/backoff/terminal state/SES events |
| A07 | `006_role_namespacing.sql` | namespaced role values + mapping |
| A04 | `007_refund_inventory.sql` | restoration state / inventory movement |
| A05 | `008_finance_constraints.sql` | refund_effect/payable_when + DB approver!=initiator |
| A06 | `009_reservation_hardening.sql` | reservation partial-unique index + safeguards |

Migrations must be additive, idempotent (`IF NOT EXISTS`, `ON CONFLICT DO
NOTHING`), never delete/alter existing business data, and include an explicit
forward-recovery note. Report existing-data implications (GAP-07 requires
checking historical invalid data before adding the approver constraint).

## File ownership (STRICT — do not edit outside this list)
- **A01 Razorpay webhook**: NEW `app/api/webhooks/razorpay/route.ts`, NEW
  `lib/payments/webhook.ts`, NEW `tests/qa-webhook-endpoint.test.ts`; MAY edit
  `lib/payments/events.ts` and `lib/payments/reconciliation.ts` only if strictly
  required (report any such edit). No new migration unless you submit a proposal
  to the Lead (next free number is `010`).
- **A02 Audit coverage**: `lib/partner-audit/audit.ts`, `lib/audit.ts`, route files
  under `app/api/partner/team/**`, `app/api/partner/products/**`,
  `app/api/partner/orders/[id]/{accept,reject,fulfil}/route.ts`,
  `app/api/partner/profile/route.ts`, `app/api/admin/refunds/**`,
  `app/api/admin/partner-applications/**`, `app/api/admin/set-platform-mode/route.ts`,
  `lib/partner-onboarding/review.ts`; NEW `tests/qa-audit-coverage.test.ts`.
- **A03 Notifications**: `lib/notifications.ts`, `lib/outbox.ts`,
  `apps/backend/src/modules/notification/**`; NEW `app/api/webhooks/ses/route.ts`;
  NEW reserved migration; NEW `tests/qa-notification-retry.test.ts`.
- **A04 Refund/inventory**: `lib/payments/refund-execution.ts`, `lib/returns/process.ts`,
  `lib/inventory.ts`; reserved migration; NEW `tests/qa-refund-inventory.test.ts`.
- **A05 Finance policy**: `lib/finance/commission-policy.ts`, `lib/finance/settlement.ts`,
  `lib/finance/types.ts`, `lib/finance/ledger.ts`; reserved migration; NEW
  `tests/qa-finance-policy.test.ts`.
- **A06 Reservation hardening**: `lib/fulfilment/store.ts`, `lib/fulfilment/allocate.ts`;
  reserved migration; NEW `tests/qa-reservation-hardening.test.ts`.
- **A07 Role namespacing**: `lib/partner/types.ts`, `lib/partner/rbac.ts`,
  `lib/rbac.ts`, `lib/partner/session.ts`, `lib/partner/context.ts`,
  `lib/admin-session.ts`, `app/admin/actions.ts`, partner onboarding/team role code,
  seeds/fixtures, ALL affected test files; reserved migration. **Preserve
  `platformRoleOrNull()` and the GAP-01 boundary fix in `getAdminIdentity()`.**
- **A08 Lazy DDL removal**: the 28 handlers listed in `scripts/verify-schema.mjs`
  `HIGH_TRAFFIC_HANDLERS`, `db/schema.sql`, `scripts/verify-schema.mjs` (restore the
  HARD source gate), NEW `tests/qa-no-runtime-ddl.test.ts`. Runs AFTER A02/A03.
- **A09 Partner nav**: `app/partner/components/partner-nav.tsx` (and layout only if
  required); NEW `tests/partner-nav.test.ts`.
- **A10 Independent QA**: NEW `tests/qa-gap-closure*.test.ts` files only and
  `docs/release/QA_GAP_CLOSURE_REPORT.md`; runs the full suite. Runs LAST.

## Verification expectation
Agents may run `cd apps/storefront && npx vitest run tests/<their-file>.test.ts`.
Because agents edit concurrently, transient failures from other agents' in-flight
files are expected; report your own test result honestly and let the Lead do the
final integrated full-suite run. Do NOT run `pnpm`-wide commands (turbo caches can
mask other agents' partial state).
