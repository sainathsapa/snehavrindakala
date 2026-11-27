#!/usr/bin/env bash
#
# go-live.sh — the whole launch, in one command, with the stops in the right
# places.
#
#   sudo bash deploy/go-live.sh snehavrinda.in admin@snehavrinda.in
#
# Everything here is ordered by what actually fails first on a new box: DNS
# before certificates, certificates before the proxy binds :443, and a smoke test
# before anyone is told the shop is open. Run it from the repository root.
#
# What it will NOT do:
#
#   * create the server, or point DNS at it. Those need an account and a card.
#   * invent live payment keys. It checks that they are live and refuses to
#     continue if they are not — a launch that takes no real money is not a
#     launch, it is a rehearsal with real customers.
#   * write your content. Empty rooms are reported, not filled with invented
#     prose.
#
# Each step either passes or stops. Nothing here is "best effort": a release that
# continues past a failed TLS check produces a site that half works, which is
# harder to diagnose than one that never started.

set -euo pipefail

DOMAIN="${1:-}"
EMAIL="${2:-}"

# --allow-test-keys brings up a real server that cannot take money, on purpose:
# useful for proving the box, the certificate and the pages work before live keys
# exist. It is loud, it skips exactly one check, and it is never the default.
ALLOW_TEST_KEYS=0
for arg in "${@:3}"; do
  [ "$arg" = "--allow-test-keys" ] && ALLOW_TEST_KEYS=1
done

say() { printf '\n\033[1m== %s\033[0m\n' "$*"; }
ok() { printf '   \033[32mok\033[0m %s\n' "$*"; }
die() { printf '\n\033[31mstopped:\033[0m %s\n' "$*" >&2; exit 1; }

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

[ -n "$DOMAIN" ] || die "usage: sudo bash deploy/go-live.sh <domain> <email>"
[ -n "$EMAIL" ] || die "usage: sudo bash deploy/go-live.sh <domain> <email>"

say "1/10 the environment file exists"
[ -f .env ] || die "no .env — copy the three env files up before deploying"
ok ".env found"

say "2/10 the domain resolves to this machine"
IP="$(curl -fsS --max-time 10 https://api.ipify.org || true)"
[ -n "$IP" ] || die "could not determine this machine's public IP"
RESOLVED="$(getent hosts "$DOMAIN" | awk '{print $1}' | head -1 || true)"
[ -n "$RESOLVED" ] || die "$DOMAIN does not resolve. Point the A record at $IP and wait for propagation."
[ "$RESOLVED" = "$IP" ] || die "$DOMAIN resolves to $RESOLVED, but this machine is $IP. Fix the A record before TLS — certbot will fail otherwise."
ok "$DOMAIN -> $IP"

say "3/10 memory headroom"
# A 2 GB box builds a Next.js image and runs Postgres, Redis, Medusa and the
# storefront on it. Without swap the build is killed by the kernel and the operator
# sees "exit 137" with no explanation.
mem_mb=$(awk '/MemTotal/ {printf "%d", $2/1024}' /proc/meminfo 2>/dev/null || echo 0)
if [ "$mem_mb" -lt 3000 ] && ! swapon --show 2>/dev/null | grep -q '/swapfile'; then
  fallocate -l 2G /swapfile 2>/dev/null || dd if=/dev/zero of=/swapfile bs=1M count=2048 status=none
  chmod 600 /swapfile && mkswap /swapfile >/dev/null && swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
  ok "2 GB swap added (RAM is ${mem_mb} MB)"
else
  ok "enough memory (${mem_mb} MB)"
fi

say "4/10 the stack is running without the proxy"
docker compose up -d --build postgres redis backend storefront
ok "postgres, redis, backend and storefront are up"

say "5/10 storefront schema"
# Medusa's own migrations create Medusa's tables. Everything the shop built on top
# of them — orders' public references, the payment event log, tickets, returns,
# wishlists, the search log, product views — lives in apps/storefront/db/migrations
# and was applied by hand during development. Nothing in this script ever ran it, so
# a fresh box would have come up with a shop whose order pages, admin ledger and
# insights had no tables at all.
#
# The runner is idempotent and records each file's checksum, so re-running after a
# deploy applies only what is new.
docker compose run --rm --entrypoint node storefront \
  apps/storefront/scripts/migrate.mjs \
  || die "storefront migrations failed — nothing has been exposed yet"
ok "storefront schema applied"

say "6/10 seeding owners and launch content"
# Owner accounts and the two editorial sections lived only in the developer's
# database. On a fresh box the panel would have had no way in and the nav would
# have pointed at empty rooms, so the content is seeded here, idempotently.
node scripts/seed-launch-content.mjs --docker \
  || die "seeding failed — nothing has been exposed yet"
ok "owners and content seeded"

say "7/10 configuration check"
# --prod refuses test payment keys, a localhost storefront URL, or a missing mail
# transport. This is the step that catches a shop which boots and cannot sell.
if [ "$ALLOW_TEST_KEYS" = "1" ]; then
  PREFLIGHT_BASE_URL="http://127.0.0.1:3000" node scripts/preflight.mjs --prod --allow-test-keys \
    || die "preflight failed — see the failures above. Nothing has been exposed yet."
  printf '   \033[33m!! REHEARSAL BOX: test payment keys. It cannot take real money.\033[0m\n'
  printf '   \033[33m!! Put live keys in the env files and re-run before telling anyone.\033[0m\n'
else
  PREFLIGHT_BASE_URL="http://127.0.0.1:3000" node scripts/preflight.mjs --prod \
    || die "preflight failed — see the failures above. Nothing has been exposed yet."
fi
ok "preflight passed"

say "8/10 certificates"
if [ -d "/etc/letsencrypt/live/$DOMAIN" ] || docker compose run --rm --entrypoint sh proxy -c "test -d /etc/letsencrypt/live/$DOMAIN" 2>/dev/null; then
  ok "certificate already present for $DOMAIN"
else
  bash deploy/tls-init.sh "$DOMAIN" "$EMAIL" \
    || die "certbot failed. Usually DNS: the A record must resolve before this runs."
  ok "certificate issued"
fi

say "9/10 the front door comes up"
# The proxy lives in a compose profile. A plain `up -d` starts everything except
# nginx, which leaves a healthy-looking stack with nothing on 80/443.
docker compose --profile proxy up -d
sleep 3
docker compose exec -T proxy nginx -t >/dev/null 2>&1 \
  || die "nginx rejected its own configuration — run: docker compose logs proxy"
ok "nginx accepted its configuration"

say "10/10 smoke test from the outside"
code_https="$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "https://$DOMAIN/" || true)"
[ "$code_https" = "200" ] || die "https://$DOMAIN/ returned $code_https"
ok "https://$DOMAIN/ 200"

redirect="$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "http://$DOMAIN/" || true)"
[ "$redirect" = "301" ] || die "http://$DOMAIN/ returned $redirect, expected a 301 to https"
ok "http -> https redirect"

health="$(curl -s --max-time 20 "https://$DOMAIN/api/health" || true)"
echo "$health" | grep -q '"status":"ok"' \
  || die "health is not ok: $health"
ok "/api/health: $(echo "$health" | head -c 90)"

api="$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "https://api.$DOMAIN/health" || true)"
[ "$api" = "200" ] || die "https://api.$DOMAIN/health returned $api — check API_DOMAIN and the api A record"
ok "api.$DOMAIN healthy"

cat <<EOF

$(printf '\033[32mThe shop is live at https://%s\033[0m' "$DOMAIN")

Before you announce it, do these three, in this order:

  1. A real order, on a real card, for the cheapest work. Then refund it from
     the Razorpay dashboard. If the confirmation email does not arrive, stop.

  2. Razorpay -> Webhooks -> https://$DOMAIN/api/webhooks/razorpay
     Events: payment.captured, payment.failed, refund.processed.

  3. Shiprocket -> Webhooks -> https://$DOMAIN/api/webhooks/courier
     Type x-api-key, value SHIPROCKET_WEBHOOK_TOKEN. Then enable it.

Nightly backups were installed by bootstrap-vps.sh (02:15). A dump nobody has
restored is a rumour — run scripts/restore-drill.sh once and write the date down.
EOF
