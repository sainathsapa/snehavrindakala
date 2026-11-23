# FINAL GO — Test evidence

All commands run from repo root on `remediation/final-go` unless noted. This file
is appended to after every integration. A test only counts as PASS when
independently re-run by AGENT 00 (or by A10 for the QA gate).

## Baseline — 2026-11-23 (Wave 0, measured on `remediation/production-readiness` @ `703492e`)

```
pnpm typecheck                             4/4 successful (turbo 2.11.10)
pnpm --filter @snehavrinda-kala/backend test    Test Files 7 passed; Tests 101 passed
pnpm --filter @snehavrinda-kala/storefront test Test Files 54 passed; Tests 519 passed | 4 skipped
```

Previous baseline was 620 passing; confirmed unchanged. Working tree was clean.

## Integration evidence

Full integration after the 51-agent merge on `remediation/final-go`. All commands
run from repo root. Results below are the measured runs recorded for this mission;
see the honesty note after the table for what they do and do not prove.

| # | Date | Command / suite | Result | Notes (HEAD/commit) |
|---|------|-----------------|--------|---------------------|
| 1 | 2026-11-23 | `pnpm typecheck` — baseline reference (Wave 0) | 4/4 successful | `703492e` (reproduced in the baseline section above) |
| 2 | 2026-11-23 | `pnpm typecheck` — post-merge integration | 4/4 successful | `83931c0`, branch `remediation/final-go`, pushed to origin |
| 3 | 2026-11-23 | `pnpm test` — backend `@snehavrinda-kala/backend` | 7 files / 101 passed | `83931c0` |
| 4 | 2026-11-23 | `pnpm test` — storefront `@snehavrinda-kala/storefront` | 105 files / 1367 passed + 4 skipped (1371) | `83931c0` |
| 5 | 2026-11-23 | `pnpm test` — TOTAL (backend + storefront) | 1468 passed + 4 skipped, 0 failures | `83931c0`; baseline 620 → 1468 passing |
| 6 | 2026-11-23 | Targeted affected suites: qa-auth-attacks, api-auth, deployment-env, reachability, qa-health-monitoring, startup-validation | 6 files / 81 tests passed | `83931c0` |
| 7 | 2026-11-23 | `node apps/storefront/scripts/secret-scan.mjs` | OK — no potential secrets in 817 tracked files | `83931c0` |

### Baseline-to-final delta

Passing tests went from **620 (baseline @ `703492e`) to 1468 (final @ `83931c0`)**,
a gain of **+848 passing**. Skipped tests remained unchanged at 4. Backend stayed
at 7 test files / 101 passed; storefront grew from 54 files / 519 passed to 105
files / 1367 passed. The baseline was not weakened.

### Honesty note

These are code-level / static / pure-model results and full `pnpm test` (Vitest)
results. They are **NOT live end-to-end (E2E) proof**. **No gate is PASS from these
results alone.** Only AGENT 00 marks gates PASS after independent review.

- **Agent-reported single-file counts** (quoted from the 51 agent reports, *not*
  independently re-run per agent, and already contained within the full `pnpm test`
  totals above — not added again): onboarding 10, auth 13, shipping 67, allocation
  22, finance commission 28, finance ledger 28, payments/refunds 28, migrations 9,
  CI 17; QA suites qa-cross-partner + qa-auth-attacks 38 (+1 skipped),
  qa-notification-delivery 15, qa-migration-recovery 12, among others. Counts are
  quoted only where reported; none are inferred for suites without a stated number.
- **E2E authored, not run.** The Playwright specs partner-marketplace,
  multi-partner-isolation, and payment-sandbox are authored but skipped (gated by
  `E2E_SANDBOX` plus credentials). A skipped test is **NOT verified and never a
  pass**; it contributes nothing to the totals above.
