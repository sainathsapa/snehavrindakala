# Deploying SnehaVrinda Kala

One compose file starts everything: storefront, Medusa backend, Postgres, Redis,
and a one-shot seed job. The same file runs on a laptop and on a server; what
changes is `.env`, not the file.

## What "up" does

```
postgres + redis  (healthy)
  └─ backend      waits for Postgres, runs migrations, then serves :9000
       ├─ seed    one-shot: admin users, region, sales channel, publishable
       │          key, categories, starter catalogue, shipping option
       └─ storefront  resolves the publishable key from the backend, applies its
                      own tables, then serves :3000
```

`storefront` waits for `seed` to exit 0, so a shop that is missing its
publishable key never comes up half-configured.

## First run (anywhere)

```bash
git clone <repo> && cd snehakala
cp .env.example .env
# fill in JWT_SECRET, COOKIE_SECRET (openssl rand -hex 32), ADMIN_EMAIL,
# ADMIN_PASSWORD, and the public URLs
docker compose up -d --build
```

Check it:

```bash
docker compose ps                                   # all healthy
docker compose logs seed | tail -5                  # provisioning summary
curl -s localhost:9000/health                       # {"status":"ok"}
curl -s -o /dev/null -w '%{http_code}\n' localhost:3000/
```

Then sign in to the storefront admin at `/admin` with `ADMIN_EMAIL` /
`ADMIN_PASSWORD`.

## Server deployment

1. **Size.** The backend peaks around 1.2 GB with migrations running, the
   storefront around 400 MB. 2 vCPU / 4 GB is the practical floor; 8 GB gives
   room for the TypeScript build if you build on the host.
2. **Ports.** Postgres, Redis, the backend and the storefront are all published
   on `127.0.0.1` only. Nothing but the proxy is reachable from outside, which is
   deliberate: the bundled Redis has no password, and a public Redis is a remote
   shell.
3. **TLS.**
   ```bash
   # in .env
   STOREFRONT_DOMAIN=shop.example.com
   API_DOMAIN=api.example.com
   NEXT_PUBLIC_STOREFRONT_URL=https://shop.example.com
   MEDUSA_BACKEND_URL=https://api.example.com
   MEDUSA_ADMIN_URL=https://api.example.com/app
   STORE_CORS=https://shop.example.com
   ADMIN_CORS=https://shop.example.com,https://api.example.com
   AUTH_CORS=https://shop.example.com,https://api.example.com
   STOREFRONT_URL=https://shop.example.com

   docker compose --profile proxy up -d
   ```
   Caddy fetches and renews certificates on its own (see `deploy/Caddyfile`).
   Two hostnames because the shop's `/admin/*` pages and Medusa's `/admin/*` API
   cannot share one origin.
4. **Public URL is baked at build time.** `NEXT_PUBLIC_STOREFRONT_URL` is inlined
   into the client bundle. Set it before the first `docker compose build`, or
   rebuild the storefront after changing it.
5. **Secrets stay in `.env`.** Quote any value containing `#` — compose treats an
   unquoted `#` as the start of a comment and silently truncates the value.

## Using a managed database or cache

Set both variables; the bundled containers stay idle if you leave them running:

```
CONTAINER_DATABASE_URL=postgresql://user:pass@db.example.com:5432/medusa?sslmode=require
CONTAINER_REDIS_URL=rediss://:pass@cache.example.com:6379
```

They are deliberately *not* called `DATABASE_URL` / `REDIS_URL`. Those names are
what host tooling uses, and a `localhost` URL copied from a host shell into a
container means the container's own loopback, where nothing is listening.

Managed Postgres usually needs TLS: use `sslmode=require` (or `verify-full`).
The bundled container speaks plain TCP, which is why its default carries
`sslmode=disable` — Medusa enables TLS for any host that is not localhost, and
without the parameter migrations hang until they report "pool is probably full".

## Backups

Two things hold state:

| What | Where |
| --- | --- |
| Products, orders, customers | `postgres_data` volume |
| Admin-uploaded media | `storefront_media` volume |

```bash
# Database. Verified dump, dated, retention applied — see docs/BACKUPS.md.
./scripts/backup-db.sh

# Or let the compose service do it nightly (dumps land in ./backups):
docker compose --profile ops up -d backup

# Media, which is a Docker volume and not in the dump at all.
docker run --rm -v snehavrinda-kala_storefront_media:/data -v "$PWD/backups":/out \
  alpine tar czf /out/media-$(date -u +%Y%m%dT%H%M%SZ).tar.gz -C /data .
```

A dump is unproven until it has been restored. `./scripts/restore-drill.sh
<file>` restores into a scratch database and counts rows; run it monthly. The
drill, the failure modes and what is still not covered (off-site copies,
point-in-time recovery) are in [BACKUPS.md](BACKUPS.md).

Redis holds cache, workflow state and the event bus. Losing it costs in-flight
workflows, not orders.

## Redeploying

```bash
git pull
docker compose build
docker compose up -d
```

Migrations run on backend start, before the server listens. The seed job is
idempotent, so it re-runs harmlessly and picks up new catalogue entries.

## Abuse limits

The three public forms are rate limited per client address, in Postgres, with a
fixed window: newsletter signup 5/hour, work alerts 10/hour, the enquiry form
5/hour. Over the limit answers `429` with `Retry-After` (JSON for the enhanced
forms, a redirect for a plain form post — the limit is never a silent loss).

`rate_limit_hits` is pruned as it goes. The limiter **fails open**: if Postgres
is briefly unavailable a signup is still accepted, because losing a real
customer to guard against a hypothetical script is the wrong trade at this size.
Behind the Caddy profile the client address comes from `x-forwarded-for`; if you
put another proxy in front, make sure it sets that header or every visitor looks
like the proxy.

## Scheduled jobs

The only recurring job is the unfinished-checkout reminder, and it now has a
caller built into this repository — otherwise the endpoint exists and nobody ever
calls it, which is how the reminder would silently never be sent.

```bash
docker compose --profile ops up -d cron
```

That service (`docker-compose.yml`) POSTs the endpoint every
`CRON_INTERVAL_SECONDS` (default 21600, six hours) from inside the compose
network, sending `CRON_SECRET` as a bearer header so the secret stays out of
proxy logs. It refuses to start with an empty secret rather than looping on 503s.

On a host that already runs cron and would rather not run another container, this
is the equivalent line:

```bash
# hourly. The secret is in .env on the server.
0 * * * * curl -fsS -H "Authorization: Bearer $(CRON_SECRET)" \
  https://shop.example.com/api/cron/cart-reminders >/dev/null
```

It obeys the same rules as `/admin/carts`: a cart is eligible after
`ABANDONED_CART_HOURS` of quiet, each cart is reminded once, ever, carts holding a
work that has since sold are skipped, and up to 25 are handled per run. Without
`CRON_SECRET` the route answers 503 and sends nothing — it is disabled rather than
open. Each run reports `sent` / `skipped` / `failed`, and `skipped` means no mail
transport is configured, not that it worked.

Generate the secret once with `openssl rand -hex 32` and put the same value in
`.env`; a reminder run with an unset secret is a no-op by design.

Nightly backups are a compose service rather than cron: see
[BACKUPS.md](BACKUPS.md).

## Known gaps

* **The providers load, but checkout still completes on the system provider.**
  Both adapters were Medusa v1 shapes and could not register at all; they are
  now v2 providers (`AbstractPaymentProvider`, `AbstractFulfillmentProviderService`),
  registered only when their credentials are set. That is verified on a running
  backend: `pp_razorpay_razorpay` and `shiprocket_shiprocket` both resolve, and
  the seed now attaches the Razorpay id to the INR region.

  What is *not* switched over is the checkout session itself. The storefront
  creates the Razorpay order from `/api/store/checkout/payment-session` and
  completes the cart with `pp_system_default`, verifying the signature and the
  captured payment server-side in `complete/route.ts`. Moving that to
  `pp_razorpay_razorpay` means one of the two order-creation paths has to go,
  and doing it without a sandbox run risks charging twice or not at all. It is a
  separate, testable change. Until then the provider is available to the admin
  for capture, refund and webhook handling, and the storefront path is the one
  that takes the money.

  **The switch is built and off.** `CHECKOUT_RAZORPAY_PROVIDER=1` makes the
  payment module own the checkout session (`pp_razorpay_razorpay`): the provider
  creates the Razorpay order and `authorizePayment` reads it back during cart
  completion. It refuses to switch on unless `RAZORPAY_KEY_ID`,
  `RAZORPAY_KEY_SECRET` *and* `RAZORPAY_WEBHOOK_SECRET` are all set — on that
  path the webhook is how a captured payment is learnt, not an optional extra —
  and it logs a warning and falls back to `pp_system_default` when the flag is
  set but the setup is incomplete. The flag is deliberately literal: only `1`
  opts in. "The keys are set" is not evidence that the flow has been run.

  Do not turn it on until one sandbox purchase has been completed end to end on
  it, including a payment captured from the Razorpay dashboard rather than the
  browser. Both paths create a Razorpay order; the failure this protects against
  is one cart producing two, which is invisible until a customer is charged
  twice.

  Fulfilment behaves the same way: the Shiprocket provider is registered and
  usable for admin-created fulfilments, while order shipments are still created
  by `lib/shipping/create-order-shipment.ts` in the storefront.
* **Email is a no-op until SES is configured.** `FROM_EMAIL` plus
  `AWS_SES_*` credentials make it real; without them messages are rendered,
  recorded as `skipped`, and nothing is sent.
* **Backend → storefront notifications need a matching secret.** The backend
  posts to the storefront's `/api/internal/notifications` with
  `INTERNAL_NOTIFY_SECRET`; the storefront rejects a request without it and the
  backend logs `skipped`. Set the same value on both services or order emails
  never leave the backend.
* **The single-node Redis is not highly available.** Fine for one server; a
  restart drops cached sessions and in-flight workflow state.

## Webhooks

Two callbacks matter, and both fail closed: with no secret configured the handler
returns `not_supported` and acts on nothing, so a forged request cannot mark an
order paid. That also means silence, not an error, when the secret is missing —
which is why `/admin/settings` shows Payments as *partial* until it is set.

**Razorpay.** Set `RAZORPAY_WEBHOOK_SECRET` to a value you also paste into the
Razorpay dashboard, and register:

```
https://api.<your-domain>/hooks/payment/pp_razorpay_razorpay
```

Subscribe to `payment.captured`, `payment.authorized`, `payment.failed`,
`payment.pending` and `order.paid`. Generate the secret once with
`openssl rand -hex 32`; Razorpay will not show you the value afterwards. Until
this is done, an order only becomes paid if the buyer's browser returns to the
confirmation page — a payment captured from the Razorpay app or dashboard is not
recorded by the shop on its own.

**Shiprocket.** `SHIPROCKET_WEBHOOK_TOKEN` is compared in constant time against
the token sent with tracking callbacks. Unset means callbacks are refused, so
delivery status stays whatever the last admin action set.

Both secrets are read at provider construction, so a backend restart is needed
after changing them.

## Refunds

Refunds at or above `REFUND_APPROVAL_THRESHOLD` (rupees, default 5000) need two
admins. The requester cannot approve their own refund: `/admin/refunds` lists
what is waiting, and the POST endpoint refuses it with a 403 even if the button
were clicked. Below the threshold the refund is approved on the spot and the row
says so.

The storefront records and approves refunds; it does **not** move money. The
decision is released from the Razorpay dashboard and the row says "release the
money" until someone marks it. This is why `order_refunds.status` has an
`approved` state separate from `completed`.
