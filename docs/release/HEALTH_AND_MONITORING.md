# Health, monitoring & observability readiness — SnehaVrinda Kala FINAL GO

> Owner: AGENT A105 (QA). Branch: `remediation/final-go`. Date: 2026-11-23.
>
> **Gate honesty.** This document reports static + pure verification only. The
> evidence is `apps/storefront/tests/qa-health-monitoring.test.ts` (24 passing
> tests) — it reads deployment files from disk and exercises pure config helpers;
> it sends no request, opens no socket, and uses no credential. Per
> `FINAL_GO_EXECUTION_PLAN.md` §4 every gate stays **NOT VERIFIED** until AGENT 00
> independently reviews code + test evidence. Owner-gated items below remain
> **BLOCKED BY OWNER INPUT**. No secret values appear here or anywhere in the repo.

## 1. Wired and statically verified

Checked by `qa-health-monitoring.test.ts`. A removed control turns the matching
test red; passing these tests means the *mechanism exists in code*, not that the
shop is being monitored in production.

### Container health & restart
- **Healthchecks on all four core services** in `docker-compose.yml`:
  `postgres` (`pg_isready`), `redis` (`redis-cli ping`), `backend` (`/health`),
  `storefront` (`wget` of `/`). Each has `interval`, `timeout` and `retries`.
- **Health-gated startup order**, not plain container start: `backend` waits for
  `postgres`/`redis` healthy; `storefront` waits for `backend` healthy. The
  backend healthcheck only passes after its entrypoint finished migrations and
  idempotent provisioning (marker file `/tmp/store-provisioned`), so nothing
  serves against an un-migrated or unprovisioned DB.
- **Slow-start allowance** (`start_period`) on `backend` and `storefront` so a
  first boot doing migrations / publishable-key resolution is not killed early.
- **Bounded logs** via `x-logging`: `json-file`, `max-size: 10m`, `max-file: 3`,
  applied to all four services. Unbounded logs otherwise fill a small VM disk.

### TLS at the edge
- `deploy/nginxfile` terminates TLS for two hostnames (`{$STOREFRONT_DOMAIN}` →
  `storefront:3000`, `{$API_DOMAIN}` → `backend:9000`). Bare hostnames (no
  `http://`) make nginx obtain and renew certificates automatically; there is no
  `auto_https off`.
- `proxy` service (profile `proxy`) publishes `443:443` and `443:443/udp`, and
  persists certificates in the `caddy_data` volume across recreations. DB/Redis
  and the app ports stay bound to `127.0.0.1`.

### Production config gate
- `apps/storefront/lib/startup-validation.ts` exists and exports
  `validateProductionConfig`, `assertProductionConfig`, `BASELINE_KEYS`,
  `SESSION_SECRET_KEY`. In `NODE_ENV=production` it fails closed: missing
  baseline / enabled-feature settings produce `ok: false` and a throw whose
  message names **variables only, never values**. Outside production the checks
  are advisory so local/CI boots are not blocked. A partially wired integration
  (e.g. a Razorpay key with no secret) counts as enabled and fails the gate.
- **Referenced** by `tests/startup-validation.test.ts` and by release docs
  (`CI_SECURITY.md`, `PRODUCTION_RUNBOOK.md`).
- **Outstanding code wiring (not owner input):** `assertProductionConfig` is
  **not yet called at runtime bootstrap** — there is no `instrumentation.ts`.
  `CI_SECURITY.md` §6 carries the documented **Lead action** to call it in
  `register()` for the `nodejs` runtime. This MUST be wired before GO; the test
  allows the gap only while it remains documented.

### Presence-only configuration reporting
- `GET /api/admin/config-status` — admin-only (`requireAdmin`), reports
  `configurationChecklist()`; `GET /api/admin/owner-input-status` — requires
  `settings:read` and reports `validateOwnerInputs()` (`missing` / `present` /
  `configuredGroups`). Both are read-only, return **names only, never values**,
  do not read `process.env` in the handler, and 401 when unauthorised. The admin
  settings UI calls the v1 route. These are safe to screenshot or paste.

### Secret hygiene in tracked files
- All secret settings in `docker-compose.yml` are interpolated from `.env`
  (`${VAR:...}`), never hardcoded. No provider key formats (`AKIA…`, `sk_live_`,
  `rzp_live_`, GitHub/XOX tokens), no private-key headers and no long raw hex
  blobs appear in compose, the nginxfile or any `docs/release/*.md`. `.env` is
  gitignored (only the placeholder-only `.env.example` is tracked).

### Audit logging
- `lib/audit.ts` (`recordAdminAction`) writes **who / what / when** to `audit_log`.
- `lib/partner-audit/audit.ts` writes an **append-only, tenant-scoped**
  `partner_audit_log` (canonical `AUDIT_ACTIONS`, reads via `tenantQuery`, no
  update/delete path); `lib/finance/commission-policy.ts` also writes to it.
- Read-only `GET /api/admin/audit-log` (`requireAdmin`) plus the admin
  `app/admin/audit-log` UI. Both `audit_log` (schema.sql) and `partner_audit_log`
  (migration 002) are backed by DDL.

## 2. Needs owner monitoring config — BLOCKED BY OWNER INPUT

The code above is a mechanism; the following inputs are absent and cannot be
invented by this mission (`owner-inputs.ts`, `OWNER_INPUT_REQUIRED.md`). Until
supplied they are **UNCONFIGURED** and the corresponding outcome does not happen.

| Item | Owner input (env / field) | Why it blocks |
| --- | --- | --- |
| Error alerting | `SENTRY_DSN`, `MONITORING_CONFIG`, `FEATURE_MONITORING` | No error/alert sink: exceptions go only to local stdout. `.env` ships `SENTRY_DSN=` empty. Without a DSN nothing pages anyone. |
| Domain, DNS & TLS | `STOREFRONT_DOMAIN`, `API_DOMAIN`, `DOMAIN_DNS_TLS`, `NEXT_PUBLIC_STOREFRONT_URL`, `STORE_CORS` / `ADMIN_CORS` / `AUTH_CORS` | nginx auto-TLS needs real DNS records pointed at the host and ports 80/443 reachable. Defaults are `*.example.com`; no real certificate can be issued until replaced. |
| Backup destination & restore drill | `BACKUP_DESTINATION`, `BACKUP_OFFSITE_TARGET`, `BACKUP_RETENTION_DAYS` | Nightly `pg_dump` runs, but offsite copy prints "not configured"; dumps exist only on this machine. Restore drill window must be scheduled and a restore actually performed. |
| Production identity & secrets | `COOKIE_SECRET` / `JWT_SECRET`, `ADMIN_EMAIL` + `ADMIN_PASSWORD` (or Medusa pair), `DATABASE_URL`, `STOREFRONT_BASE_URL` | Required by `assertProductionConfig`; with `NODE_ENV=production` the gate fails closed until these are present. Generate HMAC secrets with `openssl rand -hex 32`. |
| Enabled-integration credentials | Razorpay / SES / Shiprocket secrets as applicable | Same gate requires these when a feature is on — a half-wired integration is an enabled one and blocks bootstrap. |
| Credential rotation confirmation | `CREDENTIAL_ROTATION_CONFIRMED` | Historically leaked credentials must be revoked and rotated externally before GO (`CREDENTIAL_ROTATION_PLAN.md`). |
| External log shipping / retention | owner-arranged log aggregator | Only local rotation is wired; shipping, retention policy, dashboards and alerts on those logs are not configured here. |

Presence is not health: a configured variable is not proof a workflow works, and
these tests do not issue a certificate, deliver an alert, or restore a backup.

## 3. Out of scope for this verification

- No live HTTP health probe, TLS handshake, certificate issuance, Sentry event,
  email, payment, or DB write was performed (static + pure only).
- Runtime bootstrap wiring of `assertProductionConfig` is a Lead action (§1);
  this QA agent may not edit `instrumentation.ts`.
- Final gate status remains **NOT VERIFIED** until AGENT 00 review.
