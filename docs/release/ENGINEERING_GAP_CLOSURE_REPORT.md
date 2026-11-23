# Engineering Gap Closure — Report

> Branch: `remediation/engineering-gap-closure` (cut from `remediation/final-go`
> @ `4a597ca`). Lead / sole migration coordinator: **AGENT 00**.
> Companion documents: `FINAL_GO_RELEASE_REPORT.md` (gate classification),
> `OWNER_INPUT_REQUIRED.md` (owner gates), `QA_GAP_CLOSURE_REPORT.md`
> (independent QA), `FINAL_GO_TEST_EVIDENCE.md` (test evidence).

## Executive summary

The engineering findings from the final-go mission that did **not** require
owner input have been implemented and verified with tests. Ten specialists
(A01–A10) worked under a strict file-ownership contract; the Lead integrated all
work, owned all schema changes, and re-ran the full suite.

**Engineering closure: achieved (code + tests).**
**Production readiness: NO-GO — unchanged.** Live stack, credentials, partner /
finance / legal inputs, SES/SNS provisioning, backup verification and the live
E2E scenarios A–J remain owner-gated and were not executed. **No agent marked any
gate PASS.** Only AGENT 00 may classify a gate as PASS, and the Lead has not done
so.

## Migration integration (Lead-owned)

Reserved migrations, all additive / idempotent (`IF NOT EXISTS` /
`ON CONFLICT DO NOTHING`), with forward-recovery notes and no business-data
deletion:

| Migration | Author | Purpose | Notes |
|---|---|---|---|
| `005_notification_retry.sql` | A03 | attempts / bounded backoff / terminal state / `notification_event` + `notification_suppression` | Made **order-independent** at integration: creates a backend-compatible `app_notification` base table if missing (no-op in the ordered deploy), removing the fresh-DB 42P01 failure in code |
| `006_role_namespacing.sql` | A07 | widen role CHECK to canonical + legacy values | Only a CHECK replacement inside a `DO` block; no row data altered |
| `007_refund_inventory.sql` | A04 | restoration state, `inventory_restoration_action`, `inventory_movement` | `UNIQUE(action_key)` / `UNIQUE(movement_key)` |
| `008_finance_constraints.sql` | A05 | `refund_effect` / `payable_when` CHECKs, approver ≠ initiator | Counts offending historical rows and aborts before adding constraints; no data rewritten |
| `009_reservation_hardening.sql` | A06 | partial unique index `(variant_id, cart_id) WHERE status='active'`, `NOT VALID` oversell CHECK | Manual-disable DDL appears only in comments |

Test lists that hardcoded 002–004 were updated to 002–009
(`tests/migration-integrity.test.ts`, `tests/qa-migration-recovery.test.ts`), and
the destructive-DDL checks were refined to permit additive `ALTER TABLE ... ADD
COLUMN` and the documented CHECK widening in 006 while still rejecting any
`DELETE` / `TRUNCATE` / `DROP TABLE` / `DROP COLUMN`.

## Gap-by-gap closure

| ID | Gap | Closure evidence | Owner-gated remainder |
|---|---|---|---|
| A01 | Razorpay signed webhook | `app/api/webhooks/razorpay/**`, `lib/payments/webhook.ts`, `tests/qa-webhook-endpoint.test.ts` (33): raw-body HMAC-SHA256 constant-time verify, `payment_event` UNIQUE claim dedupe, provider-truth verification before all state changes, forward-only transitions, no order/charge creation, no secret logging | Sandbox credentials + real webhook registration; live scenarios A/E/F/H |
| A02 | Audit coverage | `lib/partner-audit/audit.ts` + route writes; `tests/qa-audit-coverage.test.ts` (25). Lead wired the two remaining writes: `refund.requested` (`app/api/admin/orders/[id]/refund/route.ts`) and `partner_application.submitted` (`app/api/store/partner-applications/route.ts`), both redacted and correlation-tagged | None for the code; audit writes in the route layer are not a same-transaction outbox (documented limitation) |
| A03 | Notification retry + SES events | `lib/notifications.ts`, `app/api/webhooks/ses/**`, backend notification module, migration 005, `tests/qa-notification-retry.test.ts` (19). Lead added `CRON_SECRET`-guarded worker `app/api/cron/notification-retries/**` and read-only admin view `app/api/admin/notification-retries/**` plus a dedicated `notification-retry-cron` compose service; env vars added to `docker-compose.yml`. `tests/qa-notification-worker-routes.test.ts` (10) | SES sender/credentials, SNS event destination + subscription, `SES_SNS_TOPIC_ARN`, `CRON_SECRET`, controlled test recipient |
| A04 | Refund/inventory restoration | `lib/payments/refund-execution.ts`, `lib/inventory.ts`, `lib/returns/process.ts`, migration 007, `tests/qa-refund-inventory.test.ts` (18). Fail-safe: approval alone never restocks, unique artwork never restocked, missing owner evidence yields `pending`, `inventory_restored` set only after successful restoration, `UNIQUE(movement_key)` | Condition / `physicallyReceived` / `inspected` / `restockApproved` are not in the DB — automatic restock intentionally stays off |
| A05 | Finance policy wired | `lib/finance/**`, migration 008, `tests/qa-finance-policy.test.ts` (22). Lead added `lib/finance/payability-resolver.ts`, wired into `app/api/admin/settlements/route.ts` so `payable_when` is enforced on both the list and batch paths; `tests/qa-payability-resolver.test.ts` (6). All unknown rules/facts fail closed | Owner must **select** `refund_effect`, `payable_when` and `RETURN_WINDOW_DAYS`; `PARTNER_BUSINESS_RULES.md` §2 is still blank |
| A06 | Reservation hardening | migration 009, `tests/qa-reservation-hardening.test.ts` (18) — partial unique index + `NOT VALID` CHECK | None |
| A07 | Role namespacing (GAP-01 full fix) | `lib/rbac.ts`, `lib/partner/**`, `lib/admin-session.ts`, migration 006, `tests/qa-role-namespace.test.ts` (29). Canonical `partner_*` / `platform_*` values, legacy aliases accepted only at trusted boundaries, cross-namespace evaluation fails closed, `platformRoleOrNull()` / `getAdminIdentity()` boundary preserved | None |
| A08 | Remove lazy runtime DDL | 29 handlers cleaned; `db/schema.sql` gained idempotent upgrade `ALTER`s; `scripts/verify-schema.mjs` hard `fail()` gate restored; `tests/qa-no-runtime-ddl.test.ts` (7). Lead extended `EXPECTED_SCHEMA` to cover migration 005–009 tables and fixed the table-detection regex | None |
| A09 | Partner navigation | `app/partner/components/partner-nav.tsx`: `/partner/audit` (`profile:read`) and `/partner/submissions` (`products:read`); `tests/partner-nav.test.ts` (22). Lead fixed stale count assertions to be data-driven | None |
| A10 | Independent QA | 10 new `tests/qa-gap-closure*.test.ts` files (88 tests), `docs/release/QA_GAP_CLOSURE_REPORT.md`. Verdicts: A01/A02/A04/A05/A06/A07/A08/A09 + migrations VERIFIED; A03 initially PARTIAL on finding F1, upgraded to VERIFIED after the Lead fixed it. F2 (camelCase secret-key redaction) fixed and verified; F3/F4 informational only | Live proofs remain owner-gated; no gate marked PASS |

## Lead integration work (beyond agent deliveries)

- Integrated 005–009; fixed migration 005 to be order-independent.
- Wired notification retry worker + admin observability + compose scheduler and env.
- Wired `PayabilityResolver` into settlements from real order/shipment/return/refund state, failing closed on missing facts.
- Added the two missing audit writes (refund request creation, public application submission) and updated the affected tests honestly (the application POST now makes two DB writes: insert + audit).
- Fixed stale assertions from agent changes: nav counts (data-driven), migration lists (002–009), additive-DDL checks, role-type narrowing fallout in `partner-nav.test.ts` and `qa-permissions.test.ts`.
- Restored hard `verify-schema` DB-gate coverage for the new migration tables.
- Routed A10's findings F1/F2: scrubbed the backend dev/CI email preview (recipient,
  subject and body) and split camelCase before sensitive-key matching in
  `audit.ts`; added `tests/qa-pii-hardening.test.ts` (4 tests). F3/F4 were
  informational and left unchanged.

No existing assertion was weakened; where call counts or role types legitimately
changed, assertions were updated **and strengthened** with additional checks.

## Verification performed

| Check | Result |
|---|---|
| `pnpm typecheck` (monorepo) | **4 / 4 successful** |
| `pnpm --filter @snehavrinda-kala/backend test` | 7 files / **101 passed** |
| `cd apps/storefront && npx vitest run` | 127 files / **1669 passed + 4 skipped**, 0 failures |
| `cd apps/storefront && npx tsc --noEmit` | 0 errors |
| `docker compose config --quiet` | valid (Docker Desktop context) |
| `node apps/storefront/scripts/secret-scan.mjs` | OK — no potential secrets in 818 tracked files |
| `env -u DATABASE_URL node apps/storefront/scripts/verify-schema.mjs` | only the expected `DATABASE_URL is not set` failure; hard handler gate active |

Combined code-level total: **1770 passed + 4 skipped** (101 backend + 1669
storefront), up from the final-go 1468. This includes A10's 10 independent QA
files (88 tests) and the Lead's `qa-pii-hardening` regression (4 tests). Live E2E
A–J remain unrun and are not counted.

These are code-level, static and pure-function results. They are **not** live
end-to-end proof. `db:verify` was exercised without `DATABASE_URL` (the static
hard handler gate is active); the live-DB half of that gate was **not** re-run
against a database at the Lead's explicit instruction not to execute database or
container operations directly. Migrations are therefore verified by source
inspection and idempotency tests, not by a fresh/upgrade apply on this branch.
The independent QA verdict is in `QA_GAP_CLOSURE_REPORT.md`.

## Limitations and owner gates

1. **No live E2E:** scenarios A–J were authored previously but not run; there was
   no running stack or real credentials. A skipped test is not a pass.
2. **No live integrations:** Razorpay, SES/SNS, Shiprocket and payout/email
   delivery were never contacted; only test adapters were used.
3. **No fabricated business data:** no partner identities, rates, GSTIN, stock
   counts, legal sign-off or live money movement were invented.
4. **Fail-closed by design:** unconfigured policy/window/secret/role yields a
   refusal, not a permissive default.
5. **Audit writes are not a transactional outbox:** partner mutation audits are
   appended in the route layer after the business write and fail loudly; a true
   same-transaction/outbox design remains a future hardening item.
6. **Restock and policy activation remain owner decisions:** the mechanisms
   exist and are tested, but the owner-supplied evidence/config is absent.

## Gate classification and decision

| Domain | Status |
|---|---|
| Engineering closure (code + static/pure tests) | **Achieved** |
| Independent QA | See `QA_GAP_CLOSURE_REPORT.md` |
| Live E2E A–J | **NOT VERIFIED — BLOCKED BY OWNER INPUT** |
| Payment / email / shipping live integrations | **NOT VERIFIED — owner credentials required** |
| Finance policy activation / legal / tax | **BLOCKED BY OWNER INPUT** |
| Production infra, secrets, backup restore drill | **BLOCKED BY OWNER INPUT** |

**Production decision: NO-GO (unchanged).** No gate has been marked PASS. This
report closes engineering work only; it is not a production release approval.
