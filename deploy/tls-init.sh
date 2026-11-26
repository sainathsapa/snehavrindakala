#!/usr/bin/env bash
#
# Obtain the two TLS certificates nginx expects, then reload it.
#
#   ./deploy/tls-init.sh you@example.com
#
# Why a script rather than nginx doing it: nginx refuses to start without a
# certificate, and certbot needs something listening on :80 to answer the ACME
# challenge. That circle is broken here with certbot's standalone plugin, run
# BEFORE nginx ever starts — it binds port 80 itself for a few seconds, writes
# into the volume nginx will mount, and gets out of the way. Run once at setup,
# and again only if a domain changes; renewal afterwards is the cron entry at the
# end of this file.
#
# Requires: docker, and DNS already pointing at this machine. A certificate for
# a domain that does not resolve here will fail, by design.

set -euo pipefail

EMAIL="${1:-}"
COMPOSE="${COMPOSE:-docker compose}"

if [[ -z "$EMAIL" ]]; then
  echo "usage: $0 <email-for-expiry-notices>" >&2
  exit 1
fi

# Domains come from the environment file, the same source compose reads.
if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

STOREFRONT_DOMAIN="${STOREFRONT_DOMAIN:-}"
API_DOMAIN="${API_DOMAIN:-}"

if [[ -z "$STOREFRONT_DOMAIN" || -z "$API_DOMAIN" ]]; then
  echo "STOREFRONT_DOMAIN and API_DOMAIN must be set in .env" >&2
  exit 1
fi

echo "→ checking DNS for ${STOREFRONT_DOMAIN} and ${API_DOMAIN}"
for name in "$STOREFRONT_DOMAIN" "www.${STOREFRONT_DOMAIN}" "$API_DOMAIN"; do
  if ! getent hosts "$name" >/dev/null 2>&1; then
    echo "  ✗ ${name} does not resolve. Add the A record first." >&2
    exit 1
  fi
  echo "  ✓ ${name}"
done

echo "→ making sure the volumes exist"
$COMPOSE create --profile proxy proxy >/dev/null

# nginx must not be holding :80 while certbot's standalone plugin uses it.
$COMPOSE --profile proxy stop proxy >/dev/null 2>&1 || true

echo "→ requesting certificates (standalone on :80)"
for name in "$STOREFRONT_DOMAIN" "www.${STOREFRONT_DOMAIN}" "$API_DOMAIN"; do
  docker run --rm \
    -p 80:80 \
    -v snehavrinda_letsencrypt:/etc/letsencrypt \
    certbot/certbot certonly \
      --standalone \
      --email "$EMAIL" --agree-tos --no-eff-email \
      --cert-name "$name" \
      -d "$name" \
      --non-interactive
  echo "  ✓ ${name}"
done

echo "→ starting nginx"
$COMPOSE --profile proxy up -d proxy
sleep 3

if docker exec snehavrinda-proxy nginx -t >/dev/null 2>&1; then
  docker exec snehavrinda-proxy nginx -s reload
  echo "  ✓ nginx is serving on :80 and :443"
else
  echo "  ✗ nginx config failed its own test — check 'docker logs snehavrinda-proxy'" >&2
  exit 1
fi

cat <<'NEXT'

Renewal: certificates last 90 days and this script is not a scheduler.
Add this to the host crontab (crontab -e), twice a day as Let's Encrypt advises:

  17 3,15 * * * cd /opt/snehavrinda && docker run --rm \
    -v snehavrinda_letsencrypt:/etc/letsencrypt \
    certbot/certbot renew --standalone --quiet \
    && docker exec snehavrinda-proxy nginx -s reload

NEXT
