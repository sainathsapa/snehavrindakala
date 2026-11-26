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

say() { printf '\n\033[1m== %s\033[0m\n' "$*"; }
ok() { printf '   \033[32mok\033[0m %s\n' "$*"; }
die() { printf '\n\033[31mstopped:\033[0m %s\n' "$*" >&2; exit 1; }

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

[ -n "$DOMAIN" ] || die "usage: sudo bash deploy/go-live.sh <domain> <email>"
[ -n "$EMAIL" ] || die "usage: sudo bash deploy/go-live.sh <domain> <email>"

say "1/7  the environmd file exists"
[ -f .env ] || die "no .env — copy the three env files up before deploying"
ok ".env found"

say "2/7  the domain resolves to this machine"
IP="$(curl -fsS --max-time 10 https://api.ipify.org || true)"
[ -n "$IP" ] || die "could not determine this machine's public IP"
RESOLVED="$(getent hosts "$DOMAIN" | awk '{print $1}' | head -1 || true)"
[ -n "$RESOLVED" ] || die "$DOMAIN does not resolve. Point the A record at $IP and wait for propagation."
[ "$RESOLVED" = "$IP" ] || die "$DOMAIN resolves to $RESOLVED, but this machine is $IP. Fix the A record before TLS — certbot will fail otherwise."
ok "$DOMAIN -> $IP"

say "3/7  the stack is running without the proxy"
docker compose up -d --build postgres redis backend storefront
ok "postgres, redis, backend and storefront are up"

say "4/7  configuration check"
# --prod refuses test payment keys, a localhost storefront URL, or a missing mail
# transport. This is the step that catches a shop which boots and cannot sell.
PREFLIGHT_BASE_URL="http://127.0.0.1:3000" node scripts/preflight.mjs --prod \
  || die "preflight failed — see the failures above. Nothing has been exposed yet."
ok "preflight passed"

say "5/7  certificates"
if [ -d "/etc/letsencrypt/live/$DOMAIN" ] || docker compose run --rm --entrypoint sh proxy -c "test -d /etc/letsencrypt/live/$DOMAIN" 2>/dev/null; then
  ok "certificate already present for $DOMAIN"
else
  bash deploy/tls-init.sh "$DOMAIN" "$EMAIL" \
    || die "certbot failed. Usually DNS: the A record must resolve before this runs."
  ok "certificate issued"
fi

say "6/7  the front door comes up"
# The proxy lives in a compose profile. A plain `up -d` starts everything except
# nginx, which leaves a healthy-looking stack with nothing on 80/443.
docker compose --profile proxy up -d
sleep 3
docker compose exec -T proxy nginx -t >/dev/null 2>&1 \
  || die "nginx rejected its own configuration — run: docker compose logs proxy"
ok "nginx accepted its configuration"

say "7/7  smoke test from the outside"
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
