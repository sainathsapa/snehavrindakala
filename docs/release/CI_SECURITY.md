# CI/CD security gates and production start-up validation

This document is the operator's companion to `.github/workflows/ci.yml`,
`.github/workflows/cd.yml`, `apps/storefront/scripts/audit-deps.mjs`,
`apps/storefront/scripts/secret-scan.mjs` and
`apps/storefront/lib/startup-validation.ts`.

## 1. What the gates are

| Gate | Where | Fails the build when | Notes |
| --- | --- | --- | --- |
| Secret scan | CI `secret-scan`; CD `verify` | Any potential secret in a tracked file | `node apps/storefront/scripts/secret-scan.mjs` |
| Dependency audit | CI `dependency-audit`; CD `verify` | An unexcepted high/critical advisory | `node apps/storefront/scripts/audit-deps.mjs` |
| Lint & typecheck | CI `lint-and-typecheck` | Lint or TypeScript error | Workspace-wide |
| Unit tests | CI `unit-tests` | Backend or storefront test failure | Backend + storefront, with Postgres/Redis services; storefront typecheck also runs here |
| Migration validation | CI `migration-validation` | `db/schema.sql` drift or a schema that will not apply | `pnpm --filter @snehavrinda-kala/storefront db:verify` |
| Build | CI `build` | Build error | Starts only after **all** gates above pass |
| E2E smoke | CI `e2e-smoke` | Playwright smoke failure | Starts only after build |
| Pre-deploy re-check | CD `verify` | Secret or audit gate failure on the exact revision being deployed | `deploy` depends on it; production additionally requires the GitHub environment approval |

`build` no longer contains `pnpm audit || true`. The audit is a real gate with
an explicit, auditable exception path (below).

### Secret scanner

`secret-scan.mjs` uses `git ls-files`, so untracked and ignored files (including
`node_modules` and `.next`) are never scanned. It detects AWS access-key IDs
(`AKIA`/`ASIA`), Razorpay `rzp_live_`/`rzp_test_` keys, PEM private-key headers
and hardcoded `password`/`secret`/`token`/`api_key` literals. It prints only
`path:line  rule-name` — **never the matched value** — and exits non-zero on any
finding.

Exclusions are narrow and deliberate: `.env.example`/`.env.sample` files,
binary files, comment-only lines, documentation placeholders (`example`,
`changeme`, `test`, …), and a line explicitly annotated `secret-scan: allow`.
Test fixtures under `tests/`, `e2e/` and `*.test.ts`/`*.spec.ts` are exempt from
the *generic* password/secret literal rules, because those files intentionally
hold fake credentials; AWS keys, Razorpay keys and private-key headers are
still scanned in every file including tests. An exclusion is never a reason to
keep a real credential in git; use the marker only for a verified false
positive and say why.

## 2. Severity policy

| Severity | Policy |
| --- | --- |
| Critical | Blocks CI and CD. No exception without owner approval and a concrete mitigation. |
| High | Blocks CI and CD by default. |
| Moderate / low / info | Reported in the summary, non-blocking. Tighten with `AUDIT_LEVEL=critical|high|moderate|low|info` (default `high`). |

Severity from the advisory feed is the starting point, not the final word:
reachability, exposure and compensating controls matter when an exception is
requested. Silently ignoring an advisory is never an option — the only
mechanism is the time-boxed exception below.

## 3. Exception process

1. **Fix first.** Upgrade or pin the dependency, or remove the code path.
2. If a fix genuinely is not available, the owner creates
   `apps/storefront/scripts/audit-exceptions.json` (optional; absent means
   *no* exceptions are granted). Format:

   ```json
   {
     "exceptions": [
       {
         "cve": "CVE-2024-12345",
         "expires": "2026-12-31",
         "justification": "Upstream fix pending; input is length-limited and escaped at the boundary",
         "approvedBy": "owner-name"
       }
     ]
   }
   ```

   - `cve` (or `id`): CVE or GHSA identifier. Optional `package` scopes the
     exception to one dependency.
   - `expires`: `YYYY-MM-DD`. Keep exceptions short-lived (90 days or less).
   - `justification`: at least 10 characters describing the actual mitigation.
   - `approvedBy`: a named human owner. Anonymous exceptions are rejected.

3. **Expired or malformed entries are ignored**, printed as a `note:` and do
   not suppress any finding. A stale allowlist therefore fails closed.
4. Renewal requires a fresh justification and expiry; do not just bump the
   date. Each expiry is a review deadline.
5. For secret-managed CI, the same JSON can be supplied inline via
   `AUDIT_EXCEPTIONS_JSON` or by path via `AUDIT_EXCEPTIONS_FILE`.

## 4. How to read the audit output

```
[audit-deps] advisories: high=1 moderate=3
[audit-deps] enforcing severity >= high
[audit-deps] exceptions: /…/audit-exceptions.json
[audit-deps]   note: exception[0] (CVE-2024-12345): expired 2026-01-01 — ignored
[audit-deps]   excepted: some-dep (ADVISORY-12345) under CVE-2024-12345 until 2026-12-31 — <justification> [approved by owner]
[audit-deps] FAIL — 1 unexcepted advisory/advisories:
  [critical] other-dep — Remote code execution (GHSA-…)
```

- `advisories:` is the raw severity count from `pnpm audit --json`.
- `note:` is a problem with the allowlist (ignored entry, bad JSON). Investigate
  it even when the gate passes.
- `excepted:` is an advisory covered by a valid, active exception. It names the
  CVE/GHSA, expiry, justification and approver so reviewers can see who accepted
  the risk.
- `FAIL — N unexcepted …` lists each blocking advisory as
  `[severity] package — title (CVE-…, GHSA-…)`. Upgrade the package or add a
  valid exception; then re-run.

To reproduce locally without changing CI state:

```
pnpm audit --json > /tmp/audit.json
node apps/storefront/scripts/audit-deps.mjs --input=/tmp/audit.json
```

A zero exit means the gate is satisfied; exit `1` means blocking advisories
remain; exit `2` means the report or its configuration could not be read (also
a failure).

## 5. Rotation plan — credentials leaked in `d8894ec` (BLOCKED BY OWNER INPUT)

Commit `d8894ec` ("feat: add Shiprocket shipping integration") committed a
Shiprocket account email and password as fallback literals in
`apps/storefront/lib/shipping/shiprocket.ts`. **The values are deliberately not
reproduced in this document or in any log.** The remediation branch has already
replaced the password fallback with an empty string, so the running code reads
only `process.env.SHIPROCKET_*` — but the values remain in git history and in
every clone or fork of that commit.

> **External rotation is the owner's action.** This repository, this agent and
> this CI pipeline cannot change credentials with a third-party provider. Do
> not treat the code fix or a passing secret scan as completion of rotation.

Owner steps, in order:

1. Sign in to the Shiprocket account and **change the account password now**.
2. Sign out / revoke all active sessions and API tokens for that account; issue
   fresh credentials if the integration uses token-based auth.
3. Update the new `SHIPROCKET_EMAIL` / `SHIPROCKET_PASSWORD` in the deployment
   secret store (AWS Secrets Manager/SSM or the server's protected `.env`).
   Never put them in `.env.example`, tests, chat, or CI output.
4. Restart or redeploy every consumer so the old value is no longer in use.
5. Purge the value from git history (`git filter-repo` or BFG), force-push with
   team coordination, and ask the host to purge cached views/forks where needed.
6. Review Shiprocket login/audit logs for unauthorised access in the exposure
   window, and check other secrets committed in the same period.
7. Record completion here. Until steps 1–4 are confirmed, the status is
   **BLOCKED BY OWNER INPUT**.

The secret scanner protects future commits; it cannot un-expose history.

## 6. Production start-up validation — Lead wiring note

`apps/storefront/lib/startup-validation.ts` exports:

- `validateProductionConfig(env)` → `{ ok, missing, warnings }`
- `assertProductionConfig(env)` → throws a safe, name-only message
- `BASELINE_KEYS`, `SESSION_SECRET_KEY` for documentation/tests

In `NODE_ENV=production` it requires a session secret (`COOKIE_SECRET` or
`JWT_SECRET`), `DATABASE_URL`, an admin pair (`ADMIN_EMAIL` + `ADMIN_PASSWORD`
or `MEDUSA_ADMIN_EMAIL` + `MEDUSA_ADMIN_PASSWORD`) and `STOREFRONT_BASE_URL`.
When a feature is enabled — explicitly with `FEATURE_RAZORPAY`,
`FEATURE_EMAIL`, `FEATURE_SHIPROCKET`, or implicitly by setting any of its
settings — it additionally requires that feature's credentials (Razorpay key,
secret and webhook secret; `FROM_EMAIL` plus SES keys or role; Shiprocket email
and password). Results contain **names only, never values**; outside production
the result is always `ok` with advisory warnings.

**Lead action:** this agent did not edit `app/layout.tsx`, `instrumentation.ts`
or any other agent's file. Call the helper once at bootstrap, before the server
accepts requests — for example in Next.js 15 `instrumentation.ts`:

```ts
import { assertProductionConfig } from "@/lib/startup-validation";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    assertProductionConfig(process.env);
  }
}
```

(The module only reads env vars, so it is Edge-safe if the Lead prefers a
different bootstrap point. The `NEXT_RUNTIME` guard merely avoids checking
twice.) Unit tests live in `tests/startup-validation.test.ts`.
