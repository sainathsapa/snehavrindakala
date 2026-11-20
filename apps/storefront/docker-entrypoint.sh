#!/bin/sh
# Storefront container entrypoint.
#
# 1. Applies the storefront's own content schema (db/schema.sql). Without it the
#    journal, commission and admin tables are missing on a fresh database, and
#    the first page that reads them fails.
# 2. Resolves the Medusa publishable key + region from the backend, because they
#    are generated when the shop is first provisioned and cannot be baked in.
# 3. Starts the standalone Next.js server with those values in its environment.
#
# Step 2 is best effort on purpose: a storefront that starts and says the key is
# missing is far easier to diagnose than a container that refuses to boot.
set -e

node apps/storefront/scripts/migrate.mjs

node apps/storefront/scripts/runtime-env.mjs || true

RUNTIME_ENV="${RUNTIME_ENV_FILE:-/tmp/snehavrinda-runtime.env}"
if [ -f "$RUNTIME_ENV" ]; then
  set -a
  # shellcheck disable=SC1090
  . "$RUNTIME_ENV"
  set +a
fi

exec node apps/storefront/server.js
