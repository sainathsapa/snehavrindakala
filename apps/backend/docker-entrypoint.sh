#!/bin/sh
# Backend container entrypoint.
#
# WHY MIGRATIONS RUN HERE
#
# `medusa start` does not migrate. On a fresh machine the database is empty, so
# the first request hits missing tables and the admin UI shows an error that
# looks like an application bug rather than an unrun migration. Doing it here
# means `docker compose up -d` is the whole installation procedure.
#
# Every migration is recorded in the migrations table, so a restart on an
# already-migrated database is a no-op that takes a moment.
#
# WHY PROVISIONING RUNS HERE TOO
#
# One-time shop setup (admin user, INR region, sales channel, publishable key,
# shipping option, starter catalogue) used to be a separate one-shot `seed`
# container. It is now folded into this entrypoint after Medusa starts, so
# there is no extra container or image. The script is idempotent: it checks for
# every row before creating it, so later system updates and restarts keep all
# existing data rather than starting from fresh.
#
# This is safe for one container. A multi-replica deployment should move this to
# a dedicated release step instead (see infra/terraform).
set -e

if [ -z "${DATABASE_URL}" ]; then
  echo "[backend] DATABASE_URL is not set — cannot migrate. Check .env." >&2
  exit 1
fi

# Wait for Postgres. depends_on only guarantees the container is up; the health
# check narrows the window but does not close it (Postgres accepts connections a
# moment before it is ready to serve). `pg` is already a backend dependency, so
# this needs nothing extra in the image.
echo "[backend] waiting for the database…"
node -e '
const { Client } = require("pg");
const deadline = Date.now() + 120000;
(async () => {
  for (;;) {
    try {
      const client = new Client({ connectionString: process.env.DATABASE_URL });
      await client.connect();
      await client.query("SELECT 1");
      await client.end();
      console.log("[backend] database reachable");
      return;
    } catch (err) {
      if (Date.now() > deadline) {
        console.error("[backend] database unreachable:", err.message);
        process.exit(1);
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
})();
'

echo "[backend] applying migrations…"
./node_modules/.bin/medusa db:migrate

echo "[backend] syncing module links…"
# Adds/removes link tables for modules that were added or removed. Idempotent.
./node_modules/.bin/medusa db:sync-links || echo "[backend] link sync skipped (see log above)"

echo "[backend] starting Medusa…"
./node_modules/.bin/medusa start &
MEDUSA_PID=$!

# Docker stops PID 1 (this shell). Forward the signal so Medusa can shut down
# gracefully instead of being killed mid-request.
trap 'kill -TERM "$MEDUSA_PID" 2>/dev/null || true' TERM INT

echo "[backend] waiting for Medusa to answer /health…"
MEDUSA_PID="$MEDUSA_PID" node -e '
const pid = Number(process.env.MEDUSA_PID);
const deadline = Date.now() + 180000;
(async () => {
  for (;;) {
    try {
      const res = await fetch("http://127.0.0.1:9000/health", {
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        console.log("[backend] Medusa healthy");
        return;
      }
    } catch {
      // not listening yet
    }
    try {
      process.kill(pid, 0);
    } catch {
      console.error("[backend] Medusa exited before becoming healthy");
      process.exit(1);
    }
    if (Date.now() > deadline) {
      console.error("[backend] Medusa did not become healthy in time");
      process.exit(1);
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
})();
'

echo "[backend] provisioning shop (idempotent — existing data is kept)…"
# Loopback explicitly: the shared MEDUSA_BACKEND_URL may point at a public host
# that cannot be resolved from inside this container.
MEDUSA_BACKEND_URL="http://127.0.0.1:9000" node scripts/bootstrap-store.mjs

# Healthcheck gate: the storefront must not start before the publishable key
# exists. Written only after provisioning succeeds (set -e aborts on failure).
: > /tmp/store-provisioned

wait "$MEDUSA_PID"
