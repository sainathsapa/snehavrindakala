# QA Consolidated Findings — SnehaVrinda Kala FINAL GO

> Agent: **A111 — QA evidence consolidation** · Branch: `remediation/final-go` ·
> Date: 2026-11-23 · Owned file (created here, only file edited): this document.

## 0. Honesty statement (read first)

- **No live pass is claimed anywhere in this document.** Every "PROVEN BY TEST"
  entry below is a *code-level / static / pure-model* result reported by the
  individual QA agent. I did **not** independently re-run any suite and I ran
  **no pnpm command**. Per the shared contract, only AGENT 00 (or A10 for the QA
  gate) may mark a gate PASS after an independent re-run recorded in
  `FINAL_GO_TEST_EVIDENCE.md` — that file still shows "No new evidence yet".
- Reported pass counts are quoted **from the agents' own reports**, not measured
  by me. Where a QA test file exists but no report with a count was found on
  disk, the file is cited as evidence-of-record with **no pass count asserted**.
- All Playwright E2E specs are **AUTHORED — NOT RUN (skipped)**; a skipped test
  is an honest `NOT VERIFIED`, never a pass.
- Owner-gated inputs (stack, credentials, partner identities, policy decisions,
  SES sender, backup destination, legal sign-off) are recorded as
  **BLOCKED BY OWNER INPUT**, never as passes.

## 1. Source evidence inventory (individual QA artifacts on disk)

| QA artifact (agent) | Type | Result as reported by that agent |
|---|---|---|
| `QA_SECURITY_REPORT.md` (A71) | report + `qa-cross-partner.test.ts`, `qa-auth-attacks.test.ts` | "2 files passed — 38 passed, 1 skipped, 0 failed" (fake executor; no DB/network) |
| `QA_NOTIFICATIONS_REPORT.md` (A92) | report + `qa-notification-delivery.test.ts` | "15 passed / 15" (pure/static only) |
| `QA_BACKUP_RESTORE_REPORT.md` (A90) | report + `qa-migration-recovery.test.ts` | "12 passed / 12" (static only) |
| `QA_E2E_PLAN.md` (A70) | plan + 3 Playwright specs | **AUTHORED — NOT RUN**; A/B in `partner-marketplace.spec.ts`, C/G in `multi-partner-isolation.spec.ts`, E/F/H in `payment-sandbox.spec.ts` |
| `qa-concurrent-inventory.test.ts` (A74) | test file, Scenario D | pure model + static schema assertions; no count published in a report found on disk |
| `qa-permissions.test.ts` (A91) | test file, Scenario G | matrix-derived role assertions; no count published in a report found on disk |
| `qa-payment-failures.test.ts` (A98) | test file, Scenario H | H1–H4 money-safety; no count published in a report found on disk |
| `qa-webhook-wiring.test.ts` (A93) | test file, wiring audit | static "would fail if guard removed" assertions; no count published in a report found on disk |
| `qa-settlement-dual-control.test.ts` (A104) | test file, Scenario F | settlement state-machine/ledger integrity; no count published in a report found on disk |
| `qa-shipping-failures.test.ts` (A99) | test file, Scenario I | pure shipping simulator; no count published in a report found on disk |
| `qa-seo-legal.test.ts` (A97) | test file, Scenarios I/J | static SEO/legal regression; no count published in a report found on disk |
| `qa-health-monitoring.test.ts` (A105) | test file, Scenario J | static monitoring/observability; currently untracked in the tree |

## 2. Scenario matrix A–J

### A — Single-partner purchase → allocation → accept → fulfil → tracking → delivered → earnings
- **PROVEN BY TEST:** `qa-shipping-failures.test.ts` (shipping decision layer:
  token gate, dedupe, status mapping, failure/retry, one notification per change);
  `qa-settlement-dual-control.test.ts` (earning entry built and reversed);
  `qa-concurrent-inventory.test.ts` (reserve/consume never double-sells). These
  cover isolated pieces, not the assembled flow.
- **BLOCKED BY OWNER INPUT:** full-flow live run needs the sandbox stack
  (`QA-STACK`), partner A identity (`OWNER-PARTNER`), product→partner mapping
  (`OWNER-CONTENT`), fixture service, carrier webhook token (`OWNER-SHIP`).
- **NOT VERIFIED:** the E2E spec `e2e/partner-marketplace.spec.ts --grep "Scenario A"`
  is **AUTHORED — NOT RUN (skipped)**; no real allocation/status-transition/
  earnings row has been observed end to end.

### B — Multi-partner cart → one parent order → independent fulfilment groups
- **PROVEN BY TEST:** `qa-cross-partner.test.ts` (fulfilment groups and members
  are tenant-scoped in both directions); `qa-permissions.test.ts` (partner
  permission boundaries). No test proves one parent order with two partners.
- **BLOCKED BY OWNER INPUT:** `E2E_PARTNER_B_*`, `E2E_PRODUCT_B_ID`, fixture
  service, running stack (`QA-STACK`, `OWNER-PARTNER`, `OWNER-CONTENT`).
- **NOT VERIFIED:** `partner-marketplace.spec.ts --grep "Scenario B"` **AUTHORED —
  NOT RUN**; mixed-cart allocation and customer's unified view unverified live.

### C — Tenant isolation (cross-partner product/order/inventory/earnings/shipment probes)
- **PROVEN BY TEST:** `qa-cross-partner.test.ts` (19 tests: every tenant-owned
  resource probed with both tenants; forged ids/SQL-looking ids bound as data;
  `{partner}` guard never binds a client value); `qa-auth-attacks.test.ts`
  (20 tests, 1 intentionally skipped: 10 auth attacks all return `null`,
  privilege-confusion between partner/admin tokens denied); `qa-permissions.test.ts`
  (platform/partner permission-domain isolation). This is the strongest
  code-level QA area, but uses a fake executor over simulated rows.
- **BLOCKED BY OWNER INPUT:** real partner A/B identities and role accounts,
  fixture service, running stack (`OWNER-PARTNER`, `QA-STACK`).
- **NOT VERIFIED:** `multi-partner-isolation.spec.ts --grep "Scenario C"`
  **AUTHORED — NOT RUN**; no live HTTP 401/403/404 probe against a real Postgres
  instance; real DB-schema correctness is outside these QA suites.

### D — Inventory integrity / atomic reservation, no oversell
- **PROVEN BY TEST:** `qa-concurrent-inventory.test.ts` (pure decision layer:
  one winner for one unit, typed `OUT_OF_STOCK`, N winners for N units, TTL
  expiry sweep, idempotent re-reserve, non-negative clamping; static assertions
  that `FOR UPDATE`, CHECK constraints and the non-unique btree index exist).
  The DB is a serialising **fake** that models the lock — not real Postgres.
- **BLOCKED BY OWNER INPUT:** running Postgres + Medusa (`QA-STACK`) and real
  authoritative stock counts, especially one-of-a-kind works (`OWNER-CONTENT`).
- **NOT VERIFIED:** real MVCC lock contention, deadlock/lock-wait behaviour,
  performance under true simultaneous connections. **No A70 E2E spec exists**
  for D. The `UNIQUE(variant_id)` guard is modeled in **one clearly-labelled
  non-shipped test** only; the shipped schema has no UNIQUE active-reservation
  constraint (see GAP-06).

### E — Refund request → dual approval → sandbox provider refund → ledger reversal → notification
- **PROVEN BY TEST:** `qa-settlement-dual-control.test.ts` §5 (immutable earning
  plus negative `refund_reversal` row nets payable/commission to zero);
  `qa-notification-delivery.test.ts` (deduped outbox mechanics);
  `qa-webhook-wiring.test.ts` (signature/single-use guards still wired). No QA
  test proves refund *execution* or requester≠approver at the refund API.
- **BLOCKED BY OWNER INPUT:** Razorpay sandbox creds/webhook secret, two distinct
  admin accounts, partner A identity, fixture service, running stack
  (`OWNER-PAY`, `OWNER-PARTNER`, `QA-STACK`).
- **NOT VERIFIED:** `payment-sandbox.spec.ts --grep "Scenario E"` **AUTHORED —
  NOT RUN**; no live provider refund confirmation, no observed refund email.

### F — Partner finance: commission policy → earnings ledger → settlement batch
- **PROVEN BY TEST:** `qa-settlement-dual-control.test.ts` (no batch without an
  active approved policy; forced state machine `calculated→approved→
  payment_initiated→payment_completed`; approval needs an identity; confirmation
  needs a real provider object; reversal nets the ledger; statements strictly
  tenant-scoped).
- **BLOCKED BY OWNER INPUT:** owner-approved commission/payout policy, partner
  finance identity, payout provider + who may confirm, running stack
  (`OWNER-PARTNER`, `QA-STACK`); TDS/withholding decision (`OWNER-TAX`).
- **NOT VERIFIED:** `payment-sandbox.spec.ts --grep "Scenario F"` **AUTHORED —
  NOT RUN**; no real payout call exists (GAP-09) and no provider-confirmed
  payout was observed. The module gate proves an approver *identity* only —
  dual control by distinct administrators is an operational control not proven
  by these adapter-free tests.

### G — Role checks (owner / operations / finance / viewer + anonymous)
- **PROVEN BY TEST:** `qa-permissions.test.ts` (exact permission sets for all
  five partner roles and platform roles, fail-closed on unknown roles, disjoint
  domains, owner has no `partners:*` capability); `qa-auth-attacks.test.ts` §5
  (token cannot cross between partner and admin sessions; platform `partner`
  role granted only read permissions).
- **BLOCKED BY OWNER INPUT:** seeded role accounts and running stack
  (`OWNER-PARTNER`, `QA-STACK`).
- **NOT VERIFIED:** `multi-partner-isolation.spec.ts --grep "Scenario G"`
  **AUTHORED — NOT RUN**; no live endpoint exercised per role. GAP-01 (role-name
  collision) remains an unmet hardening requirement with an intentionally
  skipped test in `qa-auth-attacks.test.ts`.

### H — Payment failure / delayed / duplicate webhook; no duplicate order or charge
- **PROVEN BY TEST:** `qa-payment-failures.test.ts` (H1 browser "paid" claim
  ignored when provider says failed; H2 duplicate event id → exactly one effect;
  H3 delayed capture found by `providerVerify` with retry/backoff and
  `webhook_missed`; H4 failed payment never consumes stock and replay mints no
  second order id); `qa-webhook-wiring.test.ts` (HMAC + timing-safe compare,
  single-use claim before `completeOrder`, constant-time Shiprocket token,
  `UNIQUE(provider, provider_event_id)` dedupe, CI audit not swallowed by
  `|| true`). All pure/static with fake provider and fake DB.
- **BLOCKED BY OWNER INPUT:** `RAZORPAY_WEBHOOK_SECRET`, `CRON_SECRET`, sandbox
  adapter, running stack (`OWNER-PAY`, `QA-STACK`).
- **NOT VERIFIED:** `payment-sandbox.spec.ts --grep "Scenario H"` **AUTHORED —
  NOT RUN**; no real webhook signature verification or scheduled reconciliation
  against a live provider.

### I — Notifications & customer communications
- **PROVEN BY TEST:** `qa-notification-delivery.test.ts` (status vocabulary,
  missing config → `skipped` never `sent`, `event_key` dedupe via UNIQUE index +
  `ON CONFLICT DO NOTHING`, SES MessageId persisted only on success, retry gap
  pinned); `qa-shipping-failures.test.ts` (exactly one simulated notification per
  real status change); `qa-seo-legal.test.ts` (cookie policy, consent gating,
  data-export/deletion API still present).
- **BLOCKED BY OWNER INPUT:** a verified SES sender, SES credentials, an
  owner-approved controlled test recipient (`OWNER-EMAIL`) — all currently
  **UNCONFIGURED**; the current correct behaviour is `skipped`, so **no customer
  has received anything**.
- **NOT VERIFIED:** no email was sent or observed in an inbox; **no A70 E2E spec
  exists** for I; no SES delivery/bounce webhook exists, so `sent` is not proof
  of delivery (GAP-07, GAP-08).

### J — Production / migration / recovery / SEO / analytics / legal readiness
- **PROVEN BY TEST:** `qa-migration-recovery.test.ts` (backup/drill scripts
  exist and are wired safely; migrations 002/003/004 additive and ordered);
  `qa-seo-legal.test.ts` (canonicals, absolute hreflang, consent denied by
  default, no fabricated grievance identity); `qa-health-monitoring.test.ts`
  (compose healthchecks, TLS edge, bounded logs, startup-validation presence,
  config-status routes, no hardcoded secrets, audit logging) — all static.
- **BLOCKED BY OWNER INPUT:** live restore needs a running stack + backup
  destination/credentials (`OWNER-PROD`); production gate needs domain/DNS/TLS,
  prod secrets, GA4 ID, rotated leaked credentials, legal sign-off and
  grievance-officer identity (`OWNER-PROD`, `OWNER-SECRETS`, `OWNER-TAX`, `LEGAL`).
- **NOT VERIFIED:** fresh-install migration apply on a real DB and a real
  backup/restore drill (documented owner commands exist in
  `QA_BACKUP_RESTORE_REPORT.md` §B/§C but were not run); production startup
  validation green; actual legal sign-off. **No A70 E2E spec exists** for J.
  `assertProductionConfig` is not yet called at runtime (GAP-12).

## 3. Consolidated real gaps (with responsible area and severity)

Severity labelled `from source` is quoted from the originating QA report;
other labels are this consolidation's QA assessment.

| ID | Gap | Evidence / source | Responsible area | Severity | Status |
|---|---|---|---|---|---|
| GAP-01 | Partner/platform role-name **namespace collision**: 4 of 5 partner role strings equal platform roles; both permission helpers take plain `string`, so a cross-system role silently evaluates against the *other* matrix instead of failing closed. Green "documents GAP-01" test + an intentionally skipped fail-closed test. | `QA_SECURITY_REPORT.md` §6; `qa-auth-attacks.test.ts` | Lead + owner of `lib/rbac.ts` / `lib/partner/types.ts` | **MEDIUM (latent)** — from source | Open; not currently exploitable (no call site feeds a partner role to the platform matrix) |
| GAP-02 | `{partner}` tenant guard is a **substring check** (`sql.includes`), not a predicate check; a token in a comment could satisfy it while returning all rows. All current helpers place it in a real predicate. | `QA_SECURITY_REPORT.md` §6 | `lib/partner/repository.ts` owner / Lead | LOW (latent) — from source | Open |
| GAP-03 | Placeholder numbering assumes `{partner}` is the last token; a future helper could bind the tenant to the wrong parameter. | `QA_SECURITY_REPORT.md` §6 | `lib/partner/repository.ts` owner / Lead | LOW (latent) — from source | Open |
| GAP-04 | Context email comes from the signed cookie (`payload.email`), not the DB re-read; stale after a membership email change. | `QA_SECURITY_REPORT.md` §6 | `lib/partner/context.ts` owner / Lead | LOW (informational) — from source | Open |
| GAP-05 | **Notification retry has no attempts counter and no backoff.** It is an operator-driven re-send under a fresh `event_key`; no `attempts`/`next_attempt_at` on notification rows. The only retry loop with backoff is payment reconciliation (different domain). Pinned by a dedicated test. | `QA_NOTIFICATIONS_REPORT.md` §Findings 1; `qa-notification-delivery.test.ts` §4 | Notifications / backend outbox owner + Lead | **MEDIUM** | Open by design; do not read as a pass |
| GAP-06 | **No UNIQUE constraint on active reservations** in `schema.sql` — only a non-unique btree index. Real safety is `FOR UPDATE` + `canReserve()` + atomic increment. A literal `UNIQUE(variant_id)` would be wrong for multi-unit variants; the hypothetical guard is modeled in one non-shipped test only. | `qa-concurrent-inventory.test.ts` header + static assertions (lines 14–16, 402–421, 541–550) | Inventory / DB schema owner (`db/schema.sql`, A00 migration owner) | **MEDIUM** (latent concurrency hardening) | Open; real concurrency not verified |
| GAP-07 | **No SES event webhook / configuration-set destination.** `delivered` and `bounced` are declared in the vocabulary but never written; a `sent` row is not proof of delivery. | `QA_NOTIFICATIONS_REPORT.md` §Findings 2; `qa-notification-delivery.test.ts` §6 | Notifications backend + owner SES configuration | MEDIUM | Open; requires SES webhook + owner config |
| GAP-08 | Outbox is deliberately read-only (no resend button); recovery is a manual operator action against a working transport. | `QA_NOTIFICATIONS_REPORT.md` §Findings 3 | Notifications / admin UI owner | LOW (informational) | By design |
| GAP-09 | **No live payout call.** The settlement module records transfers and confirmations but calls no payout API; `confirm` is honest only when an operator has externally verified the transfer. | `SETTLEMENT_POLICY.md` §"Why 'record created' is not 'paid'"; `PARTNER_BUSINESS_RULES.md` §3 #12 | Finance / settlement owner (A04) + owner payout provider & credentials | **HIGH** (gate blocker) | Open, owner-gated |
| GAP-10 | **TDS / withholding has no schema field** — none in `commission_policy`, `partner_earnings_ledger` or `settlement_batch`; commission maths has no TDS deduction. | `PARTNER_BUSINESS_RULES.md` §3 #14 and §4 #6; `OWNER_INPUT_REQUIRED.md` finance section | Finance (A04/A86) + Owner + CA | **MEDIUM–HIGH** (compliance / owner decision) | Open, owner-gated |
| GAP-11 | **No per-partner stock column.** `variant_stock` and `stock_reservation` have no `partner_id`; stock is platform-wide per variant. If the owner decides stock is per partner, a schema/behaviour change is required. | `INVENTORY_OWNERSHIP_POLICY.md` §1 "Gap / PENDING DECISION" | Owner decision + inventory/partner area (A86, A00 for schema) | **MEDIUM–HIGH** (business-model decision) | Open, owner-gated |
| GAP-12 | **Wiring gaps:** `refund_effect` and `payable_when` are validated and stored but not consulted by refund-execution or settlement-selection code. Also no SQL `CHECK` that settlement approver ≠ initiator (approval is an operational control). | `PARTNER_BUSINESS_RULES.md` §2 note; `SETTLEMENT_POLICY.md` lines 80–85 | Finance / refunds owner (A04, A05) | MEDIUM (approver check: LOW/operational) | Open; pending implementation decision |
| GAP-13 | **All A–J E2E scenarios are NOT RUN**; specs are gated by `E2E_SANDBOX` + credentials and are skipped. Exercises I and J have **no A70 spec at all** (proposed mapping only). | `QA_E2E_PLAN.md` §0–2; `FINAL_GO_BLOCKERS.md` (`QA-STACK`) | Owner (stack + creds) + A10 / Lead | **HIGH** (release-gate blocker) | Open |
| GAP-14 | **Live restore / fresh-install migration apply NOT VERIFIED** — no running stack, no backup destination/credentials; only static checks pass. | `QA_BACKUP_RESTORE_REPORT.md` Status + "BLOCKED BY OWNER INPUT" | Owner + Lead | **HIGH** (Database/E2E gate must not be green) | Open, owner-gated |
| GAP-15 | **Legal sign-off not approved** — grievance-officer identity and privacy/refund/terms policy sign-off still open; no fabricated identity inserted. | `qa-seo-legal.test.ts` §"legal sign-off is NOT approved"; `OWNER_INPUT_REQUIRED.md` | Owner + CA / legal | **HIGH** (Legal gate) | Open, owner-gated |
| GAP-16 | **`assertProductionConfig` not yet called at runtime** — instrumentation wiring is an outstanding Lead action; production error alerting (`SENTRY_DSN`/`MONITORING_CONFIG`), domain/DNS/TLS and backup destination are unconfigured. | `qa-health-monitoring.test.ts` §3 + header; `CI_SECURITY.md` §6 | Lead (instrumentation) + Owner (prod inputs) | MEDIUM (wiring) / HIGH (prod inputs) | Open |

## 4. Gate stance

- **PROVEN BY TEST (code-level only):** tenant isolation and auth attacks (C/G),
  permission matrices (G), payment-failure/webhook money safety (H), settlement
  state machine and ledger reversals (F), shipping decision layer (A/I),
  notification delivery *mechanisms* (I), inventory model (D), and static SEO /
  migration / monitoring wiring (I/J).
- **BLOCKED BY OWNER INPUT:** real delivery (I), live payout (F), live restore
  (J), production config/legal (J), and every live E2E scenario (A–J).
- **NOT VERIFIED:** any live charge, refund, payout, shipment callback, customer
  email, real-DB migration/restore, or end-to-end business outcome.
- No gate is marked PASS in this document. The gate tables in
  `FINAL_GO_EXECUTION_PLAN.md` §4 and `FINAL_GO_PROGRESS.md` remain the source
  of truth until AGENT 00 records independent re-run evidence.
