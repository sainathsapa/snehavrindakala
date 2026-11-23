# Payment reconciliation runbook — SnehaVrinda Kala

> The provider (Razorpay) is the only source of truth. A browser success flag or
> a missing webhook is not evidence that money moved or did not move. This
> runbook describes the implemented reconciliation machinery and the exact inputs
> still needed to verify it live. No credentials or secret values appear here;
> owner inputs are tracked in `docs/release/OWNER_INPUT_REQUIRED.md`.

Relevant files:

- `apps/storefront/db/migrations/004_payment_reconciliation.sql` — `payment_event`, `payment_reconciliation_issue`, `refund_execution`
- `apps/storefront/lib/payments/events.ts` — webhook signature verification + event dedupe
- `apps/storefront/lib/payments/reconciliation.ts` — provider verification, mismatch classification, issue queue, backoff
- `apps/storefront/app/api/cron/reconcile-payments/route.ts` — scheduled job
- `apps/storefront/app/api/admin/reconciliation/route.ts` — read-only admin view of the queue
- `apps/storefront/lib/cron-auth.ts` — `CRON_SECRET` guard
- `apps/storefront/tests/reconciliation.test.ts`, `apps/storefront/tests/cron-auth.test.ts`

## Webhook idempotency

`payment_event` is the dedupe boundary: `UNIQUE (provider, provider_event_id)`.
`recordProviderEvent()` in `lib/payments/events.ts` inserts with
`INSERT ... ON CONFLICT (provider, provider_event_id) DO NOTHING RETURNING id`.
It returns `isNew: true` only for the first delivery; a redelivery returns
`isNew: false` and the id already claimed. **Rule for any webhook handler: gate
the side effect (create order, post ledger row, release stock) on `isNew`.** A
redelivered event must never create a second order or second ledger effect. A
stable `payload_hash` of the canonicalized payload (`hashEventPayload`) is stored
for correlation.

Signature verification is mandatory and cannot be skipped by a route:
`verifyWebhookSignature(secret, rawBody, header)` computes an HMAC-SHA256 over
the raw body and compares in constant time, accepting both raw hex and the
`sha256=`-prefixed form. It fails closed on a missing/blank secret, missing
header or malformed digest. The webhook secret is `RAZORPAY_WEBHOOK_SECRET` and
the webhook URL must be registered on the provider dashboard — both are owner
inputs (`OWNER_INPUT_REQUIRED.md`, "Payments (Razorpay)"). Until the secret is
configured, an endpoint using this helper treats all traffic as untrusted.

## Missed webhook recovery

`reconcilePayment()` in `lib/payments/reconciliation.ts` starts from a fresh
`providerVerify(paymentId)` call; the browser's success flag and local
`payment.status` are used only to describe the mismatch, never to decide. From
the provider state it derives an order state (`paid`, `authorized`, `refunded`,
`failed`, `pending`) via `deriveOrderState()` and classifies mismatches via
`classifyMismatch()`:

| Provider says... | Local order... | Issue type |
|------------------|----------------|------------|
| amount differs from order amount | any | `amount_mismatch` |
| paid/refunded | not confirmed | `webhook_missed` if `webhookRecorded === false`, else `captured_unconfirmed` |
| authorized | not confirmed | `authorized_unconfirmed` |
| failed | confirmed | `failed_order_created` |

`webhook_missed` is specifically the "money actually moved but no webhook was
recorded" case: the payment was first learned about through the reconciler. It
opens an issue in `payment_reconciliation_issue` so a human can reconcile it;
nothing in this module marks an order paid — that stays with the signature- and
amount-verified checkout path. `issue_type` values and `status` values
(`open`, `retrying`, `resolved`, `escalated`) are fixed by the migration CHECK
constraints.

`openIssueForMismatch()` reuses an existing open/retrying issue for the same
order + type (+ payment), so a nightly run cannot pile up duplicate tickets.

## Scheduled job — `app/api/cron/reconcile-payments`

`GET|POST /api/cron/reconcile-payments` (route above) works the queue:

1. **Auth** — `authoriseCron()` from `lib/cron-auth.ts` requires `CRON_SECRET`
   and accepts `Authorization: Bearer <secret>` or `?secret=<secret>`,
   compared in constant time. Unset secret -> HTTP **503** (configuration
   problem, route disabled); wrong/missing credentials -> **401**. A scheduled
   URL must have `CRON_SECRET` set in the deployment environment.
2. **Load** — up to `MAX_PER_RUN = 100` `open` plus 100 `retrying` issues via
   `listReconciliationIssues()`.
3. **Verify** — `getPaymentVerifier()` chooses the adapter:
   - `razorpay` mode when `RAZORPAY_KEY_ID` and `RAZORPAY_SECRET` (or
     `RAZORPAY_KEY_SECRET`) are set — calls `GET
     https://api.razorpay.com/v1/payments/:id`;
   - `test` mode in non-production with no credentials — deterministic fake
     state, no live data queried;
   - `unconfigured` in production with no credentials — the verifier **throws**
     so the run fails loudly instead of silently trusting fake data.
   The response includes `providerMode` and, in test mode, the note "Test
   verifier: no live payment data was queried." **Never read a `test`-mode run
   as proof that live payments are reconciled.**
4. **Work** — `runReconciliationBatch()` verifies each issue and resolves it when
   `issueIsResolved()` agrees (paid/refunded; for `amount_mismatch`, never
   auto-close — it needs a human comparison).

Example invocations (secret is read from the environment, never hard-coded):

```
# local / non-production test adapter
curl -sS "http://localhost:3000/api/cron/reconcile-payments?secret=$CRON_SECRET"

# production (scheduler with header support)
curl -sS -H "Authorization: Bearer $CRON_SECRET" \
  "https://<host>/api/cron/reconcile-payments"
```

Run the project's own scheduled-route tests without touching live endpoints:

```
cd apps/storefront
npx vitest run tests/reconciliation.test.ts
npx vitest run tests/cron-auth.test.ts
```

Do **not** run `pnpm test` / `pnpm typecheck` (the Lead integrates those).

## Failure queue and backoff

`payment_reconciliation_issue` is the durable failure queue. Constants in
`lib/payments/reconciliation.ts`: `RECONCILIATION_MAX_ATTEMPTS = 5`,
`RECONCILIATION_BASE_DELAY_MS = 60_000`, `RECONCILIATION_MAX_DELAY_MS =
3_600_000`. `backoffDelayMs(attempt)` is binary exponential with a one-hour
ceiling, so a provider outage is not hammered.

`runReconciliationBatch()` outcomes:

- `processed` — verified and closed (`status = resolved`, `resolution` records
  the provider status, `resolved_at` set).
- `failed` — still unresolved; `status = retrying`, `attempts` incremented,
  `next_attempt_at` set using backoff, `last_error` updated.
- `escalated` — attempt budget exhausted (or already at the cap); `status =
  escalated` with `lastError = "Maximum attempts reached"`. Escalated and
  resolved rows are skipped on later runs (`skipped`).
- `amount_mismatch` is deliberately never auto-resolved by "captured" — it needs
  a person to compare order and provider amounts.

Operators act on `escalated` items and on `amount_mismatch` by inspecting the
`resolution` / `last_error` fields and the provider dashboard, then deciding the
correct order/refund action. Issue state is written only by the cron reconciler
and the refund execution path.

## Admin view

`GET /api/admin/reconciliation` (`apps/storefront/app/api/admin/reconciliation/route.ts`)
is **read-only** and gated on the `refunds:read` admin permission. It accepts
optional `status` and `limit` (clamped to 1–500, default 200) query parameters
and returns `{ issues }` from `listReconciliationIssues()`. It never mutates
issue state. There is no dedicated page component for this queue; operators use
the JSON endpoint (e.g. authenticated admin fetch) while the settlement and
refund admin pages (`app/admin/marketplace/settlements/page.tsx`,
`app/admin/refunds/page.tsx`) provide the related payout/refund views. The
outbox admin page (`app/admin/outbox/page.tsx`) shows outbound notification
delivery state.

## What still needs sandbox credentials to verify live

Everything below is owner-supplied and absent from this repository (see
`OWNER_INPUT_REQUIRED.md`). None of it may be fabricated; confirm presence by
variable **name** only, never by value.

- `RAZORPAY_KEY_ID` + `RAZORPAY_SECRET` (or `RAZORPAY_KEY_SECRET`) — **sandbox**
  keys are required for `getPaymentVerifier()` to run in real (`razorpay`) mode
  against `GET /v1/payments/:id`; without them the cron runs in test mode or
  throws in production.
- `RAZORPAY_WEBHOOK_SECRET` + a webhook URL registered on the provider dashboard
  — required to verify signed webhook intake and the `payment_event` dedupe path
  with real redeliveries.
- `CRON_SECRET` — required for the scheduled route to be callable at all;
  without it the endpoint returns 503.
- A sandbox payment/order to drive each mismatch type (paid-but-no-webhook,
  authorized, amount mismatch, failed-order-created) and confirm an issue is
  opened, retried with backoff, then resolved or escalated as expected.
- `CHECKOUT_RAZORPAY_PROVIDER=1` plus explicit written authorization are required
  before any live checkout; live keys must never be used casually.
- For related refund/notification verification: sandbox keys + a real payment id
  for `POST /api/admin/refunds/execute`, and SES sender/credentials/`FROM_EMAIL`
  plus one controlled test recipient before treating any customer notification
  as delivered (see `REFUND_AND_RETURN_POLICY.md`).

Until these are configured and verified out-of-band, reconciliation is
**implemented and locally tested but not live-verified**. The Lead records
owner-gated items as BLOCKED BY OWNER INPUT.
