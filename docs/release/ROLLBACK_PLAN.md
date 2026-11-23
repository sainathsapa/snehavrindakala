# Rollback plan — SnehaVrinda Kala FINAL GO

> Owner: AGENT A85 (documentation). Branch: `remediation/final-go`. Date: 2026-11-23.
>
> Philosophy: **forward fix preferred.** Migrations are additive and
> backward-compatible; customer and business data are never destroyed. Reverting
> a bad release is a last resort, and **no destructive database action ever
> happens automatically** — not on deploy, not on restart, not in the entrypoint.

## 1. Guiding principles

- All 9 remediation commits are preserved; never rewrite history or revert
  working code to "undo" a release (`FINAL_GO_EXECUTION_PLAN.md` §2). Fix forward
  with a new commit unless the owner explicitly authorizes otherwise.
- Migrations are additive (`db:migrate`, `db:sync-links` in
  `apps/backend/docker-entrypoint.sh`). They add tables/columns; they do not
  drop or rewrite customer/order/partner data. A restart on a migrated DB is a
  no-op because migrations are recorded in the migrations table.
- **Destructive DB actions are operator-initiated only.** The only path that
  drops tables is `scripts/restore-drill.sh --force`, and it requires typing the
  database name to proceed. The default drill path targets a scratch DB. There
  is no automatic down-migration, rollback script, or destructive step in
  `docker compose up`.

## 2. Before every deploy (backup gate)

Take a verified backup **and** prove it restorable before touching production:

```bash
./scripts/backup-db.sh                        # verified, dated dump in ./backups
./scripts/restore-drill.sh backups/medusa-<timestamp>.sql.gz   # into scratch DB
```

- `scripts/backup-db.sh` writes `backups/<db>-<UTC timestamp>.sql.gz` only after
  `gzip -t` passes and at least `BACKUP_MIN_TABLES` (default 20) `CREATE TABLE`
  statements are found. A failed run leaves a `.partial` file and exits non-zero.
- Keep a record of the exact git SHA / image tag being deployed so the artifact
  can be identified later. `backups/` is gitignored; media is a separate volume
  (`docs/BACKUPS.md`, `docs/DEPLOY.md`).
- Confirm an off-site copy exists if `BACKUP_OFFSITE_TARGET` is configured;
  otherwise note that dumps exist only on this machine.

## 3. Restore drill procedure (no impact on live)

Run monthly and after any change to Postgres, the schema, or the dump scripts
(`docs/BACKUPS.md`):

```bash
./scripts/backup-db.sh
./scripts/restore-drill.sh backups/medusa-<timestamp>.sql.gz
```

What the drill does (`scripts/restore-drill.sh`):

1. Refuses anything that is not valid gzip (`gzip -t`).
2. Drops and recreates **`medusa_restore_check`** (configurable via `RESTORE_DB`)
   — never the live `medusa` database. The target name guard requires it to end
   in `_check`, `_drill`, or `_restore`; otherwise the script refuses (this
   prevents `RESTORE_DB=$medusa` from deleting the shop by a copied command).
3. Restores the dump with `ON_ERROR_STOP=1`, so any SQL error fails the run.
4. Counts rows in `product`, `order`, `site_art_form`, `journal_posts` and fails
   if there are no products. Expected healthy tail:
   ```
   restored row counts:
     journal_posts 0
     order 1
     product 19
     site_art_form 6
   drill ok: … restored into medusa_restore_check
   ```
5. Leaves the scratch database for inspection; drop it when done:
   ```bash
   docker exec snehavrinda-postgres psql -U medusa -d postgres \
     -c 'DROP DATABASE IF EXISTS medusa_restore_check'
   ```

Note the gap: the nightly backup service checks dump **structure**, not
restorability, and there is no point-in-time recovery — worst case is a day of
orders. Media (`storefront_media` volume) is not in the dump; back it up
separately (command in `docs/BACKUPS.md`). A database restored without its media
is a shop with broken images.

## 4. What to do if a release is bad

1. **Stop the damage, do not delete data.** If a deploy is faulty, stop new
   writes to the affected surface (e.g. pause the `cron` reminder service, halt
   incoming webhook processing at the proxy if needed) and capture logs
   (`docker compose logs`) and the current git SHA.
2. **Prefer a forward fix.** Diagnose, apply a corrective commit, rebuild and
   redeploy (`git pull && docker compose build && docker compose up -d`, per
   `docs/DEPLOY.md`). Additive migrations mean the DB stays compatible: an older
   dump is brought forward by migrations on start. Reverting code to a prior
   commit is not the default and must not drop columns/data.
3. **Roll back the code artifact only if owner-authorized**, by redeploying the
   previously known-good image/SHA with `docker compose up -d`. Because
   migrations are additive, rolling back application code does not require a
   down-migration; do not delete newer columns/tables that later code expects.
4. **Database restore is disaster recovery, not a routine rollback.** Only if
   data itself is corrupted, and only with owner authorization:
   - Stop writers first: `docker compose stop backend storefront` (and cron).
   - Run `./scripts/restore-drill.sh --force <file>` — it drops tables in the
     target and requires typing the database name to confirm.
   - Restart: `docker compose start postgres backend storefront`. Medusa re-runs
     migrations on start (`apps/backend/docker-entrypoint.sh`), bringing an
     older dump forward.
   - Restore the `storefront_media` volume separately if images are affected.
   - Re-run health checks and the restore/smoke checks from
     `PRODUCTION_RUNBOOK.md` §2–§3.
5. **Verify and communicate.** Confirm payment/settlement state in the provider
   dashboards (Razorpay) rather than assuming DB state, record what happened and
   the decision in the release evidence, and keep `RELEASE_BLOCKERS.md` /
   `OWNER_INPUT_REQUIRED.md` honest about anything still unresolved.

## 5. Explicit guarantees

- No destructive DB action happens automatically. The only table-dropping path
  is the operator-run `restore-drill.sh --force` with an interactive database-name
  confirmation; the default drill is isolated in a scratch database.
- No automatic down-migration, data truncation, or history rewrite is performed
  by any deploy, restart, or script in this repository.
- A backup that has not been restored in a drill is a hypothesis, not a rollback
  plan — keep the monthly drill current.
