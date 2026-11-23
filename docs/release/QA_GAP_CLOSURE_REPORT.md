# QA Gap-Closure Report — Engineering Gap Closure mission (A10 Independent QA)

> Agent: **A10 — Independent QA** · Branch: `remediation/engineering-gap-closure` ·
> Date: 2026-11-23 · Owned files created here: `apps/storefront/tests/qa-gap-closure*.test.ts`
> (10 files) and this report only. **No other file was edited; git was not touched; no gate was
> marked PASS.**

## 0. Honesty / scope of this verification

- I did **not** reimplement any gap. I read the shipped source and wrote **new, independent**
  tests that assert the promised behaviour via static source assertions, pure functions and
  fake (injected) executors. **No live database, no credentials, no live payments, refunds,
  emails, payouts or network calls** were used.
- Every verdict below is **code-level / static only**. Where the promised behaviour needs a real
  Postgres instance, an SES/SNS topic, Razorpay sandbox keys, a CRON_SECRET or legal sign-off, the
  live half remains **NOT VERIFIED / BLOCKED BY OWNER INPUT**, exactly as in
  `QA_CONSOLIDATED_FINDINGS.md` and `FINAL_GO_RELEASE_REPORT.md`.
- A signature was verified in a test with a locally generated RSA key pair; that proves the
  *verification code path*, not that any real SNS message was received.

## 1. Per-gap verification table

| Gap | Key evidence (file:line) | Independent test file | Verdict |
|---|---|---|---|
| **A01** Razorpay webhook | `app/api/webhooks/razorpay/route.ts:27-56` (raw `req.text()`); `lib/payments/events.ts:127-143` (HMAC-SHA256 + `timingSafeEqual`, fail-closed on blank secret); `lib/payments/events.ts:85-100` (`ON CONFLICT (provider, provider_event_id) DO NOTHING`); `db/migrations/004_payment_reconciliation.sql:8,22` (`UNIQUE(provider, provider_event_id)`); `lib/payments/webhook.ts:205-225` (provider-truth cross-check), `382-586` (dedupe, refund branch, stale-event guard at 509, no order/charge INSERT) | `qa-gap-closure-a01-webhook.test.ts` (11) | **VERIFIED** (code-level)¹ |
| **A02** Audit coverage | `lib/partner-audit/audit.ts:80-132` (durable `recordMutationAudit` that throws), `165-232` (`auditPayload` redaction), `239-244` (`redactAuditText`); all 14 in-scope mutation routes call `recordMutationAudit`/`recordAdminAction`/`auditFinanceAction`; `app/api/admin/orders/[id]/refund/route.ts:127-140` (`refund.requested`, redacted reason); `app/api/store/partner-applications/route.ts:63-70` (`partner_application.submitted`, status+requestId only) | `qa-gap-closure-a02-audit.test.ts` (7) | **VERIFIED** (code-level)² |
| **A03** Notifications | `lib/notifications.ts:333-349` (bounded backoff/cap), `381-476` (classify + plan + dead-letter), `509-717` (leased worker), `661-677` (`status=sent` + `delivery_status=accepted`, "NOT delivered"), `818-1205` (SNS canonical string, `verifySnsSignature`, `precheckSnsMessage`, SES event mapping/suppression); `app/api/webhooks/ses/route.ts:47-121`; `app/api/cron/notification-retries/route.ts:25-49` (CRON_SECRET); `app/api/admin/notification-retries/route.ts:17-26`; `docker-compose.yml:521-553`; `apps/backend/src/modules/notification/transport.ts:140-179` (MessageId only on success) | `qa-gap-closure-a03-notifications.test.ts` (18) | **PARTIAL** (code-level)³ |
| **A04** Refund/inventory | `lib/payments/refund-execution.ts:93-113` (approval alone never restocks), `182-220` (state setter and success flag are separate SQL; flag guarded by `inventory_restored = FALSE`), `249-404` (orchestration), `548-561` (restoration only after provider confirmation); `lib/returns/process.ts:360-366` (unique/one-of-one never restocked), `378-465` (owner evidence → `needsOwnerDecision`); `lib/inventory.ts:540-582` (`ON CONFLICT (movement_key)`); `db/migrations/007_refund_inventory.sql:9-93` (additive, `UNIQUE(movement_key)`) | `qa-gap-closure-a04-refund-inventory.test.ts` (10) | **VERIFIED** (code-level) |
| **A05** Finance policy | `lib/finance/commission-policy.ts:56-72` (`assertKnownRefundEffect`/`assertKnownPayableWhen` throw on unknown); `lib/finance/settlement.ts:43-132` (`explainPayability` fail-closed, return-window unconfigured/unknown → not payable); `lib/finance/payability-resolver.ts:56-160` (facts from `order`, `order_shipments`, `order_refunds`, `return_requests`; `configuredReturnWindowDays()`; no invented values); `app/api/admin/settlements/route.ts:85-90` (resolver passed to **both** `listEligibleLedgerEntries` and `createBatch`); `db/migrations/008_finance_constraints.sql:34-152` (historical-data RAISE guard + named CHECKs) | `qa-gap-closure-a05-finance.test.ts` (11) | **VERIFIED** (code-level)⁴ |
| **A06** Reservation hardening | `db/migrations/009_reservation_hardening.sql:56-58` (`UNIQUE(variant_id, cart_id) WHERE status='active'`), `64-75` (`CHECK (reserved + sold <= on_hand) NOT VALID`); `lib/inventory.ts:58-119` (FOR UPDATE lock + scoped active idempotency lookup); additive/idempotent/forward-recovery note present | `qa-gap-closure-a06-reservation.test.ts` (6) | **VERIFIED** (code-level)⁵ |
| **A07** Role namespacing | `lib/partner/types.ts:97-151` (canonical + legacy, `partnerRoleOrNull` fails closed); `lib/rbac.ts:244-287` (`platformRoleOrNull`, `canonicalPlatformRole`); `app/admin/actions.ts:98-110` (both session branches gate on canonical, else `null`); `db/migrations/006_role_namespacing.sql:54-85` (drops only legacy CHECK, adds wider one, no data change) | `qa-gap-closure-a07-roles.test.ts` (9) | **VERIFIED** (code-level) |
| **A08** No runtime DDL | `scripts/verify-schema.mjs:198-214` (handler check calls `fail()`, no `warn`/advisory), `32-130` (EXPECTED_SCHEMA covers 005-009 tables + 007 columns), `137-168` (28+ handlers); no CREATE/ALTER/ADD/DROP DDL in scanned `lib/` + `app/` source; `db/schema.sql` + migrations 002-009 cover all expected tables | `qa-gap-closure-a08-ddl.test.ts` (5) | **VERIFIED** (code-level)⁶ |
| **A09** Partner nav | `app/partner/components/partner-nav.tsx:69-75` (`/partner/submissions`, "Product submissions", `products:read`), `140-146` (`/partner/audit`, "Audit trail", `profile:read`); page gates: `app/partner/audit/page.tsx:62`, `app/partner/submissions/page.tsx:124` (match nav gates) | `qa-gap-closure-a09-nav.test.ts` (5) | **VERIFIED** (code-level) |
| **Migrations 005-009** | `db/migrations/005_notification_retry.sql` … `009_reservation_hardening.sql` all present, additive/idempotent, forward-recovery notes, no history deletion; 005 creates compatible `app_notification` base table (order-independent); `tests/migration-integrity.test.ts:62-66` and `tests/qa-migration-recovery.test.ts:28-32` list 005-009 | `qa-gap-closure-migrations.test.ts` (6) | **VERIFIED** (static)⁷ |

¹ Live webhook signature/dedupe against real Razorpay and a real Postgres UNIQUE index is owner-gated (`OWNER-PAY`, `QA-STACK`).
² Live audit-row durability and PII-at-rest are not observed (no DB). See finding **F2** on camelCase secret keys.
³ See finding **F1** (raw recipient in the unconfigured dev-preview log). All real SES/SNS delivery remains owner-gated (`OWNER-EMAIL`).
⁴ Settlement dual control is enforced by the DB CHECK in 008, not by an application-level actor comparison; a live DB apply was not run (GAP-14).
⁵ Real MVCC lock contention and partial-index creation on a populated table are not verified (no live Postgres).
⁶ The script's live-DB half requires `DATABASE_URL`; only the source/static half was run here.
⁷ A real fresh-install migration apply / restore drill remains owner-gated (GAP-14).

## 2. Test results (all independently run, 2026-11-23)

| Command | Result |
|---|---|
| `cd apps/storefront && npx vitest run tests/qa-gap-closure*.test.ts` | **10 files passed / 88 tests passed / 0 failed** (first run had 4 failures, all in *my own* assertions, corrected; no implementation defect was involved) |
| `cd apps/storefront && npx vitest run` (full suite) | **126 files passed / 1665 passed / 4 skipped / 0 failed** (baseline before my files: 116 / 1577 / 4 / 0 — delta is exactly my 10 files / 88 tests) |
| `cd apps/storefront && npx tsc --noEmit` | **Clean** (no diagnostics; verified with `&& echo TSC_CLEAN`) |
| `cd .. && docker compose config --quiet` | **Valid** (no output, exit 0) |

## 3. Findings (none fixed — I only own new test files and this report)

- **F1 — raw recipient appears in one dev-preview log (A03, minor / PARTIAL driver).**
  `apps/backend/src/modules/notification/transport.ts:148-150` logs
  `to=${payload.to}` and the full message text when SES is **unconfigured** (local dev/CI path,
  no email sent). Expected under "NO raw recipient in logs": recipient withheld. Actual: raw
  recipient printed. Security-relevant production paths are clean: the SES webhook logs only
  classification reasons (`app/api/webhooks/ses/route.ts:73,89,106`), the notification service
  failure log says "recipient withheld" (`service.ts:229-231`), and stored error text is
  `redactPii`-scrubbed. Recommendation (to A03 owner / Lead): redact `payload.to` in the
  dev-preview log too, or document it as an explicit non-production exception.
- **F2 — camelCase compound secret keys evade key-based redaction (A02, minor).**
  `lib/partner-audit/audit.ts:176-186` builds the sensitive-key match from
  `key.toLowerCase().replace(/[^a-z0-9]+/g," ")`, so `apiToken` → `apitoken`; the word-boundary
  regex for `token`/`api key`/`credential` does not match that token. My test confirmed a secret
  under key `apiToken` is **not** replaced (a secret under `token`, `password`, `api_key` *is*).
  PII itself is still covered by the last-line scrubber (emails and 13–19 digit card numbers are
  redacted under any key). Recommendation: also split camelCase before matching, or add a
  substring fallback for `token|secret|credential|password|pan`.
- **F3 — dead fields in webhook transaction lookup (A01, informational).**
  `lib/payments/webhook.ts:295-298` selects `payment_id, order_id, razorpay_order_id` from
  `processed_payments`, but lines `306-307` read `row.amount` / `row.currency`; the table
  (`db/schema.sql:567-574`) has neither column, so those fields are always null. Money safety is
  unaffected because the handler falls back to the authoritative provider amount
  (`webhook.ts:524`), but the local amount/currency path is effectively dead code.
- **F4 — stale outbox comment (informational).** `lib/outbox.ts:220-224` still says "no SES
  webhook ... nothing at present writes `delivered` or `bounced`", while the SES→SNS webhook now
  exists. Behaviour is correct; the comment is misleading and should be updated by its owner.

## 4. Unverifiable / owner-gated items (unchanged, never claimed as passes)

No live proof was possible or attempted for: real Razorpay signature verification and event
dedupe on Postgres; real dual-control enforcement by migration 008; real concurrent reservation
lock/index behaviour; real SES send/delivery/bounce events and SNS topic subscription; CRON_SECRET
value; fresh-install migration apply and backup/restore drill; legal sign-off, production secrets,
domain/DNS/TLS, commission rates and payout provider. These remain **BLOCKED BY OWNER INPUT** or
**NOT VERIFIED (live)** per `OWNER_INPUT_REQUIRED.md` and the FINAL GO report.

## 5. Gate stance — explicit statement

**I, AGENT 10, DID NOT MARK ANY GATE PASS.** I am independent QA; per the shared agent contract
only AGENT 00 may mark gates PASS after an independent re-run. My verdicts above are code-level
evidence only and do not upgrade any gate. Production readiness remains **NO-GO** pending the
owner inputs listed in `OWNER_INPUT_REQUIRED.md` and the outstanding live proofs.

## 6. Lead addendum — F1 and F2 resolved (AGENT 00)

A10 reported F1 and F2 as minor findings with a recommendation to their owners.
Both required no owner input and no live credentials, so the Lead fixed them
directly and added a regression test. This does **not** change A10's scope or its
"no gate PASS" stance; it records the outcome of routing those findings.

- **F1 fixed** — `apps/backend/src/modules/notification/transport.ts`: the dev/CI
  skipped-preview log now passes the recipient, subject and body through a
  `scrubPii()` helper (emails + 13–19 digit numbers → `[REDACTED]`) instead of
  printing `payload.to` raw. The stale "no SES webhook" comment in the same file
  was corrected. A03's code-level verdict is accordingly **upgraded to VERIFIED**
  (the live SES/SNS delivery half remains owner-gated).
- **F2 fixed** — `apps/storefront/lib/partner-audit/audit.ts`: `normaliseKey()`
  now splits camelCase (`apiToken` → "api token") before lowercasing, so the
  existing `\btoken\b` / `api key` / `credential` rules fire. A02's verdict stays
  **VERIFIED** (strengthened).
- **Regression coverage** — new `tests/qa-pii-hardening.test.ts` (4 tests,
  passing) pins both fixes statically and with `auditPayload`/`redactAuditText`.
- **F3 / F4** (dead `row.amount`/`row.currency` reads in `webhook.ts`; stale
  comment in `lib/outbox.ts`) are informational and were left unchanged; no
  behavior or security impact.

No gate was marked PASS by the Lead as a result of these fixes.
