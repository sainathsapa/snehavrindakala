#!/usr/bin/env bash
#
# Bring a fresh Ubuntu 22.04/24.04 box up to a working shop.
#
# What it does, in order: checks the machine can carry this stack, installs
# Docker, clones the repo, verifies .env is present and sane (it never prints a
# value), starts the stack, runs migrations, then runs the same three checks we
# verified locally. Safe to re-run: every step is idempotent and it refuses to
# touch an existing .env.
#
# Usage on the server, as a sudo-capable user:
#   curl -fsSL https://raw.githubusercontent.com/sainathsapa/snehavrindakala/main/deploy/bootstrap-vps.sh -o bootstrap.sh
#   bash bootstrap.sh
# or, already cloned:
#   bash deploy/bootstrap-vps.sh
#
# Then copy your .env into the repo root (scp) and re-run it. Nothing here
# writes secrets.

set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/sainathsapa/snehavrindakala.git}"
BRANCH="${BRANCH:-main}"
APP_DIR="${APP_DIR:-$HOME/snehavrindakala}"
MIN_MEM_MB=1800

say() { printf '\n== %s\n' "$1"; }
die() { printf '\n!! %s\n' "$1" >&2; exit 1; }

say "1/7 checking this machine"
mem_mb=$(awk '/MemTotal/ {printf "%d", $2/1024}' /proc/meminfo)
echo "   RAM: ${mem_mb} MB"
if [ "$mem_mb" -lt "$MIN_MEM_MB" ]; then
  die "Need at least ${MIN_MEM_MB} MB RAM (Medusa + Next + Postgres + Redis share this box). Resize the VPS and re-run."
fi
disk_gb=$(df -Pk / | awk 'NR==2 {printf "%d", $4/1024/1024}')
echo "   free disk: ${disk_gb} GB"
[ "$disk_gb" -ge 8 ] || die "Need at least 8 GB free disk for images, Postgres and backups."
if ! command -v curl >/dev/null; then die "curl is missing: apt-get install -y curl"; fi

if [ "$(id -u)" -eq 0 ]; then SUDO=""; else SUDO="sudo"; fi

# Medusa and Next both compile in this box; on a 2 GB instance the linker gets
# killed by the OOM reaper halfway through the storefront build. Swap costs
# nothing but disk and turns "build fails at 80%" into a slow success.
if [ "$mem_mb" -lt 3000 ] && ! swapon --show | grep -q '/swapfile'; then
  say "2a/7 adding 2 GB swap (RAM is ${mem_mb} MB, builds need headroom)"
  $SUDO fallocate -l 2G /swapfile || $SUDO dd if=/dev/zero of=/swapfile bs=1M count=2048
  $SUDO chmod 600 /swapfile
  $SUDO mkswap /swapfile >/dev/null
  $SUDO swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' | $SUDO tee -a /etc/fstab >/dev/null
  echo "   swap active: $(free -h | awk '/Swap/ {print $2}')"
  # Prefer RAM; swap here exists for build spikes, not steady-state paging.
  $SUDO sysctl -q vm.swappiness=10
  grep -q '^vm.swappiness' /etc/sysctl.conf || echo 'vm.swappiness=10' | $SUDO tee -a /etc/sysctl.conf >/dev/null
fi

say "2/7 installing Docker"
if command -v docker >/dev/null && docker compose version >/dev/null 2>&1; then
  echo "   already installed: $(docker --version)"
else
  $SUDO apt-get update -qq
  $SUDO apt-get install -y -qq ca-certificates curl gnupg git >/dev/null
  $SUDO install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg |
    $SUDO gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  $SUDO chmod a+r /etc/apt/keyrings/docker.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" |
    $SUDO tee /etc/apt/sources.list.d/docker.list >/dev/null
  $SUDO apt-get update -qq
  $SUDO apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin >/dev/null
  echo "   installed: $(docker --version)"
fi
$SUDO usermod -aG docker "$USER" 2>/dev/null || true
DOCKER="docker"
if ! docker info >/dev/null 2>&1; then DOCKER="$SUDO docker"; fi

say "3/7 fetching the code"
if [ -d "$APP_DIR/.git" ]; then
  echo "   reusing existing clone at $APP_DIR"
  git -C "$APP_DIR" fetch --quiet origin "$BRANCH"
  git -C "$APP_DIR" checkout --quiet "$BRANCH"
  git -C "$APP_DIR" pull --quiet --ff-only origin "$BRANCH"
else
  git clone --quiet --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
fi
git -C "$APP_DIR" log --oneline -1 | sed 's/^/   HEAD: /'

say "4/7 checking .env"
ENV_FILE="$APP_DIR/.env"
if [ ! -f "$ENV_FILE" ]; then
  cat <<EOF
   No .env at $ENV_FILE yet.

   From your laptop, copy the one that already works:
     scp .env $(whoami)@<this-host>:$ENV_FILE

   Then re-run this script. It never creates or echoes that file.
EOF
  exit 0
fi
chmod 600 "$ENV_FILE"
missing=()
for key in DATABASE_URL STOREFRONT_BASE_URL SHIPROCKET_EMAIL SHIPROCKET_PASSWORD \
           SHIPROCKET_WEBHOOK_TOKEN COOKIE_SECRET JWT_SECRET ADMIN_EMAIL ADMIN_PASSWORD; do
  grep -q "^${key}=.\+" "$ENV_FILE" || missing+=("$key")
done
if [ ${#missing[@]} -gt 0 ]; then
  die ".env is missing values for: ${missing[*]} (names only, values not shown)"
fi
echo "   required keys present"
grep -q '^STOREFRONT_BASE_URL=https://' "$ENV_FILE" ||
  die "STOREFRONT_BASE_URL must be an https origin, or production refuses to boot."

say "5/7 starting the stack"
cd "$APP_DIR"
$DOCKER compose up -d --build postgres redis backend storefront
# Owner accounts and launch content, so a fresh database is not a shop with no
# way into the panel and two empty sections behind the menu.
node scripts/seed-launch-content.mjs --docker || echo "   (seeding skipped)"

# The proxy is intentionally NOT started here: nginx refuses to boot without a
# certificate, and TLS comes after DNS. Run deploy/tls-init.sh, then:
#   docker compose --profile proxy up -d

# The public front door is nginx on 80/443, and it only starts once certificates
# exist — so TLS is provisioned before the proxy is brought up. This step needs
# the domain to resolve here already.
if [ -x ./deploy/tls-init.sh ]; then
  say "5b/7 requesting TLS certificates (needs DNS pointing here)"
  ./deploy/tls-init.sh "${LE_EMAIL:-hello@${STOREFRONT_DOMAIN#www.}}" || \
    printf '!! TLS not provisioned; run deploy/tls-init.sh once DNS points here\n' >&2
fi

say "6/7 waiting for Postgres, then running migrations"
for i in $(seq 1 60); do
  if $DOCKER compose exec -T postgres pg_isready -U postgres >/dev/null 2>&1; then break; fi
  sleep 2
  [ "$i" -eq 60 ] && die "Postgres never became ready - check: $DOCKER compose logs postgres"
done
echo "   Postgres ready"
$DOCKER compose run --rm backend pnpm migrations:run

say "7/7 verification"
base=$(grep '^STOREFRONT_BASE_URL=' "$ENV_FILE" | cut -d= -f2- | tr -d '"' | sed 's:/*$::')
token=$(grep '^SHIPROCKET_WEBHOOK_TOKEN=' "$ENV_FILE" | cut -d= -f2- | tr -d '"' | tr -d "'")
shop_domain=$(grep '^STOREFRONT_DOMAIN=' "$ENV_FILE" | cut -d= -f2- | tr -d '"')
api_domain=$(grep '^API_DOMAIN=' "$ENV_FILE" | cut -d= -f2- | tr -d '"')
[ -n "$shop_domain" ] && [ -n "$api_domain" ] ||
  die "STOREFRONT_DOMAIN and API_DOMAIN must both be set, or nginx asks for a certificate for example.com and the site never comes up."
echo "   shop: https://$shop_domain   api: https://$api_domain"
echo "   (TLS needs DNS pointed here first; a 000 below usually means DNS)"

shop_code=$(curl -s -o /dev/null -w '%{http_code}' "$base/" || true)
echo "   storefront  /                 HTTP ${shop_code}  (expect 200)"
api_code=$(curl -s -o /dev/null -w '%{http_code}' "https://$api_domain/health" || true)
echo "   medusa      /health           HTTP ${api_code}  (expect 200)"

no_key=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$base/api/webhooks/courier" \
  -H 'Content-Type: application/json' -d '{}' || true)
echo "   webhook, no token:        HTTP ${no_key}  (expect 401)"

with_key=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$base/api/webhooks/courier" \
  -H "x-api-key: ${token}" -H 'Content-Type: application/json' \
  -d '{"awb":"BOOTSTRAP1","current_status":"DELIVERED","order_id":"T-1"}' || true)
echo "   webhook, correct token:   HTTP ${with_key}  (expect 200)"

# ── Backups, on a timer ──────────────────────────────────────────────────────
# scripts/backup-db.sh has always existed and nothing ever ran it. A backup that
# depends on somebody remembering is not a backup; it is an intention. The dump
# verifies itself (it checks the archive decompresses and carries the tables the
# shop cannot be rebuilt without), so a failure is visible in the log rather
# than discovered on the day it is needed.
if command -v crontab >/dev/null 2>&1; then
  CRON_LINE="15 2 * * * cd $ROOT && bash scripts/backup-db.sh >> /var/log/snehavrinda-backup.log 2>&1"
  # The two keepers of a customer relationship that nothing ever ran: a cart left
  # behind, and a work saved to a wishlist whose price has moved. Hourly for the
  # cart (the reminder is timed in hours) and daily for prices (they move rarely
  # and a slow mail is better than a noisy one).
  CART_LINE="20 * * * * cd $ROOT && node scripts/abandoned-cart-sequence.mjs >> /var/log/snehavrinda-carts.log 2>&1"
  WISH_LINE="40 6 * * * cd $ROOT && node scripts/wishlist-price-drop.mjs >> /var/log/snehavrinda-wishlist.log 2>&1"
  ( crontab -l 2>/dev/null \
      | grep -v "backup-db.sh" \
      | grep -v "abandoned-cart-sequence" \
      | grep -v "wishlist-price-drop" \
      ; echo "$CRON_LINE"; echo "$CART_LINE"; echo "$WISH_LINE" ) | crontab -
  echo "   nightly backup (02:15), hourly cart reminders, daily price-drop checks"
fi

say "done"
cat <<EOF
Live at: $base

Still to do by hand:
  1. Point DNS at this box: A record $shop_domain -> <this IP>, and
     $api_domain -> same IP. Run deploy/tls-init.sh to obtain the two certificates
     once both resolve.
  2. Shiprocket dashboard -> Settings -> Webhooks:
       URL   $base/api/webhooks/courier
       Type  x-api-key
       Token (from SHIPROCKET_WEBHOOK_TOKEN in .env)
     Then toggle the connection to ENABLED.
  3. Backups, before the first order:
       docker compose --profile ops up -d backup
       bash scripts/restore-drill.sh
     and enable Lightsail automatic snapshots (instance -> Snapshots).

     A nightly verified dump is installed by this script (root crontab, 02:15
     IST). It is only half the job: a dump nobody has restored is a rumour.
     Run the drill once, now, and note the date in docs/BACKUPS.md.
  4. Razorpay is still in test mode (rzp_test_...). Swap in live keys before
     taking money: RAZORPAY_KEY_ID, NEXT_PUBLIC_RAZORPAY_KEY_ID,
     RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET, then rebuild the storefront
     (the public key is baked in at build time).
EOF
