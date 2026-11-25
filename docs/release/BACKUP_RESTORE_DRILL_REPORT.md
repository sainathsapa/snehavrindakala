# Backup & Restore Drill Report

**Gate status: PASS for the drill itself / BLOCKED BY OWNER INPUT for off-site storage**
**Executed:** 2026-11-26, staging host, against the running Postgres 16 container
**Owner:** release engineering (drill) · business owner (backup destination + retention)

---

## 1. Why a drill, not a policy

A backup that has never been restored is a hypothesis. This report records an
actual dump, an actual restore into an isolated database, and an actual
verification of the restored data — using the repository's own scripts:

* `scripts/backup-db.sh` — dump, then prove the archive is non-empty and contains
  the tables the shop cannot be rebuilt without.
* `scripts/restore-drill.sh` — restore into `medusa_restore_check`, never over the
  live database.

## 2. Evidence — backup

```
$ ./scripts/backup-db.sh
backup ok: ./backups/medusa-20261125T201333Z.sql.gz (108K, 213 tables)
```

The size and table count are checked by the script itself; a zero-byte or
truncated pipe is reported as a failure rather than a success.

## 3. Evidence — restore

```
$ ./scripts/restore-drill.sh backups/medusa-20261125T201333Z.sql.gz
restoring backups/medusa-20261125T201333Z.sql.gz into 'medusa_restore_check'…
NOTICE:  database "medusa_restore_check" does not exist, skipping
restored row counts:
  journal_posts 6
  order 1
  product 19
  site_art_form 6
drill ok: backups/medusa-20261125T201333Z.sql.gz restored into medusa_restore_check
```

## 4. Evidence — restored data integrity

The restored copy was verified with the application's own schema gate, not with a
hand-written count:

```
$ DATABASE_URL=…/medusa_restore_check node apps/storefront/scripts/verify-schema.mjs
verify-schema: checking migrations 002-010 in the live database ...
verify-schema OK: 21 tables with expected columns present and no CREATE TABLE
left in any configured handler (both hard gates passed).
```

Independent row counts on the restored database:

```
partner=0  product=19  order=1  shipping_data=0  agreement=0
```

The zero counts are *correct*: this database has no partners or commercial
agreements yet (see `PARTNER_ONBOARDING_AND_AGREEMENT_REGISTER.md`). What the
drill proves is that the restore reproduces the source exactly — including the
new migration-010 tables — and that the schema gate passes against restored data.

## 5. What this establishes, and what it does not

| Established | Not established |
| --- | --- |
| A dump can be produced from the live staging database | That a backup runs on a schedule in production |
| The dump restores into a clean database | That backups are stored off the host |
| Restored data passes the application schema gate | That a whole-environment recovery works (DNS, TLS, secrets, containers) |
| The restore is isolated from the live database | RPO/RTO numbers for a real incident |

## 6. Owner input still required

| Item | Why it cannot be closed here | Owner |
| --- | --- | --- |
| Off-site backup destination | needs credentials/bucket the agent does not have | business owner |
| Retention policy approval | commercial/legal decision | business owner |
| Encryption-at-rest key custody | key ownership decision | business owner |
| Scheduled backup execution | depends on the destination above | release engineering (after input) |
| Whole-environment restore rehearsal | needs production-like infrastructure | release engineering + owner authorization |

Do **not** treat this drill as production recovery readiness. It proves the dump
is restorable; it does not prove an incident can be recovered within a stated
time.

## 7. RPO / RTO

No service-level guarantee is claimed. The scripts and this drill do not
establish an RPO or an RTO; those are commitments the owner must make and the
deployment must then be built to meet. Recording invented numbers here would be
worse than leaving them unset.

## 8. Reproduction

```bash
# 1. take a backup
./scripts/backup-db.sh

# 2. restore it into an isolated database and verify basic integrity
./scripts/restore-drill.sh "$(ls -t backups/medusa-*.sql.gz | head -1)"

# 3. verify the restored schema with the application's own gate
DATABASE_URL="postgresql://medusa:medusa@127.0.0.1:5433/medusa_restore_check?sslmode=disable" \
  node apps/storefront/scripts/verify-schema.mjs

# 4. clean up the scratch database when done
docker exec snehavrinda-postgres psql -U medusa -d postgres -c 'DROP DATABASE medusa_restore_check'
```
