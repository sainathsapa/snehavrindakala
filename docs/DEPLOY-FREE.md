# Deploying Snehavrinda for ₹0 (no credit card), or for ~$5/month

Two honest paths. Pick one; both end with the same env and the same Shiprocket
webhook URL.

| | Path A — one small VPS | Path B — free split stack |
|---|---|---|
| Cost | ~$4–6/mo (Hetzner/DigitalOcean) | ₹0 |
| Card needed | yes | **no** |
| Time to live | ~30 min | ~2–3 hours |
| Uses | the repo's existing `docker-compose.yml` + `deploy/nginxfile` | Neon + Upstash + Render + Cloudflare |
| Commercial use | fine | fine (avoids Vercel Hobby's non-commercial rule) |
| Downsides | costs money | backend sleeps after 15 min idle (30–60 s cold start), two services to keep wired |

If you already pay for any host (even the AWS account the CD workflow targets),
**take Path A** — it is the path this repo was built for.

---

## Path A — single host, docker compose (recommended)

1. Create a small Ubuntu 24.04 VM (2 GB RAM minimum) in the region closest to
   your buyers (Mumbai/Singapore).
2. Point DNS: `A` record `www.snehavrinda.in` → VM IP, and `A` `snehavrinda.in`
   → same IP (apex currently 307-redirects to www).
3. Install Docker, clone the repo, fill `.env` on the server (copy the local
   `.env`; every key is already correct except the Razorpay live keys).
4. `docker compose up -d postgres redis backend storefront proxy`
5. Run once: `docker compose run --rm backend pnpm migrations:run`
6. Verify: `curl -s https://www.snehavrinda.in/api/health`
7. Shiprocket dashboard → webhook URL `https://www.snehavrinda.in/api/webhooks/courier`,
   `Auth Token Type: x-api-key`, token = `SHIPROCKET_WEBHOOK_TOKEN` from `.env`.

`deploy/nginxfile` already terminates TLS; no certificate work needed.

---

## Path B — free, no card

Blogs recommend **Render's free Postgres — do not use it** (expires after 30
days). Use Neon instead.

### 1. Database — Neon (free, permanent, commercial use allowed)
1. neon.com → new project (region: Singapore / ap-southeast-1).
2. Copy the **pooled** connection string (host contains `-pooler`).
3. Set `DATABASE_URL` to it plus `?sslmode=require&connection_limit=5`.
   The storefront uses `pg` `Pool` directly, so a small pool is mandatory on
   serverless hosts.
4. From a checkout of this repo, against Neon:
   ```bash
   pnpm install
   pnpm db:setup && pnpm migrations:run && pnpm seed:full
   ```

### 2. Redis — Upstash (free, no card)
1. upstash.com → create Redis database (Singapore) → copy the `rediss://` URL.
2. Set `REDIS_URL` to it. Medusa uses ioredis, which accepts `rediss://` TLS URLs.

### 3. Medusa backend — Render free web service
`render.yaml` in the repo root is already written as a blueprint:
1. Render → New → Blueprint → connect this repository.
2. It creates `snehavrinda-medusa` (Docker, `apps/backend/Dockerfile`, plan free).
3. Paste the secret env values when prompted (they are marked `sync: false`):
   `DATABASE_URL`, `REDIS_URL`, `SHIPROCKET_EMAIL`, `SHIPROCKET_PASSWORD`,
   `SHIPROCKET_PICKUP_LOCATION`, `SHIPROCKET_PICKUP_POSTCODE`,
   `SHIPROCKET_WEBHOOK_TOKEN`, `STOREFRONT_BASE_URL`, `ADMIN_EMAIL`,
   `ADMIN_PASSWORD`, `COOKIE_SECRET`, `JWT_SECRET`, `RAZORPAY_KEY_ID`,
   `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`.
4. Note the service URL, e.g. `https://snehavrinda-medusa.onrender.com`.
   Free services sleep after 15 idle minutes — the first request wakes it.

   Two hard limits, checked against Render's own docs: the free plan gives
   **512 MB RAM** (no headroom for Medusa plus a database in one container) and
   **750 instance hours per workspace per month — enough for exactly one
   service**. Do not also put the storefront on Render free; it would need its
   own 744 h. That is why the storefront goes to Cloudflare below.

### 4. Storefront — Cloudflare Workers (free, no card, commercial allowed)
This is the only no-card host that permits commercial use *and* runs Next.js
server routes. It needs the OpenNext adapter:
```bash
pnpm --filter storefront add -D @opennextjs/cloudflare wrangler
pnpm --filter storefront exec opennextjs-cloudflare build
pnpm --filter storefront exec opennextjs-cloudflare deploy
```
Before the first build, set the build-time vars (they are baked in, not
runtime): `NEXT_PUBLIC_STOREFRONT_URL=https://www.snehavrinda.in`,
`NEXT_PUBLIC_MEDUSA_BACKEND_URL=https://snehavrinda-medusa.onrender.com`,
`NEXT_PUBLIC_RAZORPAY_KEY_ID`.

Runtime secrets via `wrangler secret put`: `DATABASE_URL`, `SHIPROCKET_EMAIL`,
`SHIPROCKET_PASSWORD`, `SHIPROCKET_PICKUP_LOCATION`,
`SHIPROCKET_PICKUP_POSTCODE`, `SHIPROCKET_WEBHOOK_TOKEN`,
`RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`,
`COOKIE_SECRET`, `JWT_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`,
`MEDUSA_BACKEND_URL`.

> If Cloudflare fights the adapter, the fallback is Vercel Hobby — one click,
> but its terms are **personal/non-commercial**, which a real shop violates.
> Do not ship a paying shop on Hobby.

### 5. Domain
Cloudflare → custom domain for the Worker → `www.snehavrinda.in` (and a redirect
from apex).

---

## After either path — the checklist that must pass

```bash
# 1. webhook auth (expect 401 without the key, 200 with it)
curl -i -X POST https://www.snehavrinda.in/api/webhooks/courier \
  -H "x-api-key: $SHIPROCKET_WEBHOOK_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"awb":"TESTAWB1","current_status":"DELIVERED","order_id":"T-1"}'
# expect: 200 {"applied":false,"reason":"shipment_not_found"}

# 2. production config gate (expect ok=true, missing=[])
NODE_ENV=production pnpm --filter storefront exec node -e "/* see lib/startup-validation */"

# 3. shipping quote from the real pickup
curl -s "https://snehavrinda-medusa.onrender.com/health"
```

Then in the Shiprocket dashboard: URL
`https://www.snehavrinda.in/api/webhooks/courier`, `Auth Token Type: x-api-key`,
token = `SHIPROCKET_WEBHOOK_TOKEN`, and toggle the connection to ENABLED.

## Still unconfigured after deploy (not blockers)
- **Email**: set `RESEND_API_KEY` + `FROM_EMAIL`; without them confirmations and cart reminders
  are logged as skipped, never sent.
- **Razorpay**: keys are `rzp_test_…` → no real payments until swapped for
  `rzp_live_…` (and the webhook secret re-issued in live mode).
- **Backups**: `--profile ops` service is opt-in and `scripts/restore-drill.sh`
  has never run against a real dump.
- **Monitoring**: `SENTRY_DSN` unset. **CMS**: `NEXT_PUBLIC_SANITY_PROJECT_ID` unset.
