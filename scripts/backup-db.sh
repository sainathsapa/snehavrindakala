#!/usr/bin/env bash
#
# Dump the shop's database to a dated, gzipped file and prove the dump is real.
#
# `docs/DEPLOY.md` has always said to take backups. Nothing did, so the promise
# lived only in the documentation — the worst kind of backup policy, because it
# is believed right up until it is needed.
#
# A dump that is empty, truncated, or a zero-byte file from a failed pipe must
# not be reported as a success. This checks the archive decompresses and that it
# contains the tables the shop cannot be rebuilt without.
#
# Usage:
#   ./scripts/backup-db.sh                 # host, talks to the running container
#   BACKUP_DIR=/mnt/backups ./scripts/backup-db.sh
#
# Runs on the host or inside the compose `backup` service; both modes are
# detected rather than configured.

set -euo pipefail

CONTAINER="${PG_CONTAINER:-snehavrinda-postgres}"
DB="${POSTGRES_DB:-medusa}"
DB_USER="${POSTGRES_USER:-medusa}"
OUT_DIR="${BACKUP_DIR:-./backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
MIN_TABLES="${BACKUP_MIN_TABLES:-20}"

mkdir -p "$OUT_DIR"

# Container name is irrelevant when pg_dump is available locally and pointed at
# a real host (the compose `backup` service is a postgres image talking over the
# compose network, where PGHOST=postgres). A laptop often has a client pg_dump
# installed with no server behind it, so the container is tried first unless
# PGHOST says otherwise — picking the client binary blindly fails with "no such
# file or directory" for a socket nobody is listening on.
if [ -n "${PGHOST:-}" ] && command -v pg_dump >/dev/null 2>&1; then
  DUMP=(pg_dump --no-owner --no-privileges --clean --if-exists -U "$DB_USER" "$DB")
elif docker inspect "$CONTAINER" >/dev/null 2>&1; then
  DUMP=(docker exec "$CONTAINER" pg_dump --no-owner --no-privileges --clean --if-exists -U "$DB_USER" "$DB")
else
  DUMP=(pg_dump --no-owner --no-privileges --clean --if-exists -U "$DB_USER" "$DB")
fi

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
FILE="$OUT_DIR/${DB}-${STAMP}.sql.gz"
PARTIAL="${FILE}.partial"

cleanup_partial() { rm -f "$PARTIAL"; }
trap cleanup_partial EXIT

# Write to a partial name and rename only after the checks pass, so a failed run
# can never leave a file that looks like a usable backup.
"${DUMP[@]}" | gzip -9 > "$PARTIAL"

if ! gzip -t "$PARTIAL" 2>/dev/null; then
  echo "backup FAILED: archive is not valid gzip" >&2
  exit 1
fi

TABLES="$(gzip -dc "$PARTIAL" | grep -c '^CREATE TABLE' || true)"
if [ "${TABLES:-0}" -lt "$MIN_TABLES" ]; then
  echo "backup FAILED: found ${TABLES:-0} tables, expected at least $MIN_TABLES." >&2
  echo "The dump is on disk as $PARTIAL and has been left there for inspection." >&2
  trap - EXIT
  exit 1
fi

mv "$PARTIAL" "$FILE"
trap - EXIT

SIZE="$(du -h "$FILE" | cut -f1)"
echo "backup ok: $FILE (${SIZE}, ${TABLES} tables)"

# Retention. Prints what it removes rather than deleting silently — a backup
# script that quietly deletes files is one nobody trusts.
if [ "$RETENTION_DAYS" -gt 0 ]; then
  find "$OUT_DIR" -maxdepth 1 -name "${DB}-*.sql.gz" -type f -mtime +"$RETENTION_DAYS" -print -delete
fi
