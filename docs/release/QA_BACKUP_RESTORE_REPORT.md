# Scenario J — Migration & Recovery Readiness (QA report)

> Agent: A90 (QA) · Branch: `remediation/final-go` · Date: 2026-11-23
> Scope: static/migration-and-recovery readiness only. No live restore was attempted.

## Status

| Item | Status |
|---|---|
| Static migration + recovery checks | PASS — 12 tests, 1 file |
| Fresh-install migration apply on a real DB | NOT VERIFIED here (see isolated commands) |
| Live restore / real data recovery drill | **BLOCKED BY OWNER INPUT** (stack + backup destination) |

A thing is not done because code exists; it needs an independent re-run against a
real environment. This report records what was honestly proven here and exactly
what an owner must run to close the remaining gap.

## Files created

- `apps/storefront/tests/qa-migration-recovery.test.ts` — pure/static tests (no DB,
  no stack, no exec of live restore).
- `docs/release/QA_BACKUP_RESTORE_REPORT.md` — this report.

No other files were edited.

## What the tests assert (12 passing)

Run: `cd apps/storefront && npx vitest run tests/qa-migration-recovery.test.ts`
Result: `Test Files 1 passed (1); Tests 12 passed (12)`.

- `scripts/backup-db.sh` exists, is a bash script, and uses `pg_dump`.
- `scripts/restore-drill.sh` exists and references `backup-db.sh`.
- The drill defaults to the disposable target `medusa_restore_check`, contains no
  hard-coded `postgres://` URI or cloud DB host, guards the target with a
  `_check|_drill|_restore` suffix check, and requires explicit `--force` plus a
  typed confirmation to reach the live database.
- `docs/BACKUPS.md` documents the backup-then-drill order and that the drill never
  touches the live database.
- Migrations `002_partner_marketplace`, `003_marketplace_finance`,
  `004_payment_reconciliation` are the exact set present, are strictly numerically
  ordered, declare themselves additive, and use only `IF NOT EXISTS` DDL with no
  `DROP/DELETE/TRUNCATE/ALTER` statements.
- The fresh-install path is documented in `db/migrations/README.md`
  (`schema.sql` baseline, then ordered additive migrations, forward recovery,
  rollback = restore) and `db/schema.sql` exists with no data-destroying statement.

These are static invariants. They prove the recovery tooling is *wired and safe
by construction*; they do not prove a dump restores real rows.

## Exact commands an owner runs in an isolated environment

Run all of the following only against a throwaway/clone cluster — never production.
Use distinct throwaway databases for the migration check and the drill.

### A. Static gate (repeatable anywhere)

```bash
cd <repo>/apps/storefront
npx vitest run tests/qa-migration-recovery.test.ts
```

### B. Fresh-install migration apply (throwaway *storefront* database)

```bash
cd <repo>/apps/storefront
export DATABASE_URL='postgresql://<user>:<pw>@<isolated-host>:5432/medusa_j_check'
npm run db:migrate                 # schema.sql once, then 002/003/004 in numeric order
npm run db:migrate -- --dry-run    # expect: no pending migrations
npm run db:migrate -- --verify     # expect: every file has a matching checkpoint
npm run db:verify                  # tables/columns present; no lazy handler-level CREATEs
# Verify no business data was destroyed by the migration set:
# re-run B against a restored pre-deploy snapshot and diff row counts — they must be >= before.
```

Expected evidence: a `schema_migrations` table with exactly three checkpoint rows
(`002_…`, `003_…`, `004_…`), matching sha256 checksums, and a clean `db:verify`.

### C. Backup + restore drill (isolated copy of the *Medusa* database)

The drill counts `product` rows and fails if none exist, so it needs a populated
Medusa dump, not a bare storefront schema. Take the dump from an isolated clone.

```bash
cd <repo>
mkdir -p backups
POSTGRES_DB=medusa_j PGHOST=<isolated-host> PGPORT=5432 PGUSER=<user> \
  BACKUP_DIR=./backups ./scripts/backup-db.sh
# Expect "backup ok: … tables". Then restore into a scratch DB — the default
# target already ends in _check and must never be the live DB:
RESTORE_DB=medusa_j_check ./scripts/restore-drill.sh \
  backups/medusa_j-<timestamp>.sql.gz
# Expect "drill ok: … restored into medusa_j_check" with non-zero product rows.
# Clean up the scratch DB:
docker exec snehavrinda-postgres psql -U medusa -d postgres \
  -c 'DROP DATABASE IF EXISTS medusa_j_check'
```

`--force` must NOT be used in scenario J — it targets the live DB and drops tables.

## BLOCKED BY OWNER INPUT — live restore verification

A real restore of a production-format backup, against the real stack, cannot be
performed here and is **not claimed as PASS**. It is blocked on two owner inputs:

1. **Running stack** — a reachable Postgres (container/cluster) with `psql`/`pg_dump`
   available and the Medusa database present. None is available in this environment,
   so no backup was taken and no dump was restored.
2. **Backup destination + credentials** — `BACKUP_OFFSITE_TARGET` (rsync host or
   object-storage bucket) and its write credentials, plus `DATABASE_URL` / DB user
   for the isolated cluster. Without a configured destination there is no off-site
   copy to pull from and no proof a stored dump is restorable.

Until both are supplied and an owner independently re-runs sections B and C above,
live restore verification stays **BLOCKED BY OWNER INPUT** and the Database/E2E
gates must not be marked green on the strength of this static report.

## Notes / assumptions

- "Production URL by default" was interpreted as: no baked-in connection URI or
  cloud DB host, and a default restore target that is a disposable `_check` DB —
  all supply connection details via environment at run time.
- The migrations are additive and have no down-script; recovery is forward, and
  rollback is a restore from a pre-deploy backup. This is why a real restore drill
  is the remaining, owner-gated evidence.
- No live payments, emails, refunds, deploys, or data changes were performed.
