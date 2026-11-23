# QA — Notification real-delivery readiness report

**Agent:** A92 (QA) · **Branch:** `remediation/final-go` · **Date:** 2026-11-23

## Bottom line

**No delivery pass is claimed. Real email delivery is BLOCKED BY OWNER INPUT.**

This review verified only the **code-level delivery mechanisms** with pure functions
and static source assertions. It did **not** send an email, call SES, or observe a
message in anyone's inbox. With the current configuration every send is recorded
as `skipped`, which is honest but means **no customer has received anything**.

## What is required for real delivery (owner-gated, currently UNCONFIGURED)

Real delivery needs both of the following, neither of which QA can supply:

1. **A verified SES sender** — a real `FROM_EMAIL` that is verified in AWS SES
   (and the account out of the SES sandbox for arbitrary recipients), plus
   working `AWS_SES_ACCESS_KEY_ID` / `AWS_SES_SECRET_ACCESS_KEY` (or a task role)
   in the backend environment.
2. **A controlled test recipient** — an inbox the owner authorises us to send a
   single test message to, so delivery can actually be observed.

Config audit of `.env` (presence only, values redacted):

| Variable | State |
| --- | --- |
| `FROM_EMAIL` | **EMPTY — UNCONFIGURED** |
| `AWS_SES_ACCESS_KEY_ID` | **EMPTY — UNCONFIGURED** |
| `AWS_SES_SECRET_ACCESS_KEY` | **EMPTY — UNCONFIGURED** |
| `AWS_SES_REGION` | set (not sufficient on its own) |
| `AWS_SES_CONFIGURATION_SET` | unset |

Because `readTransportConfig()` returns `null` when `FROM_EMAIL` is missing and
`sendEmailWithReceipt()` returns `{ status: "skipped" }` when config or
credentials are absent, the current, correct behaviour is **skipped, never sent**.
A `sent` status only means "handed to the transport", not "delivered".

## Test evidence

File created: `apps/storefront/tests/qa-notification-delivery.test.ts`
(15 tests, pure/static only — no network, DB, or credentials).

Command: `cd apps/storefront && npx vitest run tests/qa-notification-delivery.test.ts`
Result: **15 passed / 15**.

Verified mechanisms:

- **Status transitions** — new rows start `pending` (the queued state); outcomes
  map to `sent` / `skipped` / `failed`. Only `skipped` and `failed` are treated as
  undelivered/retryable; `pending` is still in flight.
- **Missing sender config → `skipped`, with a clear reason** — `reasonFor` returns
  `no-transport`, `detailFor` names the missing `FROM_EMAIL`/SES config, a skipped
  retry is `ok:false` and is **never promoted to `sent`**, and an empty outbox is
  explicitly not presented as good news.
- **Dedupe by `event_key`** — a UNIQUE index plus `INSERT … ON CONFLICT DO NOTHING
  RETURNING` arbitrates the claim; a losing call returns the existing row with no
  second render and no second SES call. Keys are derived stably from the order
  reference, with an explicit-key override.
- **Provider MessageId persisted on success** — the SES `MessageId` is written to
  `provider_message_id` on both the SQL and entity paths; failed/skipped outcomes
  never fabricate a MessageId.

## Findings / gaps (honest, not passes)

1. **Notification retry has NO attempts counter and NO backoff.** It is an
   operator-driven re-send under a fresh `event_key`; there is no
   `attempts`/`next_attempt_at` on notification rows. The only retry loop in the
   codebase with attempt counting and exponential backoff is **payment
   reconciliation** (`attempts`, `next_attempt_at`, `backoffDelayMs`, max 5) — a
   different domain. A dedicated test pins this gap so it cannot change silently.
2. **No SES event webhook / configuration-set destination exists.** `delivered`
   and `bounced` are declared in the vocabulary but never written. A `sent` row
   must not be read as proof of delivery.
3. **Outbox is deliberately read-only** (no resend button); recovery is a manual
   operator action against a working transport.

## Gate recommendation

- **Code-level readiness of the delivery *mechanisms*: PASS** (15/15 tests).
- **Real-delivery readiness: NOT PASSED — BLOCKED BY OWNER INPUT.** Do not record
  a delivery pass until a verified SES sender and an owner-approved controlled
  test recipient are provided and a single observed delivery is performed.

## Assumptions / notes

- The queued state in this codebase is named `pending`, not `queued`; tests use
  the actual vocabulary.
- The shared contract says the Lead owns `docs/release/**`; this specific report
  file was explicitly assigned to QA by the mission brief, so it was created here
  and no other release doc was touched.
- Only the two owned files were created; no other file was edited. No pnpm-wide
  commands were run.
