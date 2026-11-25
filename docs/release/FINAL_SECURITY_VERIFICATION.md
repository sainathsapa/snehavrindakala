# Final Security Verification

**Scope:** engineering security closure — Docker secret exposure, dependency gate, CI enforcement
**Verified by:** AGENT 04 (independent security QA), against the artifacts AGENTs 01–03 produced
**Date:** 2026-11-26
**Branch:** `security/closure-final` (continuation of `remediation/engineering-gap-closure` at `b042d79`)

---

## 1. Two verdicts, deliberately separate

| Question | Answer |
| --- | --- |
| Is the **engineering security closure** complete? | **Yes** — every acceptance criterion in §4 is met with evidence, except credential rotation, which is an owner action and is explicitly outstanding. |
| Is the platform **ready for production**? | **NO-GO.** Unchanged. |

A green security pipeline does not make this platform shippable. The blockers that
keep it at NO-GO are listed in §6 and none of them is a security-tooling problem —
they are business, legal, financial and infrastructure decisions that need a human,
plus the credential rotations that this incident requires.

No credential value appears in this document or in any artifact listed below.

---

## 2. What was verified, and how

Every row was re-run by QA; the commands are reproducible.

| # | Check | Command | Result |
| --- | --- | --- | --- |
| 1 | Storefront layer scan | `node scripts/security/scan-image-secrets.mjs --base=node:24-alpine snehavrinda-kala-storefront:latest` | **PASS** — clean, 14 layers (4 inherited from base) |
| 2 | Backend layer scan | `node scripts/security/scan-image-secrets.mjs --base=node:24-alpine snehakala-backend:latest` | **PASS** — clean, 10 layers (4 inherited from base) |
| 3 | No credential `ENV` in either image | `docker image inspect … {{json .Config.Env}}` | **PASS** — neither image declares one |
| 4 | No env file in either filesystem | `docker run --rm --entrypoint sh <image> -c 'find / -xdev -name ".env*"'` | **PASS** — none (secondary evidence only) |
| 5 | Build context cannot absorb a credential | `node scripts/security/verify-build-context.mjs` | **PASS** — 10 checks; negative test returns exit 1 |
| 6 | Committed-secret scan | `node apps/storefront/scripts/secret-scan.mjs` | **PASS** — 860 files |
| 7 | Dependency gate (runtime) | `audit-deps.mjs --scope=prod` | **PASS** — 0 high/critical |
| 8 | Dependency gate (dev) | `audit-deps.mjs --scope=dev` | **PASS** — 0 high/critical |
| 9 | Dependency gate (full tree) | `audit-deps.mjs --scope=all` | **PASS** — 0 high/critical, 0 exceptions |
| 10 | Exception policy enforces itself | `node scripts/security/test-dependency-policy.mjs` | **PASS** — 16/16 cases |
| 11 | TypeScript | `pnpm typecheck` | **PASS** — 4/4 tasks |
| 12 | Lint | `pnpm lint` | **PASS** — 0 errors (warnings only, all pre-existing) |
| 13 | Storefront tests | `pnpm --filter @snehavrinda-kala/storefront test` | **PASS** — 127 files, 1669 passed, 4 skipped |
| 14 | Backend tests | `pnpm --filter @snehavrinda-kala/backend test` | **PASS** — 7 files, 101 passed |
| 15 | Production build | `pnpm build` | **PASS** — both apps |
| 16 | Migration / schema verification | `db:verify` against live Postgres | **PASS** — 18 tables, no CREATE TABLE in handlers |
| 17 | Terraform format | `terraform fmt -check -recursive` | **PASS** |
| 18 | Terraform validate | `terraform validate` | **PASS** — first time this module has ever validated |
| 19 | Runtime credential gate (negative) | start backend image without `JWT_SECRET`/`COOKIE_SECRET` | **PASS** — refuses to start, exit 1, names the missing vars |
| 20 | Runtime credential gate (positive) | `docker logs snehavrinda-backend` | **PASS** — `DATABASE_URL`, `JWT_SECRET`, `COOKIE_SECRET`, `RAZORPAY_KEY_SECRET` present, values not logged |
| 21 | Stack actually serves | `curl` storefront `/`, backend `/health` | **PASS** — 200 / 200, both containers `healthy` |

### Artifacts verified

| Artifact | Image ID | Size |
| --- | --- | --- |
| `snehavrinda-kala-storefront:latest` | `caa9b4f67ae3` | 404 MB |
| `snehakala-backend:latest` | `4aaeb71906fa` | 2.16 GB |

Build method: BuildKit cache purged first, then `docker build --no-cache` for both
images, from a context containing no `.env` file. Both images therefore contain
only layers produced after the fix — there is no pre-fix layer to inherit.

---

## 3. Independence: what QA found wrong in the gates

Accepting the implementers' own "done" statements would have shipped five real
defects. Each was found by trying to make the gate fail.

| # | Defect found | Evidence | Fixed |
| --- | --- | --- | --- |
| 1 | **The secret scanner missed env-fallback credentials.** `process.env.ADMIN_PASSWORD \|\| "<real-looking value>"` did not match: the rule's negative lookbehind rejected the word `PASSWORD` inside `ADMIN_PASSWORD`. Two seed scripts carried committed admin credentials that the gate reported as clean. | scanner said `OK — no potential secrets` while `scripts/seed-full.mjs` and `scripts/seed-auto.mjs` held them | two new rules (`env-fallback-credential`, `credential-constant-literal`); both files now require env vars; scanner catches them |
| 2 | **The `.npmrc` override fix was inert.** `overrides=vitest@3.2.6 tinypool@2.1.2` was in `.npmrc`, which pnpm 12 does not read for overrides. The config looked fixed while both critical advisories stayed live. | `pnpm why tinypool` → `1.1.1` | overrides moved to `pnpm-workspace.yaml`; tinypool removed entirely by the vitest 4 upgrade |
| 3 | **The backend image's credential gate was in the wrong directory.** The build stage's `WORKDIR` made `COPY … ./scripts/security/…` land in `/app/apps/backend/scripts/security`, while the entrypoint calls `/app/scripts/security/…`. The container would have failed to start with `MODULE_NOT_FOUND`. | `docker run … ls /app/scripts` → `No such file or directory` | absolute destination in the Dockerfile; negative test now shows the gate running and exiting 1 |
| 4 | **Terraform had never validated.** `aws_ecs_service_deployment` and `aws_subnet_group` are not AWS provider resource types; `aws_ecs_service.load_balancers` should be `load_balancer`; the CloudFront distribution had no `viewer_certificate` and used `origin_access_control` in the wrong block; the ElastiCache group used a non-existent `replication_group_description`. The CD workflow's `terraform plan` could never have succeeded. | `terraform validate` → 8 errors | all fixed; `terraform validate` and `fmt -check` now pass and are gated in CI |
| 5 | **The CI migration job connected to the wrong port.** It used `localhost:5432`, but compose publishes Postgres on host `5433` (`127.0.0.1:${POSTGRES_HOST_PORT:-5433}:5432`). | `db:verify` → `ECONNREFUSED` on 5432, passes on 5433 | CI now uses `127.0.0.1:5433` |

A sixth finding was self-inflicted and caught by the scanner: the first version of
the exposure report reproduced the dev database URL as evidence, and that report is
copied into the storefront image (`COPY docs ./docs`). The scan flagged
`app/docs/release/DOCKER_SECRET_EXPOSURE_REPORT.md`. The literal is now redacted and
the scanner's URL rule ignores angle-bracket placeholders.

---

## 4. Acceptance criteria

| # | Criterion | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Both images rebuilt without embedded env credentials | **MET** | §2 rows 1–4 |
| 2 | Historical exposure investigated | **MET** | `DOCKER_SECRET_EXPOSURE_REPORT.md` — `.dockerignore` history, commit window, empirical reconstruction (§4 of that report) |
| 3 | Old images and caches handled | **MET** | cache purged before rebuild; rollback tags retained deliberately, with a deletion condition recorded |
| 4 | Every exposed credential has rotation/revocation evidence **or** an assigned owner blocker | **PARTIAL — correctly reported as outstanding** | 4 of 4 real credentials are `OUTSTANDING` in `CREDENTIAL_ROTATION_REGISTER.md` with owner; 3 credential groups closed as `NO-VALUE` |
| 5 | tinypool fixed or handled | **MET (fixed)** | vitest 4 upgrade; package absent from the tree |
| 6 | postcss fixed or handled | **MET (fixed)** | single 8.5.33 across the tree; builds pass |
| 7 | zod fixed or narrowly excepted | **MET (fixed)** | eslint upgrade removed the path; zod now 4.6.6 on an unrelated path; **0 exceptions** |
| 8 | CI enforces dependency vulnerability policy | **MET** | 3 scopes + 16-case self-test + register expiry check |
| 9 | CI enforces secret scanning | **MET** | `secret-scan` job; scanner gap closed |
| 10 | Both images pass independent secret checks | **MET** | matrix job with `fail-fast: false`; both clean |
| 11 | TypeScript passes | **MET** | row 11 |
| 12 | Backend tests pass | **MET** | row 14 — 101 passed, identical to baseline |
| 13 | Storefront tests pass | **MET** | row 13 — 1669 passed / 4 skipped, identical to baseline |
| 14 | Production builds pass | **MET** | row 15 |
| 15 | No previous regression introduced | **MET** | test counts identical to baseline; stack serves 200/200 |

**Criteria 1–3 and 5–15 are closed. Criterion 4 is open by design** — it cannot be
closed by engineering, because rotating a Razorpay key and invalidating live
sessions require the account owner.

---

## 5. Behaviour changes a reviewer must know about

These are intentional, and each is a security improvement, but they change runtime
behaviour.

1. **The backend container now refuses to start** when `DATABASE_URL`,
   `JWT_SECRET` or `COOKIE_SECRET` is missing or a known placeholder. Previously it
   started with empty secrets and signed tokens with a key an attacker knows.
   Consequence: any environment that relied on the empty `ENV` defaults will fail
   to boot — which is the point.
2. **The storefront fails closed** on a missing `DATABASE_URL` in production
   (`resolveDatabaseUrl()` throws) instead of silently connecting to `localhost`.
3. **`pnpm seed-full` / `pnpm seed:auto` now require `ADMIN_EMAIL` and
   `ADMIN_PASSWORD`.** They previously fell back to a committed credential.
4. **Tests are no longer shipped** inside the backend image (`apps/backend/tests`
   removed in the runtime stage).
5. **Terraform now passes `DATABASE_URL`, `RAZORPAY_KEY_SECRET` and
   `SHIPROCKET_API_TOKEN` as Secrets Manager references.** The task definition now
   needs `secretsmanager:GetSecretValue` on the **execution** role, which was
   previously attached only to the task role — so the existing `secrets` entries
   would never have resolved. Both roles now have it.
6. **`ENV` defaults for credentials removed** from the backend Dockerfile.

---

## 6. Remaining blockers — production stays NO-GO

These are outside engineering security and were not attempted.

| # | Blocker | Owner | Why it cannot be closed by code |
| --- | --- | --- | --- |
| 1 | **Rotate + revoke 4 exposed credentials** (`RAZORPAY_KEY_SECRET`, `JWT_SECRET`, `COOKIE_SECRET`, `ADMIN_PASSWORD`) | business owner + release engineering | needs provider dashboard access and a coordinated session-invalidation window |
| 2 | Confirm no affected image was pushed/exported by hand | business owner | only the owner knows |
| 3 | Delete `:rollback-pre-security-fix` image tags after the new images are verified in production | release engineering | must keep a rollback until then |
| 4 | **Email not configured or verified** (SES) | business owner | needs real AWS credentials and a delivered test email |
| 5 | **GSTIN, HSN/SAC and tax treatment not validated** | business owner + CA | statutory judgement, not a code change |
| 6 | **Refund policy and returns window not approved** | business owner | policy decision |
| 7 | **Real partner identities and agreements** | business owner | legal |
| 8 | **Skipped partner/payment/finance E2E scenarios not executed** | release engineering | requires production-like payment and partner fixtures |
| 9 | **Production infrastructure and backup restore not verified** | release engineering | requires the deployed environment |

### 6.1 Tax treatment — explicit caution

The seller's home state is configured as **Rajasthan**. That is **not** evidence
that any given transaction is correctly taxed as CGST + SGST. Correct treatment
depends on the registered supplier location, the place of supply, each party's GST
registration, and the circumstances of the transaction (intra-state vs inter-state,
B2B vs B2C, and whether an e-commerce operator obligation applies). It must be
validated against the actual registrations with CA approval before statutory
invoices are issued.

`lib/studio.ts` centralises the seller address, and invoice generation is already
gated on validated seller/GST configuration. **Do not issue statutory invoices
while mandatory business information is incomplete.**

---

## 7. How to re-verify from a clean checkout

```bash
# security gates
node apps/storefront/scripts/secret-scan.mjs
node scripts/security/verify-build-context.mjs
node scripts/security/test-dependency-policy.mjs
node apps/storefront/scripts/audit-deps.mjs --scope=prod
node apps/storefront/scripts/audit-deps.mjs --scope=dev
node apps/storefront/scripts/audit-deps.mjs --scope=all

# quality
pnpm typecheck && pnpm lint && pnpm build
pnpm --filter @snehavrinda-kala/backend test
pnpm --filter @snehavrinda-kala/storefront test

# images (from a context with no .env file)
docker build -f apps/storefront/Dockerfile -t snehavrinda-kala-storefront:verify .
docker build -f apps/backend/Dockerfile    -t snehakala-backend:verify .
node scripts/security/scan-image-secrets.mjs --base=node:24-alpine \
  --image=snehavrinda-kala-storefront:verify --image=snehakala-backend:verify

# infrastructure
(cd infra/terraform && terraform init -backend=false && terraform fmt -check -recursive && terraform validate)
```

---

## 8. Sign-off

* Engineering security closure: **complete**, with credential rotation tracked as
  an owner blocker rather than silently declared done.
* Dependency gate: **clean** — 0 high/critical, 0 exceptions, mechanism tested by
  deliberate violation.
* Container artifacts: **secret-free** by layer-level inspection, not by a
  filesystem check.
* Production readiness: **NO-GO** — see §6.
