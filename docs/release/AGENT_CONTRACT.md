# FINAL GO — Shared agent contract (read this first)

You are one specialist in a 50+ agent team on branch `remediation/final-go`.
The critical-path partner contracts are DONE and committed. Build on them; do
not reimplement them. Work only inside the files you were assigned.

## Hard rules
1. Edit ONLY the files in your assignment. Do NOT touch:
   - `apps/storefront/lib/partner/**`, `db/migrations/**`, `db/schema.sql`
   - `docker-compose.yml`, `package.json`, `turbo.json`, root configs
   - `docs/release/**` (Lead owns all docs)
   - any file owned by another agent
2. Create your own test file(s) and assert real business outcomes + failure cases.
3. No fabricated credentials, partner identities, commission rates, GSTIN, stock,
   payout terms. Owner-gated config must be validated and reported as UNCONFIGURED.
4. No live payments/refunds/emails/deploys. Use test adapters/fixtures.
5. Never put a `partner_id` (or any tenant id) from a request body/query/header
   into a query. Always derive it from the server-side context below.
6. Do NOT run `pnpm test`/`pnpm typecheck` (the Lead integrates and verifies).
   You may run only `cd apps/storefront && npx vitest run tests/<your-file>.test.ts`.
7. Return a concise report: files created, what it does, test result, assumptions.

## Partner contract API (import from `@/lib/partner` or specific modules)

- `lib/partner/types.ts`: `Partner`, `PartnerMembership`, `PartnerContext`,
  `PartnerRole` (`owner|manager|operations|finance|viewer`),
  `PartnerSessionPayload`, `isPartnerRole`.
- `lib/partner/session.ts`: `PARTNER_SESSION_COOKIE`, `PARTNER_SESSION_MAX_AGE`,
  `signPartnerSession({partnerId,membershipId,role,tokenVersion,email})`,
  `verifyPartnerToken(token)`.
- `lib/partner/password.ts`: `hashPassword(pw)`, `verifyPassword(pw, hash)`.
- `lib/partner/rbac.ts`: `PartnerPermission`, `PARTNER_ROLE_PERMISSIONS`,
  `partnerHasPermission(role, perm)`, `partnerCan(role, ...perms)`.
- `lib/partner/context.ts`:
  - `resolvePartnerContext(token, executor?)` -> `PartnerContext | null` (pure, testable)
  - `requirePartnerContext()` -> `PartnerContext | null` (reads cookie, async)
  - `requirePartnerPermission(perm)` -> `PartnerContext | null`
- `lib/partner/repository.ts`:
  - `QueryExecutor = (sql, params?) => Promise<any[]>`; default uses `query` from `@/lib/db`.
  - `buildScopedStatement(ctx, sqlWith{partner}Token, params)` (throws if no `{partner}`)
  - `tenantQuery(ctx, sqlWith{partner}Token, params, executor?)`
  - Platform lookups: `findPartnerById(id, ex?)`, `findMembershipByEmail(email, ex?)`, `findMembershipById(id, ex?)`.
  - Tenant reads: `getPartnerProfile`, `listPartnerProducts`, `getPartnerProduct(ctx,id)`,
    `listPartnerFulfilmentGroups`, `getPartnerFulfilmentGroup(ctx,id)`, `getPartnerEarnings`,
    `listPartnerMembers`, `getFulfilmentCustomer(ctx,groupId)` — all `(ctx, executor?)`.

## Conventions
- Next.js 15 App Router, `apps/storefront`, `@/*` -> `apps/storefront/*`.
- Route handlers: `export async function GET/POST/...` returning `NextResponse.json`.
- Auth in API routes: `const ctx = await requirePartnerPermission("..."); if (!ctx) return 401/403`.
- UI pages: server components; call `requirePartnerContext()`; if null redirect to `/partner/login`.
- Existing admin session helpers: `@/app/admin/actions` (`requirePermission`), `@/lib/admin`.
- DB access: `@/lib/db` exports `query`, `queryResult`, `transaction`, `getPool`.
- Styling: Tailwind, existing class conventions (look at neighbouring pages).

## Migration ownership
The Lead owns all SQL DDL. Available tables (migrations 002–004):
`partner`, `partner_membership`, `partner_onboarding_application`,
`partner_product`, `fulfilment_group`, `partner_audit_log`, `commission_policy`,
`partner_earnings_ledger`, `settlement_batch`, `settlement_batch_item`,
`payment_event`, `payment_reconciliation_issue`, `refund_execution`.
Read `apps/storefront/db/migrations/*.sql` for exact columns. If you need a new
column/table, DO NOT edit migrations — note it in your report and use the
closest existing structure or an in-code typed structure.

## Gate honesty
A thing is not done because code exists; it needs tests. If something is blocked
on owner input, say so in your report; the Lead records it as BLOCKED BY OWNER INPUT.
