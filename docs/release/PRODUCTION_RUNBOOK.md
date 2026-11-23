# Production runbook — SnehaVrinda Kala FINAL GO

> Owner: AGENT A85 (documentation). Branch: `remediation/final-go`. Date: 2026-11-23.
>
> This runbook describes the deployment that exists in this repository and the
> controls that are present in code. It does **not** claim that any gate is
> verified: per `FINAL_GO_EXECUTION_PLAN.md` §4 every gate is **NOT VERIFIED**
> until AGENT 00 independently reviews code + test evidence. Owner-gated items
> in `OWNER_INPUT_REQUIRED.md` / `RELEASE_BLOCKERS.md` remain blocked. No secret
> values appear here or anywhere in the repo.

## 1. Deployment topology and real paths

- Single compose file: `docker-compose.yml`. Front door: `deploy/Caddyfile`
  (two hostnames — `STOREFRONT_DOMAIN` → storefront:3000, `API_DOMAIN` →
  backend:9000; automatic TLS). See `docs/DEPLOY.md`.
- Services and enforced start order (`docker-compose.yml`):
  `postgres` + `redis` (healthy) → `backend` (migrates, then serves :9000) →
  `seed` (one-shot provisioning) → `storefront` (applies its own tables, reads
  the publishable key at start, then serves :3000).
- Postgres, Redis, backend and storefront are published on `127.0.0.1` only;
  only the Caddy `proxy` profile binds :80/:443. Never expose Redis publicly.
- Secrets live in `.env` (gitignored) or an external secrets manager — never in
  tracked files. Presence-only checks: `GET /api/admin/config-status`
  (`apps/storefront/app/api/admin/config-status/route.ts`) and
  `apps/storefront/lib/startup-validation.ts` (`validateProductionConfig`,
  `assertProductionConfig`) report which variables are missing **without values**.

## 2. Startup validation (before and after first boot)

1. Required secrets are supplied by the owner (see `OWNER_INPUT_REQUIRED.md`,
   `docs/release/PRODUCTION_CONFIGURATION.md`): `JWT_SECRET`, `COOKIE_SECRET`,
   `ADMIN_EMAIL`/`ADMIN_PASSWORD`, `MEDUSA_ADMIN_EMAIL`/`MEDUSA_ADMIN_PASSWORD`,
   DB/Redis URLs, plus any enabled integration secrets. Generate HMAC secrets with
   `openssl rand -hex 32`. `NODE_ENV=production` makes
   `assertProductionConfig` fail fast and name only missing variables.
2. Bring up the stack:
   ```bash
   cp .env.example .env    # fill secrets locally, gitignored
   docker compose up -d --build
   ```
3. Confirm all services healthy and provisioning succeeded (`docs/DEPLOY.md`):
   ```bash
   docker compose ps                                   # all healthy
   docker compose logs seed | tail -5                  # provisioning summary
   curl -s localhost:9000/health                       # {"status":"ok"}
   curl -s -o /dev/null -w '%{http_code}\n' localhost:3000/
   ```
4. Confirm configuration state without exposing values: sign in at `/admin` and
   read `/api/admin/config-status`; confirm the startup validator reports no
   missing required variables. A configured variable is **not** the same as a
   working business workflow — do not treat presence as a PASS.
5. TLS front door (owner supplies DNS/domain): set public URLs in `.env` and run
   `docker compose --profile proxy up -d` (see `docs/DEPLOY.md` and
   `deploy/Caddyfile`). Quote any `.env` value containing `#`.

## 3. Health checks (what to watch)

- Backend: `curl -s localhost:9000/health` → `{"status":"ok"}`; container
  healthcheck is `wget http://127.0.0.1:9000/health`.
- Storefront: `curl -s -o /dev/null -w '%{http_code}\n' localhost:3000/`; health
  check hits `/`.
- Compose: `docker compose ps` — postgres/redis/backend/storefront healthy,
  `seed` exited 0. `docker compose logs -f <service>` for failures.
- Notifications/outbox: `apps/storefront/app/admin/outbox/page.tsx` and
  `.../notifications/page.tsx`. Without `FROM_EMAIL` + `AWS_SES_*`, messages are
  recorded as `skipped` and nothing is sent — an empty outbox is not proof.
- Webhooks: Razorpay and Shiprocket callbacks fail closed without their secrets;
  `/admin/settings` shows Payments as *partial* until the webhook secret is set.

## 4. Migration apply order

- **Automatic path (single container, default):** `apps/backend/docker-entrypoint.sh`
  waits for Postgres (up to 120s), verifies `DATABASE_URL`, then runs
  `medusa db:migrate`, then `medusa db:sync-links` (idempotent, may be skipped),
  then `medusa start`. Migrations are recorded in the migrations table, so a
  restart on an already-migrated DB is a no-op. `stop_grace_period: 30s` prevents
  a redeploy from interrupting a migration mid-way.
- Manual equivalents (do **not** run pnpm-wide commands): from `apps/backend`,
  `pnpm exec medusa db:migrate` / `db:sync-links`, exposed at repo root as
  `pnpm migrations:run` (`pnpm --filter @snehavrinda-kala/backend migrations:run`)
  and `pnpm db:setup`.
- Storefront owns a few tables (admin sessions, translations, review cache, plus
  its own schema) and applies them at start-up; it waits for `seed` to complete
  successfully before serving.
- **Rule:** additive, backward-compatible migrations only; never destroy
  customer/business data. A multi-replica deployment must move migrations to a
  dedicated release step rather than the entrypoint (note in
  `apps/backend/docker-entrypoint.sh`). No destructive DB action happens
  automatically — see `ROLLBACK_PLAN.md`.

## 5. Daily operations — partner marketplace

Admin surfaces (`apps/storefront/app/admin/...`):

- Marketplace overview: `/admin/marketplace` — one view of partners, allocations,
  settlement batches (`.../marketplace/page.tsx`).
- **Allocation:** `/admin/marketplace/allocations` — fulfilment groups and
  "awaiting acceptance" states (`.../marketplace/allocations/page.tsx`). Review
  new orders, assign fulfilment to the correct partner, confirm acceptance and
  made-to-order commitments against partner capacity, then update stock /
  sold-out status. Partner IDs are derived from the signed server session, never
  trusted from the client.
- **Partners / applications:** `/admin/partners`, `/admin/partner-applications`,
  `/admin/marketplace/partners`. Review partner applications and keep commission
  policy, agreements and payout terms owner-supplied (never guessed — see
  `OWNER_INPUT_REQUIRED.md`).
- **Settlement approval — dual control:** `/admin/marketplace/settlements` is a
  **read-only** view. A batch is paid only when status is `payment_completed`
  **with real provider confirmation**; creation alone never marks it paid, and
  `confirmPayment` requires `confirmed === true` plus a provider event reference
  (`apps/storefront/lib/finance/settlement.ts`). Approval is a privileged action
  (`approveBatch` requires an approver identity and assumes the caller already
  checked finance permission). Operationally: two-person control — the person
  approving a batch must be a different authorized admin from the one preparing
  it, and payout confirmation must be backed by a provider reference. No payout is
  initiated from the admin page itself.
- **Refund dual approval:** `/admin/refunds` shows refunds waiting for a second
  signature. The rule lives on the server (`apps/storefront/lib/refund-approvals.ts`):
  the admin who requested the refund cannot be the one who releases it; the POST
  endpoint refuses the same actor with 403 even if the UI were bypassed. Refunds
  at or above `REFUND_APPROVAL_THRESHOLD` (rupees, default 5000) need two admins.
  The storefront records and approves the decision but **does not move money**;
  money is released from the Razorpay dashboard, and `order_refunds.status` has
  `approved` separate from `completed` until someone marks it done (`docs/DEPLOY.md`).
- Daily checklist also: check verified payment status, Shiprocket shipment
  creation failures / pickup / NDR / RTO, support/damage/refund requests, and
  failed integration events (reconcile idempotently — see
  `docs/operations/runbook.md` §Daily checklist).

## 6. Monitoring and alerts

- Watch container health (`docker compose ps`), `docker compose logs` for backend,
  storefront, seed, backup, cron, and the Caddy proxy.
- Alert on: repeated webhook failures, payment/delivery status stuck, shipment
  creation failures, settlement batches stuck before `payment_completed`, and any
  `skipped` notification surge. Reconcile missed payment events idempotently from
  the event ledger (`docs/operations/runbook.md` §Incident response).
- Backups: nightly `backup` service (`--profile ops`) writes verified dumps to
  `./backups`; `scripts/offsite-push.sh` copies off-site only when
  `BACKUP_OFFSITE_TARGET` is configured (see `docs/BACKUPS.md`). `docker compose
  logs backup` should read `backup ok: …` and must not be treated as an off-site
  copy unless an off-site target is set.
- Scheduled cart reminders: `cron` service (`--profile ops`) or host cron calling
  `/api/cron/cart-reminders` with `CRON_SECRET` (`docs/DEPLOY.md`).

## 7. Requires explicit owner authorization

Never perform these without written owner sign-off:

- **Deploy / release** to production (and any history rewrite — see
  `CREDENTIAL_ROTATION_PLAN.md`). Only AGENT 00 marks gates PASS.
- **Live payments / payouts**: flipping `CHECKOUT_RAZORPAY_PROVIDER=1` (only after
  one end-to-end **sandbox** purchase including dashboard capture), supplying live
  Razorpay keys, releasing refunds, creating/confirming settlement payouts, and
  setting commission rates, basis and payout terms.
- Changing business policy / partner identities / GSTIN / HSN, or issuing a
  statutory tax invoice before CA sign-off (`RELEASE_BLOCKERS.md` GST-02).
- Rotating or changing production secrets, DNS/TLS, and enabling integrations.
- Any destructive database operation (see `ROLLBACK_PLAN.md`).

No live charge, refund, payout or customer email is performed from this codebase
without the above authorization; sandbox/test adapters and presence-only checks
are the default.
