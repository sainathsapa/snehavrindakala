# SnehaVrinda Kala — Remediation Master Plan

> Owner: AGENT 00 (Lead Orchestrator / CTO)
> Branch: `remediation/production-readiness` (cut from `main` at `f761d2e`)
> Status: LIVE — implementation in progress
> Last updated: 2026-11-23

## 1. Baseline (measured, not recalled)

| Check | Result |
|---|---|
| Backend `tsc --noEmit` | clean |
| Backend `vitest run` | 90 passed / 90 |
| Storefront `tsc --noEmit` | clean |
| Storefront `vitest run` | 433 passed, 4 skipped |
| Working tree at start | clean except untracked `opencode.json` |

The codebase is **substantially remediated already**. Prior audits and commits
fixed the build, checkout money bug, open admin, leaked credentials in the
working tree, red tests, tax math, outbox scaffolding, two-person refund record,
partner/artist persistence, and most SEO/i18n issues. This mission therefore
targets the **gaps that remain**, with evidence, rather than re-doing shipped work.

## 2. Governing rules

- No fabricated credentials, GSTIN, HSN codes, stock quantities, commission
  rates, seller identity, partner payout rules, artist bios or business policies.
- No live charges, live refunds or real customer communications. Sandbox only.
- Backward-compatible, additive migrations. Never destroy business data.
- Only AGENT 00 marks a task `COMPLETED AND VERIFIED`, after reviewing evidence.
- A task is not complete because code was written — it needs tests + evidence.

## 3. Wave plan (from the mission brief)

| Wave | Scope | Status |
|---|---|---|
| 0 | Baseline + gap analysis | DONE — see AGENT_ASSIGNMENTS.md |
| 1 | Auth, RBAC, session verify, credentials, rate limit, audit | IN PROGRESS |
| 2 | Payments/reconciliation, inventory reservations, outbox retries, GST/invoice | PLANNED (partly externally blocked) |
| 3 | Refund execution, shipping sync, partner portal + tenant isolation, settlements | PLANNED (mostly blocked / large) |
| 4 | Canonical URLs, GA4 consent, cookie policy, data export, legal review | PLANNED |
| 5 | Migration integrity, lazy DDL, CI, monitoring | PLANNED |
| 6 | Independent E2E validation | PLANNED |

## 4. Master backlog

IDs are stable. See `AGENT_ASSIGNMENTS.md` for owner and `IMPLEMENTATION_PROGRESS.md`
for live status. `BLOCKED BY EXTERNAL INPUT` items cannot be closed without
owner/accountant data or sandbox credentials; they must not be faked.

### Wave 1 — security foundations
- `SEC-01` Unify admin session secret across sign/verify/middleware; fail closed.
- `SEC-02` Fix middleware session verification (expiry units, no cookie-presence bypass).
- `SEC-03` Enforce RBAC server-side via `requirePermission` on sensitive routes + actions.
- `SEC-04` Remove default super-admin identity fallback; document owner bootstrap.
- `SEC-05` Harden login rate limiting (trusted proxy hop, account key, no bypass in prod).
- `SEC-06` Emit audit records for privileged mutations.

### Wave 2 — core transactional
- `PAY-01` Require payment signature/order-id always; reject `authorized`-only & replayed payments.
- `PAY-02` Razorpay webhook idempotency end-to-end (propagate event id; short-circuit duplicates).
- `PAY-03` Scheduled reconciliation of browser-abandoned / captured payments.
- `INV-01` Atomic stock reservation for one-of-a-kind works (DB constraint + TTL + release).
- `NOT-01` De-duplicate order-confirmation email (single source / idempotency key).
- `NOT-02` Outbox retry/resend + delivery-status transitions + provider message id.
- `GST-01` Validated GST/seller config fields; block statutory invoice on missing mandatory data.
- `GST-02`Statutory invoice fields (GSTIN, HSN, CGST/SGST/IGST) — needs owner data.

### Wave 3 — business operations
- `REF-01` Execute Razorpay refund after two-person approval; persist provider refund id.
- `REF-02` Move two-person approval into backend; add ledger reversal on refund.
- `SHIP-01` Shiprocket status webhook/polling → local shipment + order status.
- `PART-01` Partner identity + login + partner-scoped portal.
- `PART-02` Server-side tenant isolation (partner id from session, never client).
- `PART-03` Commission rate config + calculation + settlement batch routes.

### Wave 4 — customer/website
- `SEO-01` Correct per-page canonicals + restore hreflang on 3 routes.
- `ANA-01` GA4 consent mode + 5 ecommerce events.
- `LEG-01` Cookie policy page + sitemap/footer.
- `LEG-02` Customer data export / deletion request workflow.
- `SEO-02` Absolute hreflang URLs in sitemap.

### Wave 5 — platform hardening
- `DB-01` Remove runtime `CREATE TABLE` from request handlers into versioned migrations.
- `CI-01` Dependency audit handling, health checks, CSP review.

### Wave 6
- `QA-01` Full end-to-end execution of scenarios A–H.

## 5. External inputs required from owner (never fabricated)
Live Razorpay creds + webhook secret; verified SES sender/domain + creds;
Shiprocket production creds; production domain/DNS/TLS; seller legal identity;
GSTIN; accountant-approved HSN + tax rules; seller/contact/grievance info;
real product photos + measured dimensions; real stock counts; partner commission
agreements + payout/accounting rules; analytics IDs. Details in
`PRODUCTION_CONFIGURATION.md`.
