#!/bin/sh
#
# Copy database dumps off this machine.
#
# A dump on the same disk as the database protects against a bad migration. It
# does not protect against the disk, the VM, or the account. `docs/BACKUPS.md`
# names that gap; this script is the hook so the gap has a place to be closed
# rather than a paragraph to be remembered.
#
# Usage:
#   BACKUP_OFFSITE_TARGET=s3://bucket/snehakala ./scripts/offsite-push.sh [dir]
#   BACKUP_OFFSITE_TARGET=user@host:/backups ./scripts/offsite-push.sh --require
#
# `dir` defaults to $BACKUP_DIR or ./backups. The target may be a local path, an
# `ssh host:path`, or an `s3://` URL when the AWS CLI is installed.
#
# Written in POSIX sh on purpose: the nightly job runs this file inside the
# postgres Alpine image (`sh /scripts/offsite-push.sh /backups`), which has
# busybox ash and no bash. A script that only works when run by hand is not a
# scheduled job.
#
# Deliberate behaviour:
#  - No target configured: print that nothing was copied, and exit 0. A backup
#    run must not fail because the off-site half is not set up yet — but it also
#    must not look like it succeeded, so the message says "not configured".
#  - `--require` turns the missing target into a failure (exit 1), for whoever
#    wants the nightly job to fail loudly once a target is supposed to exist.
#  - Verify gzip before copying. Shipping a truncated dump off-site is worse than
#    shipping nothing: it is the copy someone will trust after the disk is gone.
#  - Never delete anything at the destination. Pruning remote backups on the
#    operator's behalf is how a script turns one bad minute into lost history.
set -eu

REQUIRE=0
if [ "${1:-}" = "--require" ]; then
  REQUIRE=1
  shift
fi

SRC_DIR="${1:-${BACKUP_DIR:-./backups}}"
TARGET="${BACKUP_OFFSITE_TARGET:-}"

say() { printf '%s\n' "$*"; }
fail() {
  printf 'offsite: %s\n' "$*" >&2
  exit 1
}

[ -d "$SRC_DIR" ] || fail "no backup directory at $SRC_DIR — nothing to copy"

COUNT=0
for f in "$SRC_DIR"/*.sql.gz; do
  [ -e "$f" ] && COUNT=$((COUNT + 1))
done
[ "$COUNT" -gt 0 ] || fail "no .sql.gz dumps in $SRC_DIR — run scripts/backup-db.sh first"

if [ -z "$TARGET" ]; then
  if [ "$REQUIRE" -eq 1 ]; then
    fail "BACKUP_OFFSITE_TARGET is empty (--require). Dumps exist only on this machine."
  fi
  say "offsite: not configured — BACKUP_OFFSITE_TARGET is empty."
  say "         $COUNT dump(s) in $SRC_DIR remain on this machine only."
  say "         See docs/BACKUPS.md, 'Copy dumps off the machine'."
  exit 0
fi

for f in "$SRC_DIR"/*.sql.gz; do
  [ -e "$f" ] || continue
  gzip -t "$f" 2>/dev/null || fail "$f is not valid gzip — refusing to copy anything"
done

say "offsite: $COUNT dump(s) from $SRC_DIR → $TARGET"

case "$TARGET" in
  s3://*)
    command -v aws >/dev/null 2>&1 || fail "aws CLI not found; cannot copy to $TARGET"
    for f in "$SRC_DIR"/*.sql.gz; do
      [ -e "$f" ] || continue
      aws s3 cp --only-show-errors "$f" "${TARGET%/}/$(basename "$f")"
      say "  copied $(basename "$f")"
    done
    ;;
  *:*)
    command -v rsync >/dev/null 2>&1 || fail "rsync not found; cannot copy to $TARGET"
    rsync -a --ignore-existing --partial \
      --include='*.sql.gz' --exclude='*' \
      "$SRC_DIR"/ "$TARGET"/
    ;;
  *)
    # A local path (a mounted volume, another disk). `cp -n` never overwrites, so
    # a good copy is not replaced by a later truncated one.
    # Not created automatically: a typo would then copy a whole backup into an
    # unused directory and report success, which is the failure this script
    # exists to prevent.
    [ -d "$TARGET" ] || fail "local target $TARGET is not a directory — create it first"
    for f in "$SRC_DIR"/*.sql.gz; do
      [ -e "$f" ] || continue
      cp -n "$f" "$TARGET/$(basename "$f")" 2>/dev/null || true
    done
    ;;
esac

# Say what is there rather than trusting the exit code alone: a copy that silently
# wrote nothing is indistinguishable from success in a log line.
say "offsite: done. Verify with:"
case "$TARGET" in
  s3://*) say "  aws s3 ls ${TARGET%/}/" ;;
  *) say "  ls -l $TARGET" ;;
esac
