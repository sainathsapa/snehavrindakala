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
exec ./node_modules/.bin/medusa start
