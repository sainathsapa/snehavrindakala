# Backups and the restore drill

`docs/DEPLOY.md` used to say "take backups" and nothing took them. This is what
takes them, and how to prove they are worth having.

## What runs

| Where | What | When |
|---|---|---|
| `scripts/backup-db.sh` | one verified `pg_dump` of the shop database into `backups/` | on demand |
| compose service `backup` (`--profile ops`) | the same dump, then sleeps 24h | nightly |

Both write `backups/<database>-<UTC timestamp>.sql.gz`.

A dump is only renamed into place after it:

1. decompresses (`gzip -t`), and
2. contains at least `BACKUP_MIN_TABLES` (default 20) `CREATE TABLE` statements.

A failed run leaves a `.sql.partial` file and exits non-zero. That is deliberate:
a truncated or empty dump that looks like a backup is worse than no backup,
because it is trusted. Two failures worth knowing about:

- **`pg_dump: connection to server on socket … failed`** — a client `pg_dump` is
  installed but no server is listening locally. The script uses the container
  unless `PGHOST` is set; if you see this, `PGHOST` is pointing somewhere wrong.
- **`found 0 tables`** — the pipe produced nothing. Usually the container name is
  wrong (`PG_CONTAINER`) or the database is empty.

Retention: dumps older than `BACKUP_RETENTION_DAYS` (default 14) are deleted, and
the script prints each file it removes.

## Starting the nightly job

```bash
mkdir -p backups
docker compose --profile ops up -d backup
docker compose logs -f backup        # expect "backup ok: /backups/medusa-…sql.gz"
```

`backups/` is in `.gitignore`. The shop's data must never be committed.

**Copy dumps off the machine.** A dump on the same disk as the database is not a
backup against disk loss or a deleted VM. Point `BACKUP_DIR` at a mounted volume
and sync it (S3, rsync, restic) — that step is infrastructure, so it is named here
rather than pretended.

## The drill

A backup is a hypothesis until it has been restored. Run this monthly and after
any change to Postgres, the schema, or the dump scripts:

```bash
./scripts/backup-db.sh
./scripts/restore-drill.sh backups/medusa-<timestamp>.sql.gz
```

What the drill does:

1. Refuses anything that is not valid gzip.
2. Drops and recreates **`medusa_restore_check`**, never the live database.
3. Restores the dump with `ON_ERROR_STOP=1` — a SQL error fails the run.
4. Counts rows in `product`, `order`, `site_art_form`, `journal_posts` and fails if
   there are no products.

Expected last lines:

```
restored row counts:
  journal_posts 0
  order 1
  product 19
  site_art_form 6
drill ok: … restored into medusa_restore_check
```

Then drop the scratch database:

```bash
docker exec snehavrinda-postgres psql -U medusa -d postgres \
  -c 'DROP DATABASE IF EXISTS medusa_restore_check'
```

### Restoring for real

`./scripts/restore-drill.sh --force <file>` restores over the live database. It
recreates nothing, it only applies the dump, and the dump begins with `DROP
TABLE` — so it asks you to type the database name to continue. Stop the backend
and storefront first (`docker compose stop backend storefront`), restore, then
`docker compose start postgres backend storefront`. Medusa re-runs migrations on
start, so a dump from an older release is brought forward.

### Media is not in the dump

`storefront_media` (artist photographs, proof photos, product images) lives in a
Docker volume, not in Postgres. Back it up separately:

```bash
docker run --rm -v snehavrinda-kala_storefront_media:/data -v "$PWD/backups":/out \
  alpine tar czf /out/media-$(date -u +%Y%m%dT%H%M%SZ).tar.gz -C /data .
```

A database restored without its images is a shop with broken pictures; a restore
is not complete until the media volume is restored too.

## What is still not covered

- **No off-site copy** until the operator configures one (see above).
- **No point-in-time recovery.** These are logical dumps, so the worst case is a
  day of orders. Continuous WAL archiving is a managed-Postgres feature; if the
  shop outgrows nightly dumps, that is the step.
- **No automatic verification of the nightly file.** The service checks structure,
  not restorability. The monthly drill is the check.
