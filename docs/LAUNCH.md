# Launch runbook

Six hours, one person, from "runs on my laptop" to "takes real money".
Every command here has been run at least once, except the ones marked
**needs your account** — those need a card, a login or a legal answer, and no
amount of engineering substitutes for them.

Read the whole page before starting. The order matters: DNS before TLS, TLS
before the reverse proxy binds :443, and live payment keys last, after a test
order has already gone through.

---

## 0. Before you touch a server (20 minutes)

The project has a preflight check. It answers "can this deployment take an
order?" and it is the only step that has ever caught a silent misconfiguration
in this repo — on the day it was written it found `FROM_EMAIL` blank in two of
three env files, which would have shipped a shop that never emails a buyer.

```bash
node scripts/preflight.mjs          # local
node scripts/preflight.mjs --prod   # expects live keys; run before release
```

Fix everything it marks FAIL. WARN is a judgement call and each one names the
consequence.

Then confirm the production build actually builds. Dev mode lies: it compiles
routes on demand, so a missing export or an unrenderable page only appears here.

```bash
cd apps/storefront
./node_modules/.bin/next build      # must exit 0
./node_modules/.bin/next start -p 3001
curl -s localhost:3001/api/health   # {"status":"ok",...}
```

> **Do not use `npx next start`.** `npx` resolved Next **16** from the registry
> while this project pins **15**, and the server refused to start with "Could not
> find a production build" — a confusing error for a version mismatch. Always the
> local binary, or `pnpm --filter storefront exec next`.

---

## 1. The server (45 minutes) — **needs your card**

A 2 GB Lightsail instance in Mumbai (`ap-south-1`) is enough: Postgres, Redis,
Medusa and Next together sit under 1.2 GB with room for a spike.

1. Create the instance, Ubuntu 22.04, 2 GB. Add your SSH key.
2. Open ports 22, 80, 443 in the Lightsail firewall. Nothing else.
3. Point DNS at it — **before** TLS, because certbot validates over HTTP:

   | Record | Name | Value |
   |---|---|---|
   | A | `@` | instance IP |
   | A | `www` | instance IP |
   | A | `api` | instance IP |

   Wait for propagation: `dig +short snehavrinda.in` must return the IP.

4. Install Docker and the compose plugin, then bootstrap:

```bash
scp -r . ubuntu@<ip>:/srv/snehavrinda     # or git clone on the box
ssh ubuntu@<ip>
cd /srv/snehavrinda
sudo bash deploy/bootstrap-vps.sh
```

`bootstrap-vps.sh` installs Docker, creates the swap file (2 GB is tight
without it), and starts the stack with `docker compose up -d`.

---

## 2. Environment on the server (25 minutes)

Copy your three env files up. They are gitignored and must stay that way.

```bash
scp .env apps/storefront/.env apps/backend/.env ubuntu@<ip>:/srv/snehavrinda/
```

Change these four before the first boot:

```dotenv
NEXT_PUBLIC_STOREFRONT_URL=https://snehavrinda.in
MEDUSA_BACKEND_URL=http://backend:9000
STOREFRONT_BASE_URL=http://storefront:3000
COOKIE_DOMAIN=.snehavrinda.in
```

Everything else carries over. Then `node scripts/preflight.mjs --prod` on the
server — it will fail on payment keys and `localhost`, which is correct at this
point.

---

## 3. TLS (15 minutes)

nginx cannot start before a certificate exists, which is why `tls-init.sh` runs
certbot standalone **first**, then binds the proxy.

```bash
sudo bash deploy/tls-init.sh snehavrinda.in admin@snehavrinda.in
docker compose up -d proxy
docker compose logs -f proxy        # nginx -t passes, no "unknown host"
```

The script prints the renewal cron. Save it; a certificate that expires in 90
days is an outage with a timer on it.

Verify, from outside the box:

```bash
curl -sI https://snehavrinda.in | head -5     # 200, HSTS present
curl -sI http://snehavrinda.in | head -3      # 301 to https
curl -s  https://snehavrinda.in/api/health    # {"status":"ok"}
```

---

## 4. Payments (30 minutes) — **needs your account**

Razorpay → Settings → API keys → generate **live** keys. Put them in all three
env files (the storefront needs `NEXT_PUBLIC_RAZORPAY_KEY_ID`; the checkout route
needs `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`).

Then the webhook, which is what makes an order survive a closed browser tab:

* URL: `https://snehavrinda.in/api/webhooks/razorpay`
* Secret: generate 32 bytes, put the same value in `RAZORPAY_WEBHOOK_SECRET`
* Events: `payment.captured`, `payment.failed`, `refund.processed`

Restart, then the money test:

1. Place a real order for the cheapest work. Pay with a real card.
2. Confirm: order page loads, email arrives with the invoice attached, the order
   appears in `/account`, and the admin sees it in `/admin/orders`.
3. Refund it from the Razorpay dashboard. Confirm the refund webhook flips the
   order's state.

**If step 2's email does not arrive, stop.** `node scripts/preflight.mjs --prod`
will tell you whether mail is configured; the Resend dashboard tells you whether
it was accepted.

---

## 5. The two things only you can decide (10 minutes)

**GSTIN.** If the studio is registered, put `SELLER_GSTIN` in all three files and
invoices gain a GST line. If not, leave it blank — nothing prints the words "not
registered", which was a deliberate choice.

**Shiprocket.** Email/password login works today and the token expires roughly
every ten days, so a shipment booked on a quiet week will fail on a busy one.
Either create an API user in Shiprocket and set `SHIPROCKET_API_TOKEN`, or accept
that AWB entry is manual. Either way, `SHIPROCKET_WEBHOOK_TOKEN` must be set or
courier callbacks are rejected.

---

## 6. Content before the door opens (30 minutes)

Rooms and the newsroom are public pages with nothing in them. That is worse than
absent: the nav promises a room and delivers an empty state.

1. `/admin/rooms` — one real room: a title, a wall text, the collection handle of
   work that exists.
2. `/admin/newsroom` — one real announcement. Do **not** invent press coverage;
   a fabricated "as seen in" is a lie on a public page and it is the kind of thing
   that gets found.
3. `/admin/journal` — one post is enough to prove the section is alive.

---

## 7. Go / no-go (10 minutes)

Run these and read them, do not skim:

```bash
node scripts/preflight.mjs --prod              # 0 FAIL
curl -s https://snehavrinda.in/api/health      # status ok, all three true
```

Then walk the site on a phone, on mobile data, not on the office wifi:

- [ ] Home loads under 3 s
- [ ] Shop → a work → add to cart
- [ ] Cart shows free shipping **as a discount**, not a hidden zero
- [ ] Checkout completes and the confirmation page appears
- [ ] Email arrives with the invoice PDF attached
- [ ] Order appears in the account
- [ ] A support ticket can be opened from `/account/support`
- [ ] Hindi switch works on a product page and on the cart
- [ ] `/rooms`, `/newsroom`, `/partners` all render
- [ ] Admin login, then one product edit saved

If any box is unchecked, that is the release blocker. Nothing else is.

---

## Rollback

```bash
cd /srv/snehavrinda
docker compose down
git checkout <last-good-sha>
docker compose build storefront backend
docker compose up -d
```

The database is untouched by a rollback. **Take a backup before every deploy**:

```bash
docker compose exec -T postgres pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" \
  | gzip > backup-$(date +%F-%H%M).sql.gz
```

A restore that has never been tested is not a backup. Once, before launch, restore
one into a scratch database and confirm the orders are there.
