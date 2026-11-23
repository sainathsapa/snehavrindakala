# Performance Plan — public-read smoke test (DRAFT)

**Status: DRAFT — live numbers are BLOCKED BY OWNER INPUT.** No live run was
performed; this document defines *what* to measure and *how*, and records the
decisions that still need the owner's sign-off.

This plan is paired with the dependency-free smoke script at
`apps/storefront/scripts/perf-smoke.mjs`. The script is intentionally small and
safe: it is a staging-only smoke test, not a load-test or a benchmark suite.

---

## 1. Goal

Catch gross public-read regressions (e.g. a slow catalogue query, a broken
search path, or a connection-pool exhaustion under modest concurrency) before
release, using a repeatable command that cannot accidentally harm production or
leak credentials.

It complements the shared-pool work in `apps/storefront/lib/db.ts`: the
storefront now reuses one Postgres pool instead of opening a connection per
request, which is exactly the failure mode ("too many clients already") a
concurrency smoke should help surface. The smoke applies only light, bounded
load — it is a canary, not a stress test.

## 2. Scope — what we measure

Three **public, unauthenticated GET** endpoints (no writes, no admin, no
partner, no checkout, no webhook or cron routes):

| Name | Path | Why |
|---|---|---|
| `home` | `/` | Landing page; broad server-rendered dependencies. |
| `catalogue` | `/shop` | Product listing; the DB/query-heavy read path. |
| `search` | `/api/store/search?q=art` | Public search API with a benign fixed query. |

Paths assume the `en` default locale with `localePrefix: "as-needed"`
(`i18n/routing.ts`); if staging is mounted under a sub-path, pass that path as
part of `BASE_URL` and the script preserves it.

### Metrics

- **p50 / p95 latency (ms)** per endpoint and overall, measured wall-clock from
  just before `fetch` until the response body is fully drained (not just time
  to first byte). p95 is computed by linear interpolation over sorted samples.
- **Error rate** = completed requests that failed / completed requests, where a
  failure is a network error, a per-request timeout, or an HTTP status outside
  `200–399`. Run-level deadline aborts are treated as *incomplete* and excluded
  from the error rate so a hard timeout does not manufacture failures.
- **Request count** per endpoint and overall (to confirm the run did work).

The script prints a human-readable table and a machine-readable JSON report.

## 3. Safety properties (by construction)

- **No secrets / no auth.** The script never reads credential env vars and
  never sends `Authorization` or `Cookie` headers — only a benign `User-Agent`
  and `Accept`. It refuses a `BASE_URL` containing embedded credentials, a
  query string, or a fragment, so tokens cannot be smuggled into the command.
- **Timeboxed and bounded.** Wall-clock duration (default 30s, hard cap 120s),
  per-request timeout (default 5s, cap 10s), concurrency (default 4, cap 8),
  and a total-request budget (default 80, cap 500). Values are clamped so a typo
  cannot turn the smoke into a load test.
- **Staging only by default.** A host that is loopback, a private range, or has
  a clear staging marker (`staging`, `stage`, `preview`, `dev`, `qa`, `test`,
  `sandbox`, `local`, `internal`, …) is allowed. Known production hostnames
  (e.g. `snehavrinda.in`) and any **unrecognised public hostname default-deny**:
  the script refuses to run unless the caller explicitly sets
  `ALLOW_PROD_PERF=1`. Even then it prints a loud warning. The flag is intended
  only for owner-approved diagnostics and is never set by CI or this plan.

## 4. How to run (once staging exists)

```bash
# From apps/storefront/
node scripts/perf-smoke.mjs http://localhost:3000
node scripts/perf-smoke.mjs https://staging.example.com

# Env form (equivalent)
BASE_URL=https://staging.example.com node scripts/perf-smoke.mjs

# Optional tuning (all clamped to the caps above)
PERF_CONCURRENCY=4 PERF_DURATION_MS=30000 PERF_TIMEOUT_MS=5000 \
PERF_MAX_REQUESTS=80 node scripts/perf-smoke.mjs https://staging.example.com

# Optional threshold enforcement (exit 1 on breach; report always printed)
PERF_MAX_ERROR_RATE=0.01 PERF_MAX_P95_MS=1500 \
node scripts/perf-smoke.mjs https://staging.example.com
```

It requires Node >= 20 (global `fetch`) and no package install. It does **not**
invoke `pnpm` and does not touch the workspace build/test graph.

To date, only syntax validation has been run (`node --check`). **No live
requests have been issued** — see §6.

## 5. Thresholds — PROPOSALS, pending owner agreement

These are starting suggestions for a healthy staging stack, **not committed
gates**. The owner must confirm target numbers (and whether to enforce them via
the `PERF_MAX_*` env vars) before they become release criteria.

| Metric | Proposed threshold | Status |
|---|---|---|
| `home` p95 | < 1500 ms | Proposed — needs owner sign-off |
| `catalogue` p95 | < 2000 ms | Proposed — needs owner sign-off |
| `search` p95 | < 1000 ms | Proposed — needs owner sign-off |
| Error rate (any endpoint, overall) | < 1% | Proposed — needs owner sign-off |
| Minimum samples per endpoint | >= 5 | Proposed — otherwise result is noise |

Notes for the owner:
- Numbers must be baselined against a *real* staging stack before they are
  meaningful; hardware, network and data volume materially affect them.
- Decide whether a breach blocks release or is advisory. By default the script
  is advisory (report only) and exits non-zero only when a `PERF_MAX_*` var is
  explicitly supplied.
- Decide the staging origin / hostname and confirm it matches the guard's
  staging classification so the script does not refuse it.

## 6. Blockers (BLOCKED BY OWNER INPUT)

- **No running staging stack.** Live latency/error numbers require a reachable
  staging deployment and an owner-approved `BASE_URL`. None was provided, and
  no live requests were made. This document therefore contains no measured
  figures — only the method.
- **Thresholds unconfirmed.** The §5 values are proposals; the owner must
  approve them before they are enforced or cited as release gates.
- **Staging host classification.** Confirm the staging hostname so the
  production guard recognises it as non-production (or provide explicit
  approval for any exception — the `ALLOW_PROD_PERF` path is *not* recommended).

Once these are resolved, run §4, attach the JSON report to the release evidence,
and record the agreed thresholds as the pass/fail criteria.
