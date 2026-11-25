# CI Security Gate Report

**Owner:** AGENT 03 (CI/CD security gate)
**Verified by:** AGENT 04 (independent QA)
**Date:** 2026-11-26
**Workflows:** `.github/workflows/ci.yml`, `.github/workflows/cd.yml`

---

## 1. What the gate must guarantee

1. Secret scanning.
2. Dependency audit.
3. Exception validation.
4. TypeScript.
5. Backend tests.
6. Storefront tests.
7. Production builds.
8. Migration verification.
9. Docker image build.
10. Image secret scanning.

Plus the rules that make those meaningful:

* no `pnpm audit || true`;
* no silent scan failure — a scanner that cannot run fails the pipeline;
* no ignored critical/high advisory without an approved, expiring exception;
* runtime, development and build findings reported separately;
* both images checked independently;
* failure messages that say what to do next.

---

## 2. Job map

| # | Requirement | Job | Step(s) | Fails when |
| --- | --- | --- | --- | --- |
| 1 | Secret scanning | `secret-scan` | `apps/storefront/scripts/secret-scan.mjs` | a credential-shaped value is committed (prints `file:line` + rule, never the value) |
| 2 | Dependency audit | `dependency-audit` | `audit-deps.mjs --scope=prod`, `--scope=dev`, `--scope=all` | any high/critical advisory is unexcepted |
| 3 | Exception validation | `dependency-policy` + `dependency-audit` | `test-dependency-policy.mjs` (16 cases) + register dump/expiry check | the exception mechanism does not enforce itself, or a register entry is expired/malformed |
| 4 | TypeScript | `lint-and-typecheck`, `unit-tests` | `pnpm typecheck`, storefront `typecheck` | any type error |
| 5 | Backend tests | `unit-tests` | `pnpm --filter @snehavrinda-kala/backend test` | any failure |
| 6 | Storefront tests | `unit-tests` | `pnpm --filter @snehavrinda-kala/storefront test` | any failure |
| 7 | Production builds | `build` | `pnpm build` (Turbo, both apps) | build error |
| 8 | Migration verification | `migration-validation` | real Postgres, `db:verify` | schema drifts from migrations |
| 9 | Docker image build | `image-security` (matrix) | `docker build` per image, cold context | build fails, or needs a credential to succeed |
| 10 | Image secret scanning | `image-security` (matrix) | `scan-image-secrets.mjs`, filesystem check, image-env check | any credential in any layer, or a credential `ENV` in the image |

Additional gates added by this work:

| Job | Why |
| --- | --- |
| `build-context` | proves neither image can absorb a credential at build time (`.dockerignore`, build args, `ENV` defaults, `.env.example`) |
| `terraform-validate` | `terraform fmt -check` + `terraform validate`; the CD plan step previously could not have succeeded because the module never validated |

All security and quality jobs are `needs` of `build`, and `image-security` needs
`secret-scan` + `build-context`, so a security failure blocks the build and the
images. `e2e-smoke` needs `build`.

---

## 3. Why the exceptions gate is trustworthy

A policy that has never failed is indistinguishable from one that cannot fail.
`scripts/security/test-dependency-policy.mjs` runs the audit gate against a
synthetic advisory report and a series of crafted registers, asserting the exit
code for each. It is hermetic — no network, no lockfile dependency — so it is fast
and deterministic in CI.

Verified locally, 16/16:

```
PASS  no exceptions file → advisory fails the build
PASS  empty register → advisory fails the build
PASS  valid, narrowly scoped, in-window exception → passes
PASS  one valid exception does not cover a second unrelated advisory → fails
PASS  expired exception → ignored, advisory still fails
PASS  expiry on the approved day itself → fails as expired
PASS  window longer than 14 days → rejected
PASS  package version drift → exception no longer applies
PASS  dependency path drift → exception no longer applies
PASS  exception suppresses a different advisory → rejected for that advisory
PASS  package-level ignore without an advisory id → rejected
PASS  critical advisory without criticalAuthorized → rejected
PASS  missing reachability assessment → rejected
PASS  severity mismatch → rejected
PASS  register is not valid JSON → nothing suppressed
PASS  blanket wildcard id → rejected
```

The mapping from the mission's failure requirements to enforced behaviour:

| Requirement | Enforced by | Proven by |
| --- | --- | --- |
| CI fails if an exception is expired | `loadExceptions` marks it `EXPIRED` and grants nothing | cases 5, 6 |
| CI fails if a package version changes unexpectedly | `matchException` compares `installedVersion` to the version the audit reports | case 8 |
| CI fails if a different advisory is suppressed | id must match the finding's CVE/GHSA exactly | cases 11, 15, 16 |
| CI fails if the dependency path no longer matches | `dependencyPath` must appear in a reported path | case 9 |
| CI fails on a critical issue added without authorization | `criticalAuthorized: true` required for critical severity | case 13 |
| No blanket package-level ignores | id must be `CVE-*`/`GHSA-*`; package name alone is rejected | cases 11, 16 |
| `pnpm audit` genuinely fails the build | the script exits non-zero; CI does not mask it | cases 1–2 |

---

## 4. Runtime / development / build separation

One `pnpm audit` on the whole tree lets a clean runtime hide a vulnerable build
toolchain, or the reverse — exactly how the tinypool criticals survived in this
repository while attention was on the runtime tree.

CI therefore runs three gates, each of which must pass:

```yaml
- run: node apps/storefront/scripts/audit-deps.mjs --scope=prod   # runtime
- run: node apps/storefront/scripts/audit-deps.mjs --scope=dev    # test/lint toolchain
- run: node apps/storefront/scripts/audit-deps.mjs --scope=all    # build + transitive
```

Each prints its own `scope:` line, advisory counts and exception state, so the run
log shows which class of dependency produced a finding.

Current state: `prod` moderate=3, `dev` moderate=3, `all` moderate=4 — zero high or
critical in any scope. The four moderates are listed explicitly in
`DEPENDENCY_REMEDIATION_REPORT.md §6` and are below the agreed `high` enforcement
level; they are reported on every run, never filtered out.

---

## 5. Both images verified independently

`image-security` is a matrix with `fail-fast: false`:

```yaml
matrix:
  include:
    - { name: storefront, dockerfile: apps/storefront/Dockerfile, tag: snehavrinda-storefront:ci }
    - { name: backend,    dockerfile: apps/backend/Dockerfile,    tag: snehavrinda-backend:ci }
```

Each leg performs three independent checks:

1. **Layer scan** — `scan-image-secrets.mjs` enumerates every layer from
   `docker save` and streams file contents through the credential rules. This is
   the primary proof; a file removed by a later layer is still in the image.
2. **Filesystem check** — `find / -xdev -name ".env*"`. Recorded as *secondary*
   evidence only, because it can only see the final layer.
3. **Image environment check** — reads `Config.Env` and fails if any
   credential-shaped name is declared (allowlisting `NEXT_PUBLIC_*` public
   identifiers). This is what catches a reintroduced `ENV JWT_SECRET=""`.

The image-environment check was run against the pre-rebuild backend image and
correctly failed:

```
Image snehakala-backend:latest declares credential env vars: JWT_SECRET, COOKIE_SECRET,
RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET, SHIPROCKET_API_TOKEN, SHIPROCKET_PASSWORD, SANITY_API_TOKEN
Inject them at runtime and validate at startup instead.
exit=1
```

and passes against the rebuilt image (see `FINAL_SECURITY_VERIFICATION.md`).

Fail-fast is off on purpose: a storefront finding must not prevent the backend leg
from reporting.

### 5.1 How the layer scan avoids false positives without weakening

The scanner is path-attributed: each layer is extracted (vendored package trees
excluded), then every file is inspected individually so each hit names a path. A
pure byte-stream scan cannot tell a PEM in `node_modules` from a PEM in our own
config, and a gate that cries wolf gets disabled.

Three deliberate scoping decisions, each visible in the output:

1. **Vendored trees** (`node_modules`, `/usr/local/lib/node_modules`) are excluded
   from the failure signal; `--include-vendor` inspects them. Third-party test
   fixtures are not credentials of this application.
2. **Base-image layers** are attributed as inherited (`--base=node:24-alpine`, 4 of
   14 and 4 of 10 layers) and scanned by their own run. This is attribution, not
   suppression.
3. **Binary files** are skipped for content rules: a compiled object embedding a
   test key is not a usable credential.

Credential-shaped *filenames* are still checked everywhere, and a real token inside
`.npmrc` is caught by content rules (`_authToken`, `NPM_TOKEN`) rather than by the
filename alone.

---

## 6. Build-context gate, and proof it fails

`scripts/security/verify-build-context.mjs` checks the three ways a credential
enters an image — context, build args, `ENV` — plus `.env.example` hygiene.

Negative test (deliberately corrupted Dockerfile, then reverted):

```
[dockerfile] apps/backend/Dockerfile:101 declares ENV JWT_SECRET with an empty default —
             a container can start with an empty credential; inject it at runtime and validate at startup
[dockerfile] apps/backend/Dockerfile:102 copies the whole build context ("COPY . ."); copy explicit paths
[dockerfile] apps/backend/Dockerfile takes ARG RAZORPAY_KEY_SECRET — build arguments are recorded in
             image history and cannot carry a credential; use a BuildKit secret mount or runtime injection
exit code = 1   (clean tree: exit code = 0)
```

The historical regression it guards against is proven in
`DOCKER_SECRET_EXPOSURE_REPORT.md §4`: with the pre-fix `.dockerignore`, a real
`apps/storefront/.env` appeared inside the built image; with the current rules it
does not.

---

## 7. "Scanner could not run" is a failure, not a pass

Every security script in this repository exits **non-zero** when it cannot do its
job, and each has a distinct code for "could not run" versus "found something":

| Script | Clean | Finding | Could not run |
| --- | --- | --- | --- |
| `secret-scan.mjs` | 0 | 1 | — |
| `audit-deps.mjs` | 0 | 1 (unexcepted or invalid exception) | 2 (no/!JSON audit output) |
| `scan-image-secrets.mjs` | 0 | 1 | 2 (image absent, unreadable archive, unlistable layer) |
| `verify-build-context.mjs` | 0 | 1 | — |
| `test-dependency-policy.mjs` | 0 | 1 | — |

`scan-image-secrets.mjs` deliberately fails when the image is not present locally:

```
die(`image not found locally: ${ref} — build it before scanning`);
```

so a missing image can never be reported as a clean scan. Likewise
`audit-deps.mjs` treats empty `pnpm audit` output as a hard error rather than
"no vulnerabilities".

---

## 8. Actionability of failure output

Each gate prints the failing item, why it matters, and the next action:

* **Dependency** — `[high] package — title (GHSA-…)`, then the exact register
  fields required if an exception is the right answer.
* **Build context** — `[dockerfile] <file>:<line> <what is wrong>; <what to do instead>`.
* **Image scan** — `LAYER n/m (<digest>) HIT <rule> <path>`, plus the note that a
  hit is recoverable with `docker save` even if a later layer deleted the file.
* **Runtime secrets** — the failing variable names, the required length, and a
  pointer to `PRODUCTION_CONFIGURATION.md`.

No gate prints a secret value. A scanner that echoes a credential into CI logs is
another place the credential leaks.

---

## 9. CD gate

`cd.yml` re-runs the security gates against the exact revision being deployed,
because CI may have run on a different commit and an exception may have expired in
between:

```
verify: secret-scan → build-context → install → audit --scope=prod
                                                 audit --scope=dev
                                                 audit --scope=all
deploy: needs verify → terraform plan/apply (human approval on the environment)
```

Deploy remains manual (`workflow_dispatch`) with a required environment approval.

---

## 10. What CI cannot prove

A green pipeline says the artifacts are clean and the tree is free of known
high/critical advisories. It says nothing about:

* whether the exposed credentials were actually rotated (they were not — see
  `CREDENTIAL_ROTATION_REGISTER.md`);
* whether a real email can be delivered (SES unconfigured);
* whether GST treatment is correct for each transaction;
* whether production infrastructure and backup restore work;
* whether the skipped partner/payment/finance E2E scenarios behave in production.

Those remain owner blockers. Production status is **NO-GO** regardless of CI.
