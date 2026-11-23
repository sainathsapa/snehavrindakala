# Storefront migrations

The storefront database is managed by a real, checkpointed migration runner.
`db/schema.sql` is the **fresh-install baseline**; the files in this directory
(`002_*.sql`, `003_*.sql`, `004_*.sql`) are **additive migrations** applied after
the baseline. Every migration is applied at most once and recorded with a
checksum.

## How to run

From `apps/storefront`:

```bash
npm run db:migrate          # apply everything pending (uses $DATABASE_URL)
npm run db:migrate -- --dry-run   # report freshness + pending ids, write nothing
npm run db:migrate -- --verify    # check each file has a matching checkpoint
npm run db:verify           # verify tables/columns + no lazy CREATEs in handlers
```

The container entrypoint runs `node scripts/migrate.mjs` before the server
starts. A failure is a non-zero exit and the server is not started — a missing
table is a failed deploy, not a 500 a customer discovers.

Set `DATABASE_URL`. The runner logs only the variable **name**, migration ids
and redacted error text; it never prints the connection string or password.

## Fresh install vs upgrade

- **Fresh database** (no `schema_migrations` table): the runner creates the
  bookkeeping table and applies `db/schema.sql` **once**, then applies every
  migration in this directory in numeric filename order.
- **Existing database**: the bookkeeping table is left as-is and `schema.sql`
  is **not re-applied** (no re-seeding). Only migrations whose id is not yet in
  `schema_migrations` are applied.

All of this happens inside a single transaction under a Postgres advisory lock.
Concurrent containers serialise: the second one waits, sees the checkpoints and
does nothing. A mid-run error rolls the whole thing back.

A checkpoint row records `id` (filename without `.sql`), a sha256 `checksum` of
the exact SQL applied, and `applied_at`. `--verify` fails if a file is missing a
checkpoint, its checksum has drifted, or an unknown id is recorded.

## Adding a migration

1. Create `NNN_short_name.sql` with a number greater than the latest file.
2. Make it **additive and idempotent**: use `CREATE TABLE IF NOT EXISTS` /
   `CREATE INDEX IF NOT EXISTS`; if you must write DML, make it safe to re-run
   (`ON CONFLICT DO NOTHING`, etc.).
3. Never edit or renumber an already-applied file — its checksum is recorded.
   Add a new migration instead.
4. `db:verify` is the source-of-truth check that the new tables/columns landed
   and that no lazy handler-level `CREATE TABLE` was left behind.

## Rollback and forward-recovery policy

These migrations are **additive by design**: they create new tables and indexes
and do not alter or drop existing business data. There is no down-migration.

- **Recovery is forward.** To fix a bad migration, add a new, later-numbered
  migration that repairs the state (another `IF NOT EXISTS` CREATE, a corrective
  additive change). Do not edit the original file or its recorded checksum.
- **Rollback is a database restore**, not a down-script: restore from a backup
  taken before the deploy. This is deliberately the only rollback path because
  the migrations never delete data.
- A migration failure rolls back its own transaction automatically, so the
  database is left exactly as it was before the run.

## No data is deleted

No migration in this directory contains `DROP TABLE`, `DELETE FROM` or
`TRUNCATE` against a business table. `db/schema.sql` contains only
`CREATE ... IF NOT EXISTS` statements. The runner never removes rows, tables or
checkpoints; the only write to bookkeeping is an append of a new checkpoint.
`tests/migration-integrity.test.ts` enforces all of these invariants.
