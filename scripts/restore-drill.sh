#!/usr/bin/env bash
#
# Restore a dump into a *separate* database and check the result.
#
# A backup is a hypothesis until it has been restored. This is the drill: it
# never touches the live database, so it is safe to run on a working shop, and
# it refuses to proceed if the target already holds something that is not a
# scratch database.
#
# Usage:
#   ./scripts/restore-drill.sh backups/medusa-20260101T030000Z.sql.gz
#   ./scripts/restore-drill.sh --force backups/... # restore over `medusa` itself
#
# Restoring over the live database is a disaster-recovery step, not a routine
# one: it drops tables first. That is why it needs --force and why the default
# path goes to `medusa_restore_check`.

set -euo pipefail

FORCE=0
if [ "${1:-}" = "--force" ]; then
  FORCE=1
  shift
fi

FILE="${1:-}"
if [ -z "$FILE" ] || [ ! -f "$FILE" ]; then
  echo "usage: $0 [--force] <dump.sql.gz>" >&2
  exit 2
fi

CONTAINER="${PG_CONTAINER:-snehavrinda-postgres}"
DB="${POSTGRES_DB:-medusa}"
DB_USER="${POSTGRES_USER:-medusa}"
SCRATCH="${RESTORE_DB:-medusa_restore_check}"

if ! command -v gunzip >/dev/null 2>&1; then
  echo "gunzip is required" >&2
  exit 2
fi

if ! gzip -t "$FILE" 2>/dev/null; then
  echo "refusing to restore: $FILE is not valid gzip" >&2
  exit 1
fi

# Run psql either through the container or directly, matching backup-db.sh:
# a client binary with no server behind it fails on a socket nothing is
# listening on, so the container is preferred unless PGHOST says otherwise.
if [ -n "${PGHOST:-}" ] || ! docker inspect "$CONTAINER" >/dev/null 2>&1; then
  PSQL_MODE=direct
else
  PSQL_MODE=container
fi

run_psql() {
  local db="$1"
  shift
  if [ "$PSQL_MODE" = "direct" ]; then
    psql -v ON_ERROR_STOP=1 -U "$DB_USER" -d "$db" "$@"
  else
    docker exec -i "$CONTAINER" psql -v ON_ERROR_STOP=1 -U "$DB_USER" -d "$db" "$@"
  fi
}

TARGET="$SCRATCH"
if [ "$FORCE" -eq 1 ]; then
  TARGET="$DB"
  echo "WARNING: restoring over the live database '$DB'. This drops tables."
  printf 'Type the database name to continue: '
  read -r CONFIRM
  if [ "$CONFIRM" != "$DB" ]; then
    echo "aborted" >&2
    exit 1
  fi
fi

# The scratch-name guard applies to the target unconditionally, not only when
# it differs from the live database. Setting RESTORE_DB=$DB without --force is
# the likeliest way to delete the shop by accident (a copied command, a typo),
# and it must be refused rather than helpfully treated as a real restore.
case "$TARGET" in
  *_check|*_drill|*_restore) : ;;
  *)
    echo "refusing to drop '$TARGET': the drill target must end in _check, _drill or _restore (use --force for a real restore)" >&2
    exit 1
    ;;
esac

echo "restoring $FILE into '$TARGET'…"

if [ "$FORCE" -eq 0 ]; then
  # A drill target is disposable, so dropping and recreating it is the correct
  # way to make the run repeatable.
  run_psql postgres -c "DROP DATABASE IF EXISTS \"$TARGET\"" >/dev/null
  run_psql postgres -c "CREATE DATABASE \"$TARGET\"" >/dev/null
fi

gunzip -c "$FILE" | run_psql "$TARGET" >/dev/null

# The checks that matter: the shop's own tables came back, with rows in them.
COUNTS="$(run_psql "$TARGET" -t -A -F' ' -c "
  SELECT 'product', COUNT(*) FROM product
  UNION ALL SELECT 'order', COUNT(*) FROM \"order\"
  UNION ALL SELECT 'site_art_form', COUNT(*) FROM site_art_form
  UNION ALL SELECT 'journal_posts', COUNT(*) FROM journal_posts
  ORDER BY 1
")"

echo "restored row counts:"
echo "$COUNTS" | sed 's/^/  /'

PRODUCTS="$(echo "$COUNTS" | awk '$1=="product"{print $2}')"
if [ "${PRODUCTS:-0}" -eq 0 ]; then
  echo "drill FAILED: no products in the restored database" >&2
  exit 1
fi

echo "drill ok: $FILE restored into $TARGET"
if [ "$FORCE" -eq 0 ]; then
  echo "The scratch database can be dropped when you are done:"
  echo "  psql -U $DB_USER -d postgres -c 'DROP DATABASE $TARGET'"
fi
