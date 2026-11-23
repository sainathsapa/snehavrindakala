# FINAL GO — Agent assignments & file ownership

Branch model: all implementation lands on `remediation/final-go`. The Lead defines
the shared partner contracts first; downstream agents consume them. Concurrent
agents own **disjoint file sets** — no two agents edit the same file. The Lead
reviews every diff before integration and re-runs all verification independently.

## Shared contracts (defined by AGENT 00 before downstream work)

- `apps/storefront/lib/partner/types.ts` — partner, membership, context, roles.
- `apps/storefront/lib/partner/session.ts` — signed partner session (cookie `svk_partner_session`).
- `apps/storefront/lib/partner/context.ts` — `requirePartnerContext()` (server-only, derives partner_id).
- `apps/storefront/lib/partner/repository.ts` — all queries scoped by `partner_id`.
- `apps/storefront/lib/partner/rbac.ts` — partner role → permission matrix (fail closed).
- `apps/storefront/db/migrations/002_partner_marketplace.sql` — partner tables (migration owner: A00).
- `apps/storefront/lib/partner/password.ts` — hashing/verification (scrypt).

Downstream agents MUST call the context/repository helpers; they MUST NOT read a
partner id from request bodies, query strings or headers.

## Agent roster

| ID | Workstream | Owned files (exclusive) | Depends on |
|---|---|---|---|
| A00 | CTO / Lead — baseline, architecture, contracts, tenant isolation core, migration coordination, integration, review, release assessment | `lib/partner/**`, `db/migrations/**`, docs/release/**, root config | — |
| A01 | Partner core architecture + tenant security | *absorbed into A00 (critical-path contracts implemented by Lead)* | — |
| A02 | Onboarding, auth portal, partner dashboard/UI | `app/partner/**`, `app/api/partner/**`, `app/[locale]/partner/apply/**`, `app/api/store/partner-applications/**`, `app/admin/partner-applications/**`, `app/api/admin/partner-applications/**`, `lib/partner-portal/**` | A00 contracts |
| A03 | Order allocation + multi-partner fulfilment | `lib/fulfilment/**`, `app/api/admin/allocations/**`, `app/api/partner/orders/**` (co-owned with A02 portal nav only), `tests/allocation.test.ts`, `tests/fulfilment-isolation.test.ts` | A00 contracts |
| A04 | Commission policy, ledger, settlements | `lib/finance/**`, `app/api/admin/settlements/**`, `app/api/admin/commission-policies/**`, `app/api/partner/earnings/**` (data via `lib/finance`), `tests/finance-*.test.ts` | A00 contracts |
| A05 | Payment reconciliation + refunds + returns | `lib/payments/**`, `app/api/admin/reconciliation/**`, `app/api/admin/refunds/execute/**`, `app/api/cron/reconcile-payments/**`, `tests/reconciliation*.test.ts`, `tests/refund-*.test.ts` | A00 contracts |
| A06 | Shipping/fulfilment verification | `lib/shipping/verify.ts`, `tests/shipping-lifecycle.test.ts`, docs note | existing `lib/shipping/**` (read-only) |
| A07 | DB integrity + migrations | `db/migrate.ts`, `scripts/migrate.mjs`, `scripts/verify-schema.mjs`, `db/migrations/README.md`, `tests/migration-*.test.ts`, lazy-DDL removal in existing handlers | A00 migration files (read-only to A07) |
| A08 | CI/CD, dependency security, secret scanning, prod startup validation | `.github/workflows/**`, `scripts/audit-deps.mjs`, `scripts/secret-scan.mjs`, `lib/startup-validation.ts`, `tests/startup-validation.test.ts`, `docs/release/CI_SECURITY.md` | — |
| A09 | Customer/admin/business integration | `app/admin/partners-v2/**` (new unified screens), `app/api/admin/marketplace/**`, `tests/integration-*.test.ts` | A00, A02, A04 |
| A10 | Independent QA + E2E (release gate) | `e2e/**`, `tests/qa-*.test.ts`, `docs/release/QA_REPORT.md`; writes findings to `FINAL_GO_BLOCKERS.md` via Lead | all |

## Conflict-avoidance contract

- A00 is the sole migration owner: only A00 edits files under `db/migrations/**`
  and `db/schema.sql`. A07 builds the runner but does not edit migration SQL.
- A02 owns all `app/partner/**` and `app/api/partner/**` files. A03/A04 expose
  data/functions through `lib/fulfilment/**` and `lib/finance/**`; A02 only calls
  those libraries and may add navigation links inside `app/partner/**`.
- No agent edits files owned by another agent without an explicit Lead handoff.
- Every agent adds tests for its own code; A00 + A10 independently re-run them.

## Owner-gated (never faked)

Razorpay sandbox/live keys, SES sender/creds, Shiprocket creds + webhook token,
partner identities, commission rates/basis, payout terms, GSTIN/HSN, seller legal
identity, real product media/stock, production domain/DNS/TLS/secrets, and
credential-rotation confirmation. All consolidated in `OWNER_INPUT_REQUIRED.md`.
