# QA E2E plan — FINAL GO, scenarios A–J

> Author: AGENT A70 (QA / E2E subagent)
> Branch: `remediation/final-go`
> Date: 2026-11-23
> Status: **specs authored — NOT RUN.** No scenario below is marked PASS.

## 0. Honesty statement

This plan and the three Playwright specs authored with it define **reproducible,
business-outcome assertions** for the FINAL GO scenarios. Every spec is gated by
`test.skip(!E2E_SANDBOX, ...)` plus per-variable credential checks. **A skipped
test is an honest `NOT VERIFIED`, never a pass.** No live charge, refund, payout,
shipment or customer email is triggered — the sandbox fixture service and test
adapters own all money-movement simulation.

Nothing here was executed: there is **no running stack** (Next + Medusa +
Postgres + sandbox payment/fixture adapters) and **no sandbox credentials** in
this environment. Per the shared contract, only AGENT 00 marks a gate PASS after
independently re-running the specs and recording evidence in
`FINAL_GO_TEST_EVIDENCE.md`. All ten scenarios are therefore **BLOCKED BY OWNER
INPUT** (blocker `QA-STACK` + `OWNER-PAY` + `OWNER-PARTNER` in
`FINAL_GO_BLOCKERS.md`).

The execution plan names "scenarios A–J" without expanding every letter, and the
historical release report details A–H. Scenarios **I** and **J** below are A70's
proposed mapping for the remaining two letters, pending Lead confirmation; they
are listed so the matrix is complete but explicitly marked as not authored here.

## 1. Specs authored by A70

| File | Scenarios | Gate |
|---|---|---|
| `apps/storefront/e2e/partner-marketplace.spec.ts` | A, B | `E2E_SANDBOX` + partner A/B + fixture + carrier-token env |
| `apps/storefront/e2e/multi-partner-isolation.spec.ts` | C, G | `E2E_SANDBOX` + partner A + four role accounts + fixture env |
| `apps/storefront/e2e/payment-sandbox.spec.ts` | E, F, H | `E2E_SANDBOX` + two admins + partner/finance + webhook/cron secrets + fixture env |

Existing, already-committed `apps/storefront/e2e/storefront.spec.ts` covers
public browse/chrome but is **not** a substitute for any of A–J.

## 2. Scenario matrix A–J

| ID | Scenario | Source | Required env / secrets (names only — never values) | How to run | Expected evidence | Status / gating |
|---|---|---|---|---|---|---|
| **A** | Single-partner purchase → allocation → accept → fulfil → tracking → delivered → earnings | `partner-marketplace.spec.ts` | `E2E_SANDBOX=1`, `E2E_FIXTURES_URL`, `E2E_FIXTURES_TOKEN`, `E2E_PARTNER_A_{EMAIL,PASSWORD,ID}`, `E2E_PRODUCT_A_ID`, `E2E_CARRIER_WEBHOOK_TOKEN` | `cd apps/storefront && E2E_SANDBOX=1 npx playwright test e2e/partner-marketplace.spec.ts --grep "Scenario A"` | One allocated group; status transitions `assigned→accepted→packing→ready_for_dispatch→dispatched→delivered`; carrier webhook `applied:true`; one `earning` ledger row for the order with payable/commission equal to fixture policy | **AUTHORED — NOT RUN (skipped). BLOCKED BY OWNER INPUT** (sandbox partner + fixture service + stack) |
| **B** | Multi-partner cart → one parent order → independent fulfilment groups → customer sees full order | `partner-marketplace.spec.ts` | As A plus `E2E_PARTNER_B_{EMAIL,PASSWORD,ID}`, `E2E_PRODUCT_B_ID` | `… npx playwright test e2e/partner-marketplace.spec.ts --grep "Scenario B"` | One parent `order_id`; two groups with distinct partners; A's dispatch leaves B `assigned`; customer view returns one order with both products | **AUTHORED — NOT RUN (skipped). BLOCKED BY OWNER INPUT** |
| **C** | Tenant isolation: partner A direct GET/PATCH/POST against partner B's products, orders, inventory, earnings, shipments, downloads | `multi-partner-isolation.spec.ts` | `E2E_SANDBOX=1`, `E2E_FIXTURES_URL`, `E2E_FIXTURES_TOKEN`, `E2E_PARTNER_A_{EMAIL,PASSWORD}` | `… npx playwright test e2e/multi-partner-isolation.spec.ts --grep "Scenario C"` | Every cross-tenant attempt returns 401/403/404; no B marker/id in any body; forged `partner_id` in body/query/header ignored (tenant from signed session); A's own session returns 200 | **AUTHORED — NOT RUN (skipped). BLOCKED BY OWNER INPUT** (partner identities + fixture service + stack) |
| **D** | Inventory integrity: atomic reservation, no oversell under concurrency | No A70 spec — code-level unit/integration tests only (see `tests/inventory*.test.ts`, `lib/inventory.ts`) | Running Postgres + Medusa; no A70-specific env | Out of A70 scope; run backend/storefront unit suites, then a live concurrency harness with seeded stock | Reservation is atomic; a one-of-one work cannot be consumed by two checkouts; no negative stock | **NOT AUTHORED BY A70 — NOT RUN. BLOCKED BY OWNER INPUT** (`QA-STACK`; real stock counts in `OWNER_INPUT_REQUIRED.md`) |
| **E** | Refund request → dual approval → sandbox provider refund → ledger reversal → notification | `payment-sandbox.spec.ts` | As E row below + `E2E_ADMIN_REQUESTER_{EMAIL,PASSWORD}`, `E2E_ADMIN_APPROVER_{EMAIL,PASSWORD}`, `E2E_PARTNER_A_{EMAIL,PASSWORD}` | `… npx playwright test e2e/payment-sandbox.spec.ts --grep "Scenario E"` | Requester self-approval 403; distinct approver 200; `refund_execution.status=provider_confirmed` with provider id and distinct requester/approver; `refund_reversal` row links original earning; notification recorded+deduped; replay is a no-op | **AUTHORED — NOT RUN (skipped). BLOCKED BY OWNER INPUT** (sandbox Razorpay creds + two admin accounts + fixture service) |
| **F** | Partner finance: approved commission policy → earnings ledger → settlement batch | `payment-sandbox.spec.ts` | `E2E_SANDBOX=1`, `E2E_FIXTURES_URL`, `E2E_FIXTURES_TOKEN`, `E2E_PARTNER_FINANCE_{EMAIL,PASSWORD}` | `… npx playwright test e2e/payment-sandbox.spec.ts --grep "Scenario F"` | One `earning` row equal to fixture-computed amounts (no invented rate); approved policy id present; settlement batch visible with `line_count≥1` and total matching ledger | **AUTHORED — NOT RUN (skipped). BLOCKED BY OWNER INPUT** (approved commission/payout policy + partner finance identity + stack) |
| **G** | Role checks: owner / operations / finance / viewer + anonymous | `multi-partner-isolation.spec.ts` | `E2E_SANDBOX=1`, `E2E_FIXTURES_URL`, `E2E_FIXTURES_TOKEN`, `E2E_PARTNER_{OWNER,OPERATIONS,FINANCE,VIEWER}_{EMAIL,PASSWORD}` | `… npx playwright test e2e/multi-partner-isolation.spec.ts --grep "Scenario G"` | Granted permissions return 200/201; denied ones return 401/403; anonymous always refused; matrix mirrors `lib/partner/rbac.ts` | **AUTHORED — NOT RUN (skipped). BLOCKED BY OWNER INPUT** (seeded role accounts + stack) |
| **H** | Payment failure / delayed / duplicate webhook handling; no duplicate order or charge | `payment-sandbox.spec.ts` | `E2E_SANDBOX=1`, `E2E_FIXTURES_URL`, `E2E_FIXTURES_TOKEN`, `RAZORPAY_WEBHOOK_SECRET`, `CRON_SECRET` | `… npx playwright test e2e/payment-sandbox.spec.ts --grep "Scenario H"` | Duplicate `provider_event_id` recorded once; failed payment → no order + reconciliation issue; missed webhook recovered by guarded reconciler (`providerMode=test`); checkout replay → 409 `payment_already_used`; one order and one charge throughout | **AUTHORED — NOT RUN (skipped). BLOCKED BY OWNER INPUT** (webhook secret + cron secret + sandbox adapter + stack) |
| **I** | Notifications & customer communications (order confirmation, refund, shipment) | **No A70 spec** (proposed mapping) | Verified SES sender, `AWS_REGION`, SES credentials, `FROM_EMAIL`, one controlled test recipient | Not runnable — no spec and no SES config | Outbox rows created with dedupe `event_key`; exactly one controlled delivery per event; no email to real customers | **NOT AUTHORED BY A70 — NOT RUN. BLOCKED BY OWNER INPUT** (`OWNER-EMAIL`) |
| **J** | Production / SEO / analytics / legal readiness | **No A70 spec** (proposed mapping) | Domain/DNS/TLS, prod secrets, GA4 analytics ID, legal sign-off, rotated leaked credentials | Not runnable — no spec and no production config | Startup validation green, sitemap/canonicals/hreflang correct, consent gating, legal pages signed off, no active leaked credential | **NOT AUTHORED BY A70 — NOT RUN. BLOCKED BY OWNER INPUT** (`OWNER-PROD`, `OWNER-SECRETS`, `OWNER-TAX`) |

## 3. Gate variables and where they come from

Every variable below is **owner-supplied** and listed in
`docs/release/OWNER_INPUT_REQUIRED.md`. The specs read them from the environment
and report only *names* when absent; no value is ever written to a spec, report
or chat.

| Env var | Purpose | Owner source |
|---|---|---|
| `E2E_SANDBOX` | Master gate. Must be exactly `1`. Refuse to run otherwise. | QA / Lead, only once the stack + creds exist |
| `E2E_FIXTURES_URL`, `E2E_FIXTURES_TOKEN` | Sandbox fixture service that seeds partners, orders, payments and marker data | Standing up the sandbox stack (blocker `QA-STACK`) |
| `E2E_PARTNER_A_*`, `E2E_PARTNER_B_*` | Seeded partner memberships for A/B | `OWNER-PARTNER` (real partner identities + agreements) |
| `E2E_PARTNER_{OWNER,OPERATIONS,FINANCE,VIEWER}_*` | Seeded role accounts for G | `OWNER-PARTNER` |
| `E2E_PRODUCT_A_ID`, `E2E_PRODUCT_B_ID` | Real product→partner mapping | `OWNER-CONTENT` |
| `E2E_CARRIER_WEBHOOK_TOKEN` | Shiprocket-style webhook token for the tracking callback | `OWNER-SHIP` |
| `E2E_ADMIN_{REQUESTER,APPROVER}_*` | Two distinct admin accounts to prove dual control | Production/admin credential setup |
| `RAZORPAY_WEBHOOK_SECRET`, `CRON_SECRET` | Sign webhook events / authorise reconciler | `OWNER-PAY` |
| `E2E_BASE_URL` (optional) | Point at a deployed sandbox instead of the auto-started server | QA |

## 4. How to run (only after all gate vars are configured)

```bash
# From the repo root — start the full sandbox stack (Next + Medusa + Postgres +
# fixture/payment test adapters) and export the variables in section 3 first.
cd apps/storefront

# All A70 specs (chromium + mobile projects from playwright.config.ts):
E2E_SANDBOX=1 npx playwright test \
  e2e/partner-marketplace.spec.ts \
  e2e/multi-partner-isolation.spec.ts \
  e2e/payment-sandbox.spec.ts

# One scenario at a time (examples):
E2E_SANDBOX=1 npx playwright test e2e/partner-marketplace.spec.ts --grep "Scenario A"
E2E_SANDBOX=1 npx playwright test e2e/payment-sandbox.spec.ts --grep "Scenario H"

# Against a deployed sandbox instead of the auto-started server:
E2E_BASE_URL=https://sandbox.example E2E_SANDBOX=1 npx playwright test e2e/
```

Do **not** run `pnpm test` / `pnpm typecheck` from a subagent; the Lead integrates
and re-runs. If a spec skips, inspect the reported *names* of unconfigured env
vars — that is the intended "UNCONFIGURED" signal, not a failure to be patched
around by inventing values.

## 5. Recording results (Lead / QA gate)

A scenario may be marked PASS only when all four hold: (a) the spec ran (no
skip), (b) every business-outcome assertion passed, (c) AGENT 00 independently
re-ran it, and (d) command, environment, fixture data and result are appended to
`FINAL_GO_TEST_EVIDENCE.md`. Until then this plan's Status column is the source
of truth: **AUTHORED — NOT RUN (skipped)** or **NOT AUTHORED BY A70 — NOT RUN**.
