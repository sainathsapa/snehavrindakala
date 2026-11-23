# FINAL GO — Blocker tracker

Only AGENT 00 closes a blocker, with evidence. Owner-gated items point to
`OWNER_INPUT_REQUIRED.md`. Historical blockers are carried forward, not deleted.

| ID | Blocker / failure | Raised by | Owner | Status | Evidence / resolution |
|---|---|---|---|---|---|
| OWNER-PAY | Razorpay sandbox + webhook + live credentials | Baseline | Owner | OPEN | Needed for PAY-E2E / REF-EXEC live proof |
| OWNER-EMAIL | Verified SES sender + credentials | Baseline | Owner | OPEN | Email outbox intentionally no-ops without it |
| OWNER-SHIP | Shiprocket creds + webhook token + pickup address | Baseline | Owner | OPEN | Live status sync cannot run |
| OWNER-PARTNER | Real partner identities, agreements, commission rates/basis, payout terms | Baseline | Owner + CA | OPEN | Settlements cannot be activated |
| OWNER-TAX | Seller legal identity, GSTIN, HSN, CA sign-off | Baseline | Owner + CA | OPEN | Statutory invoice values |
| OWNER-CONTENT | Real product media, dimensions, stock, product→partner mapping | Baseline | Owner | OPEN | Catalogue integrity |
| OWNER-PROD | Domain, DNS, TLS, production secrets, backup/monitoring | Baseline | Owner | OPEN | Production gate |
| OWNER-SECRETS | Revoke/rotate credentials leaked in `d8894ec` | Baseline | Owner | OPEN | New env var is not proof of rotation |
| QA-STACK | No running Medusa/Postgres/Shiprocket stack for live E2E | Baseline | A10 | OPEN | Scenarios A–J live runs blocked; sandbox fixtures used instead |

## New findings (this mission)

*(appended by A00 / A10 as failures are discovered; each links to the responsible agent).*
*Statuses are honest: an owner-gated item is never closed here. Only AGENT 00 closes a*
*blocker, and only with evidence.*

| ID | Finding | Agent | Status |
|---|---|---|---|
| GAP-01 | Partner/platform role-name collision (MEDIUM, latent). Mitigation added at the admin identity boundary via `platformRoleOrNull()` in `lib/rbac.ts` — partner-only/unknown roles can no longer become an admin identity. Full string-level namespacing of partner roles is DEFERRED/owner-gated (data migration touching 22 test files). Not currently exploitable. | A00 | MITIGATED AT BOUNDARY — full fix OPEN |
| VERIFY-SCHEMA | `verify-schema.mjs` HIGH_TRAFFIC_HANDLERS: 28 handlers still carry idempotent lazy `CREATE TABLE IF NOT EXISTS` (advisory-lock-guarded). The check was downgraded to WARNING; the hard DB gate (migrations 002–004 applied) remains. Removal of redundant DDL is a tracked follow-up. | A10 | OPEN (advisory) |
| E2E-AJ | E2E scenarios A–J are AUTHORED but NOT RUN (skipped). No running stack/credentials available. | A10 | OPEN — owner-gated (QA-STACK + OWNER-* creds) |
| A70 | E2E specs reference not-yet-implemented routes: `/api/webhooks/razorpay` and `/api/partner/downloads/:id` — documented, not shipped. | A70 | OPEN |
| A108 | Audit gaps: partner self-service mutations (team/products/orders/profile routes) define canonical audit actions but emit no audit write; refund request, partner-application review and platform-mode toggle have no audit call. | A108 | OPEN (audit completeness) |
| A110 | `executeRefund` has no eligibility input and never sets `inventory_restored=true`; the conservative default `false` is safe. | A110 | Documented / by-design-safe |
| A92 | Notification outbox has NO attempts counter/backoff (GAP-05); re-send is operator-driven. | A92 | OPEN by design |
| GAP-09..12 | GAP-09 no live payout call; GAP-10 TDS has no schema field; GAP-11 no per-partner stock column; GAP-12 `refund_effect` / `payable_when` stored but not consulted; no SQL `CHECK` that approver ≠ initiator. All owner-gated or open — see `QA_CONSOLIDATED_FINDINGS.md`. | QA (consolidated) | OPEN / owner-gated |

## Closed during this mission

*Wiring/completeness gaps fixed by the Lead during this mission (recorded for the*
*record; these are not owner-gated blocker closures).*

- Production startup gate `assertProductionConfig()` is now wired at bootstrap in
  `instrumentation.ts` — a Lead wiring gap, now closed.
- 3 integration test failures fixed: `api-auth` `requirePermission` recognition,
  two `deployment-env` variables, and a reachability E2E exclusion.

## Engineering findings resolved on `remediation/engineering-gap-closure`

The following findings from the table above were engineering gaps (no owner input
required) and are now **CLOSED AND VERIFIED** by code + tests. Owner-gated
blockers (OWNER-*, QA-STACK, E2E-AJ) are **unchanged and still OPEN**.

| ID | Previously | Now | Evidence |
|---|---|---|---|
| GAP-01 | MITIGATED AT BOUNDARY — full fix OPEN | **CLOSED** — canonical `partner_*`/`platform_*` namespacing with legacy transition aliases; no data rewritten | migration `006`, `tests/qa-role-namespace.test.ts` |
| VERIFY-SCHEMA | OPEN (advisory) | **CLOSED** — hard `fail()` gate restored, zero runtime DDL in handlers | `scripts/verify-schema.mjs`, `tests/qa-no-runtime-ddl.test.ts` |
| A70 | OPEN (webhook not shipped) | **CLOSED for webhook** — `/api/webhooks/razorpay` shipped; `/api/partner/downloads/:id` still not authored (owner-gated fixture) | `tests/qa-webhook-endpoint.test.ts` |
| A108 | OPEN (audit completeness) | **CLOSED** — all in-scope mutations audited, incl. Lead-wired refund-creation and application-submission writes | `tests/qa-audit-coverage.test.ts` |
| A110 | Documented / by-design-safe | **CLOSED at capability level** — fail-safe restoration executes after provider confirmation; automatic restock remains owner-gated (condition/inspection evidence not in DB), so `inventory_restored` correctly stays `false` | migration `007`, `tests/qa-refund-inventory.test.ts` |
| A92 | OPEN by design | **CLOSED at capability level** — bounded retry/backoff/dead-letter state machine + CRON_SECRET worker + admin stats; SES event destination and test recipient remain owner-gated | migration `005`, `tests/qa-notification-retry.test.ts`, worker routes |
| GAP-12 | OPEN / owner-gated | **CLOSED at capability level** — `refund_effect`/`payable_when` fail closed, DB CHECKs added, `PayabilityResolver` wired from real order state; owner must still **select** the policies and `RETURN_WINDOW_DAYS` | migration `008`, `tests/qa-finance-policy.test.ts`, `tests/qa-payability-resolver.test.ts` |

Owner-gated items that remain **OPEN** after closure: live Razorpay/SES/Shiprocket
credentials and sandbox fixtures, real partner identities/rates/GSTIN, legal/tax
sign-off, production infra/secrets/backup, the active finance-policy selection and
return window, SES event-destination provisioning, and restock inspection evidence.
See `OWNER_INPUT_REQUIRED.md`.
