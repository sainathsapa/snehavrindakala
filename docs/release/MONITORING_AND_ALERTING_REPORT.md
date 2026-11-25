# Monitoring & Alerting Report

**Gate status: BLOCKED BY OWNER INPUT** (no alert destination/recipients)
**Engineering status: signals and health endpoints exist; delivery of alerts is unverified**
**Owner:** business owner (recipients, escalation) + release engineering (wiring)

---

## 1. What exists today

| Signal | Where it comes from | Verified |
| --- | --- | --- |
| Storefront liveness | `GET /` → 200; container `HEALTHCHECK` | **yes** (both containers `healthy`) |
| Storefront readiness | production startup gate (`lib/startup-validation.ts`) refuses to boot with missing required config | **yes** (reproduced: missing settings stopped the process and named them, without printing values) |
| Backend liveness | `GET /health` → 200; container `HEALTHCHECK` | **yes** |
| Database reachability | backend entrypoint waits for Postgres, fails the container if unreachable | **yes** (compose start-up path) |
| Scheduler liveness | reconciliation + reservation-expiry containers running | **yes** (containers up) |
| Structured logs | container stdout (JSON-ish, secrets redacted by the app) | **yes**, not shipped anywhere |

## 2. What is *not* verified

| Required by the brief | Status |
| --- | --- |
| Uptime monitoring with a destination | **not configured** — no destination supplied |
| Error-rate alerting | **not configured** |
| Payment-webhook failure alerting | signal exists in logs; **no alert route** |
| Outbox / notification backlog alert | query exists; **no alert route** |
| Reservation-expiry / reconciliation failure alert | cron endpoints return status; **no alert route** |
| Database health alert | health check exists; **no alert route** |
| Disk / storage capacity alert | **not implemented** |
| A test alert received by a human | **cannot be produced without a destination** |
| Runbook linked from each alert | runbooks exist (`PRODUCTION_RUNBOOK.md`, `RECONCILIATION_RUNBOOK.md`); **not yet linked from an alert** |

"Alerts are configured" is not claimed anywhere in this document, because an
alert that has never reached a recipient is an assumption, not a control.

## 3. Signals that should become alerts (specification)

| Alert | Condition | Why it matters | Suggested action |
| --- | --- | --- | --- |
| Storefront down | 5xx rate > 2% for 5 min, or probe failure ×3 | revenue stop | check container health, roll back |
| Backend down | `/health` non-200 ×3 | checkout and admin stop | restart task, check DB |
| Payment webhook failures | webhook 5xx or signature failures > 0 in 10 min | paid orders not confirmed | inspect `/api/webhooks/razorpay`, replay events |
| Reconciliation failures | cron reconcile non-200 or unmatched payments > 0 | money out of sync | `RECONCILIATION_RUNBOOK.md` |
| Reservation expiry backlog | expired-not-released reservations increasing | inventory locked | check `release-reservations` cron |
| Notification outbox backlog | pending notifications older than 15 min increasing | customers not informed | check worker + provider |
| Database connections | pool saturation (`PG_POOL_MAX`) sustained | request failures | raise pool / investigate leaks |
| DB storage | > 80% of allocated volume | outage risk | expand storage |
| TLS expiry | < 21 days | certificate outage | confirm renewal automation |
| Suspicious admin/partner logins | repeated failures from one IP | credential attack | review `audit_log` |

## 4. Why these cannot be wired here

Every one of them needs a **destination and a recipient** — a Slack webhook, a
PagerDuty key, an email address, an SNS topic. Supplying a placeholder destination
would produce alerts that nobody receives while the tracker reads "configured".
That is exactly the failure mode this mission is meant to avoid.

No monitoring credential was requested through chat, and no placeholder endpoint
was invented.

## 5. Owner input required

| Item | Detail |
| --- | --- |
| Destination | where alerts go (e.g. a Slack channel or on-call tool), configured by the owner in their system |
| Recipients | who is paged, and the escalation order |
| Hours | whether out-of-hours paging is expected |
| Severity policy | what is "wake someone up" vs "next business day" |
| Test acceptance | a named person to confirm receipt of a test alert |

## 6. What can be done immediately after that input

1. Create the alert rules for the §3 signals against the deployed hostnames.
2. Send one test alert per rule and have the named recipient confirm.
3. Link each alert to its runbook section.
4. Record the confirmation (who, when, which channel) in this document.

Until step 4, the monitoring gate is **NOT VERIFIED**, not PASS.

## 7. Status summary

| Item | Status |
| --- | --- |
| Health/readiness endpoints | **DONE** |
| Fail-closed startup gate | **DONE** (verified) |
| Alert specification | **DONE** (this document) |
| Alert destination | **BLOCKED BY OWNER INPUT** |
| Test alert received by a human | **BLOCKED BY OWNER INPUT** |
| Disk capacity signal | **NOT IMPLEMENTED** |
