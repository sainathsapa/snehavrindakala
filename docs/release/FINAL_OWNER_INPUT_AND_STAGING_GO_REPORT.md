# Final Owner-Input & Staging Release Decision

**Branch:** `release/owner-input-staging-qualification`
**Base:** `security/closure-final` @ `bd7bb55` (no history rewritten)
**Date:** 2026-11-26
**Decision maker:** AGENT 00 — Lead Orchestrator / CTO / Release Manager

---

## 1. Decision

# NO-GO

**Staging qualification is substantially complete. Production readiness is not.**
Two independent reasons, either of which is sufficient:

1. **Credential exposure gate: FAIL.** Confirmed exposed credentials remain valid.
   Rotation is an owner action and **none has been performed**.
2. **Owner business data absent.** No partner identity, agreement, commission
   rate, stock quantity, product owner, shipping measurement, DNS record or alert
   destination exists. The platform is correctly refusing to operate around those
   gaps.

A green test suite does not change either statement. This mission deliberately did
not convert "no evidence of a problem" into "PASS".

## 2. Release gate table

| Gate | Status | Evidence | Blocker |
| --- | --- | --- | --- |
| Credential exposure | **FAIL** | 2 critical-class values were in images; 6 rotations outstanding (`CREDENTIAL_EXPOSURE_RECONCILIATION.md`) | owner (rotation) |
| Razorpay credential | **BLOCKED BY OWNER INPUT** | no sandbox keys; code paths unit-tested only | owner |
| JWT / session secrets | **BLOCKED BY OWNER INPUT** | rotation needs a coordinated session-invalidation window | owner + release eng |
| Admin credential | **BLOCKED BY OWNER INPUT** | no new credential; old not proven rejected | owner |
| Partner agreements | **BLOCKED BY OWNER INPUT** | 0 partners, 0 agreements; activation gate tested | owner + legal |
| Partner isolation | **PASS** (code/API level) | 38 negative tests: two synthetic tenants cannot cross-read products, orders, earnings, members | browser E2E skipped |
| Commission settings | **BLOCKED BY OWNER INPUT** | commission engine + policy model verified; no rate configured | owner + accountant |
| Shiprocket | **BLOCKED BY OWNER INPUT** | hardcoded physical defaults **removed** and gated; no provider credentials, 19/19 products unmeasured | owner |
| Product catalogue | **BLOCKED BY OWNER INPUT** | 15 of 19 products use generated stand-in media | owner |
| Inventory | **BLOCKED BY OWNER INPUT** | 0 of 20 variants tracked; no quantities supplied | owner |
| Product-partner mapping | **BLOCKED BY OWNER INPUT** | 0 of 19 products owned; single-owner constraint added | owner |
| DNS / TLS | **BLOCKED BY OWNER INPUT** | checker built and proven; production hostname unknown | owner |
| Monitoring & alerting | **BLOCKED BY OWNER INPUT** | health signals exist; no destination/recipient, no test alert received | owner |
| Backups | **PARTIAL** | dump → restore → schema verification **executed**; off-site destination unset | owner |
| Rollback | **PARTIAL** | staging rollback rehearsed; production not executed | release eng + owner auth |
| E2E (staging) | **PARTIAL** | 71 passed / 0 failed / **35 skipped** | owner (credentials/fixtures) |
| **Excluded inputs (SES, GSTIN, HSN/SAC, refund policy)** | **OUT OF SCOPE / SEPARATE BLOCKER** | untouched by instruction | owner |

## 3. What this mission actually changed

### 3.1 — Two commercial defects closed

**a) Partners could become commercially active with no agreement.**
`partner.account_status = 'active'` unlocks the portal, listing and settlement.
It is now gated (`lib/admin-partners/platform.ts` → `assertCommerciallyActivatable`)
on a signed, in-force agreement **and** an approved commission/payout
configuration. Refusals carry machine-readable blockers. Suspension and
offboarding are deliberately **not** gated, so an incident can always be handled.

22 tests, including every refusal path: draft, terminated, expired, no reference,
no signing date, future-dated, past `effective_to` with a stale `signed` status,
missing config, unapproved config, missing policy, invalid payout frequency, empty
payout terms, future-dated config, and multi-blocker reporting.

**b) Shipments were priced from invented physical data.**
`createShipmentForOrder` — the function checkout and the admin action both use —
sent `0.5 kg × items` and a fixed `10×10×5 cm` box to Shiprocket. Weight decides
the courier rate the shop pays; dimensions are what a damage claim is judged
against. `lib/shipping/verify.ts` existed specifically to prevent this and was
bypassed.

Now a verified measurement is required per product (`product_shipping_data`),
weight is summed and rounded **up**, dimensions take the largest envelope per
axis, and a missing measurement throws `MissingPhysicalDataError` naming the
products. No fallback exists. 10 tests.

### 3.2 — Schema and verification

* Migration `010` (additive, forward-recovery noted) — applied to staging,
  `verify-schema` extended to gate it: **21 tables verified**.
  Name collision caught and avoided: a `partner_agreement` table already exists in
  the Medusa artist module, so the marketplace table is
  `marketplace_partner_agreement`.
* Single-owner constraint `uq_partner_product_product` — two partners can no
  longer claim the same product id.
* New admin routes: partner commercial terms (read/record) and per-product
  shipping data, both permission-gated and attributed to the session identity.

### 3.3 — Verification actually executed (not described)

| Check | Result |
| --- | --- |
| Storefront unit tests | **1701 passed**, 4 skipped (was 1669 → +32 new) |
| Backend unit tests | 101 passed |
| Typecheck / lint / build | pass |
| Migration 010 applied to staging | passed; 21 tables gated |
| Backup → restore → verify | **executed** (108 K dump, 213 tables, restore verified, schema gate passed on the restored DB) |
| Staging E2E | **71 passed / 0 failed / 35 skipped**, exit 0 |
| Partner isolation | 38 negative tests pass |
| Terraform fmt + validate | clean / valid |
| Image layer scans (both images) | clean |
| Dependency gate (3 scopes) | 0 high/critical, 0 exceptions |
| Secret scan (860 files) | clean |
| Git-history exposure scan | new tool; inventory produced |

## 4. Corrections made to earlier assumptions

| Assumption | Correction |
| --- | --- |
| "E2E failures are regressions" | They were environment artefacts: the Playwright-managed server had no Medusa publishable key (its `env` replaces rather than merges), and 2 projects × default workers overran a single server. Proven by serial re-run; product pages verified directly at 200 with JSON-LD. |
| "A `partner_agreement` table can be added" | It already exists in the Medusa artist module with different semantics. Renamed to `marketplace_partner_agreement`. |
| "zod came through Medusa" (earlier mission) | It was dev-only through eslint; already corrected and fixed. |
| "Tests passing means the journey works" | 35 scenarios are **skipped**, not passed. They are all the marketplace, payment and finance journeys. |
| "Backup exists" | A backup is a hypothesis until restored. It was restored and verified. |

## 5. What remains — and cannot be closed by engineering

| # | Blocker | Owner |
| --- | --- | --- |
| 1 | Rotate/revoke 6 credentials; prove the old ones fail | owner + release eng |
| 2 | Confirm no affected image left the machine | owner |
| 3 | Razorpay sandbox keys + webhook secret | owner |
| 4 | Partner identities, signed agreements, commission + payout terms | owner + legal + accountant |
| 5 | Product ownership, stock counts, unique/replenishable classification | owner |
| 6 | Real photographs for 15 products | owner |
| 7 | Shiprocket credentials, pickup address, measured parcels | owner |
| 8 | Production domain, DNS access, TLS renewal ownership | owner |
| 9 | Monitoring destination + recipients + a received test alert | owner |
| 10 | Off-site backup destination, retention, key custody, restore authorization | owner |
| 11 | Production rollback authorization and window | owner + release eng |
| 12 | Execute the 35 skipped E2E scenarios once fixtures exist | release eng |
| 13 | **SES email readiness** — separate blocker, untouched | owner |
| 14 | **GSTIN / HSN-SAC / tax treatment** — separate blocker, untouched | owner + CA |
| 15 | **Refund policy + returns window** — separate blocker, untouched | owner |

## 6. Definition of done — status

| # | Requirement | Status |
| --- | --- | --- |
| 1 | In-scope engineering complete or explicitly blocked | **DONE** — every item classified |
| 2 | Every exposed credential has a record or a named blocker | **DONE** — R-01…R-11, 6 outstanding with owners |
| 3 | Two synthetic partners pass tenant-isolation tests | **DONE** (code/API level; browser E2E skipped) |
| 4 | Partner identity/agreement/finance workflow ready and validated | **DONE** — activation gate + admin routes + tests |
| 5 | Shiprocket provider-verified, or blocked and not reported as passed | **BLOCKED, correctly reported** |
| 6 | Catalogue/stock/ownership measured; nothing fabricated | **DONE** — measured, all gaps quantified |
| 7 | DNS/TLS, monitoring, backups verified to the extent access permits | **PARTIAL** — backup drill PASS, others blocked |
| 8 | E2E executed with real results; no skip counted as pass | **DONE** — 71/0/35, skips enumerated |
| 9 | Independent auditor reviewed the evidence | **DONE** — §4 corrections; gates re-derived from artifacts, not from agents' claims |
| 10 | Report separates staging qualification from production verification | **DONE** — this document |

## 7. Honest summary in one paragraph

The platform's engineering and security posture is materially better than at the
start of this mission: two commercial defects that would have caused wrong
payouts and wrong courier charges are closed with tests, the schema now enforces
single-owner products and measured parcels, the dependency and secret gates are
green with zero exceptions, both images are secret-free by layer inspection, and
the staging stack serves 71 passing browser journeys with zero failures. That is
**staging qualification**, not production readiness. Six confirmed-exposed
credentials are still valid, and the business data a shop needs to actually trade —
partners, agreements, commissions, stock, product ownership, photographs,
shipping measurements, a domain, alert recipients — does not exist yet. Production
stays **NO-GO**, and the excluded SES, GSTIN, HSN/SAC and refund-policy items
remain separate blockers regardless of everything above.
