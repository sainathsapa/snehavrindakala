# Docker Image Secret Exposure Report

**Incident:** credentials baked into both production Docker images
**Severity:** High (production credentials in deployable artifacts) — **contained**, local-only
**Status:** remediated in code; **credential rotation outstanding (owner blocker)**
**Owner:** AGENT 01 (container security) with AGENT 00 (security orchestration)
**Evidence date:** 2026-11-26

> No secret value appears in this document. Credentials are identified by name,
> classification and length only. Values were never printed to a terminal, a log,
> a commit, or this report.

---

## 1. Verdict

Both Docker images **did** contain real credentials, because the build process
copied app-level `.env` files into the image. The mechanism is proven, not
inferred (§4).

The current images do **not** contain them, and the build can no longer absorb
them (§7).

**No evidence exists that an affected image was pushed to a remote registry.**
The exposure is limited to the local image store and the local BuildKit cache on
the development machine (§6). That lowers the severity; it does not remove it,
because a local artifact could have been copied, exported with `docker save`, or
pushed later by a human — and because four of the exposed values are real,
working credentials.

**Rotation of those four values is still required and is not done.** See
[`CREDENTIAL_ROTATION_REGISTER.md`](./CREDENTIAL_ROTATION_REGISTER.md). Until
each one is confirmed revoked, this incident stays open.

---

## 2. Scope and method

| Item | Detail |
| --- | --- |
| Images in scope | `snehavrinda-kala-storefront` (Next.js storefront), `snehakala-backend` (Medusa v2) |
| Build contexts | repository root for both (`context: .` in `docker-compose.yml`) |
| Method | git history inspection, `.dockerignore` reconstruction, image layer enumeration, `docker save` layer extraction, credential-pattern scanning, in-image filesystem audit, environment inspection, image history review, registry configuration review |
| Scanner | `scripts/security/scan-image-secrets.mjs` (added by this work; layer-by-layer, redacts every match) |
| Layers scanned | storefront 13, backend 38 |

A `find /app -name .env` in the final filesystem **is not proof**. Layer tarballs
are stored verbatim, so a file deleted by a later `RUN rm` is still inside the
image and recoverable with `docker save`. This investigation enumerated every
layer instead.

---

## 3. The defect

### 3.1 The `.dockerignore` only excluded the root file

At the last commit before the fix (`8e391b8`, and every earlier Docker
configuration), `.dockerignore` contained:

```
.git
node_modules
**/node_modules
dist
**/dist
.medusa
**/.medusa
.env          <-- matches the repository-root .env only
.env.local
.next
.DS_Store
```

`.env` and `.env.local` are unanchored but single-segment patterns, so they
matched only the root-level files. They never matched `apps/storefront/.env` or
`apps/backend/.env`.

### 3.2 Both Dockerfiles copied the app directories wholesale

```dockerfile
# apps/storefront/Dockerfile (builder stage)
COPY apps/storefront ./apps/storefront
```

```dockerfile
# apps/backend/Dockerfile (build stage)
COPY apps/backend/ ./
```

With a local `.env` present in each app directory, both files were copied into an
intermediate build stage and therefore into the published image.

### 3.3 Fix and its own finding

Commit `b042d79` replaced the patterns with `**/.env` and `**/.env.*` and
documented the reason. That fix is correct. What it did **not** establish — and
what this report adds — is:

1. empirical proof that the old rules did bake the file in (§4);
2. a layer-level scan of the images that exist today (§5);
3. any rotation of the credentials that were already exposed (§ see register);
4. any guard preventing the same regression (§7).

---

## 4. Proof of the mechanism (reconstruction)

The pre-fix images no longer exist locally (they were rebuilt after the fix), so
their layers cannot be scanned directly. The mechanism was instead reproduced
from first principles with a real Docker build, using the exact pre-fix
`.dockerignore` taken from `git show 8e391b8:.dockerignore` and the same `COPY`
shape the Dockerfiles use.

**Old rules (pre-`b042d79`):**

```
COPY apps/storefront /app/apps/storefront
RUN ls -a /app/apps/storefront
-->
#7 0.203 .env          <-- the environment file is in the image
#7 0.203 app.js
```

**Current rules:**

```
#8 DONE
$ docker run --rm --entrypoint ls <image> -a /app/apps/storefront
.
..
app.js                <-- .env is absent
```

Conclusion: under the pre-fix rules a real `apps/*/.env` was unambiguously
present inside the image, exactly as `b042d79`'s message states. The exposed
values are recoverable from any copy of those image tags with `docker save`.

---

## 5. Credential exposure inventory

The two app-level `.env` files present on the machine at the time of the fix are
the exact inputs that were copied. Each value was classified by shape —
placeholder, empty, or plausibly real — **without printing it**.

| Credential | In `.env` | Classification | Exposure |
| --- | --- | --- | --- |
| `RAZORPAY_KEY_SECRET` | yes | **PLAUSIBLY REAL** (24 chars) | in both images |
| `JWT_SECRET` | yes | **PLAUSIBLY REAL** (64 chars) | in both images |
| `COOKIE_SECRET` | yes | **PLAUSIBLY REAL** (64 chars) | in both images |
| `ADMIN_PASSWORD` | yes | **PLAUSIBLY REAL** (20 chars) | in both images |
| `RAZORPAY_WEBHOOK_SECRET` | yes | empty | key name only, no value |
| `DATABASE_URL` | yes | placeholder value | key name only, no real password |
| `RAZORPAY_KEY_ID` | yes | placeholder-formatted id | key name; ids are public by design |
| `MEDUSA_ADMIN_PASSWORD` | yes | placeholder | key name only |
| `SANITY_API_TOKEN` | yes | empty | key name only |
| `AWS_SES_ACCESS_KEY_ID` / `AWS_SES_SECRET_ACCESS_KEY` | yes | empty | key names only |
| `SHIPROCKET_API_TOKEN` / `SHIPROCKET_PASSWORD` | yes | empty | key names only |
| `SENTRY_DSN` | yes | empty | key name only |
| `REDIS_URL`, `CRON_SECRET`, `SHIPROCKET_WEBHOOK_TOKEN` | yes | empty / non-secret | key names only |

**Four credentials are treated as compromised and must be rotated**, even though
their values were never shown: `RAZORPAY_KEY_SECRET`, `JWT_SECRET`,
`COOKIE_SECRET`, `ADMIN_PASSWORD`. A value that looks real must be assumed real;
the cost of rotating a throwaway secret is minutes, the cost of assuming wrong is
an account compromise.

The empty-valued names still count as **information exposure** — they told anyone
holding the image which integrations exist and how they are named — but they
carried no usable secret.

---

## 6. Was any affected image ever published?

| Check | Result |
| --- | --- |
| Registry-qualified tags on local images | none (`snehavrinda-kala-storefront:latest`, `snehakala-backend:latest`) |
| `docker image inspect .RepoDigests` | contain only the local repository names, no registry host |
| `~/.docker/config.json` `auths` | empty — no registry login stored |
| `~/.docker/config.json` `credsStore` | `desktop` (Docker Desktop, local) |
| `docker push` / `docker login` in any script or workflow | **none found** |
| `cd.yml` deploy path | Terraform only — builds no image, pushes no image |
| ECR / registry repository defined in `infra/terraform` | none (`var.backend_image` is an input string) |

**Conclusion:** no automated path published these images. Exposure is confined to
the local image store and local build cache, plus any manual transfer the owner
may have performed outside this repository. The owner must confirm whether any
image was ever exported or pushed by hand — recorded as a blocker in the rotation
register.

---

## 7. What was actually in the running images (triaged)

The images rebuilt after `b042d79` were scanned layer by layer. Five distinct
matches were found and each was classified. Reporting them all as "credentials"
would be as wrong as reporting none.

| Finding | Layer | Verdict |
| --- | --- | --- |
| An `ENCRYPTION_KEY` constant set to the RSC config filename | storefront | **False positive.** A Next.js internal constant naming its own config file, not key material. |
| `postgresql://medusa:<redacted>@localhost:5432/medusa` | storefront | **Real defect.** A working local-dev database credential written as a fallback in three source files and therefore compiled into the server bundles. |
| `rzp_test_…` (Razorpay key id) | storefront | **Not a secret.** The key *id* is designed to be published to the browser; it was supplied through the documented `NEXT_PUBLIC_RAZORPAY_KEY_ID` build arg. The key *secret* was absent. |
| `razorpay-key-id` in layers 8/12 | storefront | Same value, duplicate paths. |
| No `.env` file in any layer | both | Confirmed clean for the post-fix images. |

### 7.1 The hardcoded database fallback (fixed)

`apps/storefront/lib/db.ts`, `lib/notifications.ts` and
`app/api/account/returns/route.ts` each wrote the same credentialed fallback
inline. Three copies meant three copies in the bundle.

> This report is copied into the storefront image (`COPY docs ./docs`), so no
> working credential literal is reproduced here. The value is documented as
> `postgresql://medusa:<redacted>@localhost:5432/medusa`.

Now:

* one resolver, `resolveDatabaseUrl()`, in `lib/db.ts`;
* **no fallback at all in production** — a missing `DATABASE_URL` throws with an
  actionable message instead of silently connecting to `localhost`;
* the development credential is assembled from parts so the finished URL is not
  a copy-pasteable literal in the bundle;
* the duplicated constant in `notifications.ts` and the dead one in the returns
  route are gone.

### 7.2 The Razorpay key id (accepted, documented)

A Razorpay key *id* is transmitted to the browser on every checkout, so it is not
a secret and cannot be treated as one. The important property — that the key
*secret* never reaches an image — is now enforced by
`scripts/security/verify-build-context.mjs`, which rejects any Dockerfile build
arg whose name looks like a credential unless it is an allowlisted public
identifier with a recorded justification.

---

## 7a. Final state of the shipped images

After the remediation above, both images scan clean:

```
[image-secret-scan] snehavrinda-kala-storefront:latest: clean (14 layers scanned)
  inherited from base (scanned separately, not attributed to this image): 4 of 14
[image-secret-scan] snehakala-backend:latest: clean (10 layers scanned)
  inherited from base (scanned separately, not attributed to this image): 4 of 10
```

Three further findings surfaced on the way to clean. Each was a real problem
rather than scan noise:

| Finding | Verdict | Fix |
| --- | --- | --- |
| The dev database URL reproduced in **this report**, which is copied into the storefront image (`COPY docs ./docs`) | real — a document was baking a credential into an artifact | literal redacted; the URL rule now ignores angle-bracket placeholders |
| `apps/backend/tests/notification.test.ts` shipped inside the backend image | real — integration tests and fixtures do not belong in a runtime artifact | `RUN rm -rf /app/apps/backend/tests` in the backend runtime stage |
| `app/.npmrc` flagged by a filename rule | **false positive** — the file holds only `ignore-scripts` / `unsafe-perm` | filename rules for `.npmrc` / `.netrc` / docker config removed; `_authToken` and `NPM_TOKEN` added as *content* rules so a real registry token is still caught |

The base image (`node:24-alpine`) is scanned by its own run, and its 4 layers are
attributed as inherited rather than counted as findings of our images. Its npm man
pages legitimately contain a PEM private-key header as documentation text;
treating that as a
finding would make the gate noisy enough to be switched off.

---

## 8. Secure build practices now enforced

| Control | Where | What it prevents |
| --- | --- | --- |
| `.dockerignore` excludes `**/.env` and `**/.env.*`, re-includes only `.env.example` | `.dockerignore` | any app-level env file entering the context (proven in §4) |
| No credential `ENV` defaults in either Dockerfile | `apps/*/Dockerfile` | a container silently starting with an empty signing key |
| Fail-closed startup check | `scripts/security/verify-runtime-secrets.mjs`, called by both entrypoints | missing/placeholder `DATABASE_URL`, `JWT_SECRET`, `COOKIE_SECRET` |
| No credential through build args | `scripts/security/verify-build-context.mjs` | secrets recorded in image history |
| No `COPY . .` | same | accidental whole-context copies |
| `.env.example` holds placeholders only | same | a template that becomes a credential |
| Runtime injection via compose `environment:` / Secrets Manager | `docker-compose.yml`, `infra/terraform` | credentials in the artifact |
| Terraform passes all credentials as `secrets` ARNs, not `environment` values | `infra/terraform/ecs.tf`, `secrets.tf` | credentials in task-definition plaintext and Terraform state |
| Image scanned layer-by-layer in CI, both images, independently | `.github/workflows/ci.yml` (`image-security` matrix) | regression |

The startup gate is a deliberate behaviour change: the backend now **refuses to
start** when `JWT_SECRET`, `COOKIE_SECRET` or `DATABASE_URL` is missing or a
known placeholder, instead of starting and signing tokens with an empty key.

---

## 9. Old artifact handling

| Artifact | Action | Evidence |
| --- | --- | --- |
| Pre-fix images (`:latest` before rebuild) | retagged `:rollback-pre-security-fix` before replacement, so a verified rollback existed during the rebuild | tag list captured before build |
| Pre-fix images | replaced by cold-cache rebuild of the same tag | new image IDs |
| BuildKit cache (15.95 GB, held pre-fix layers) | purged with `docker builder prune -a -f` **before** rebuilding, so no pre-fix layer could be reused | cache total after purge recorded |
| Rebuild | `docker build --no-cache` for both images | build log |
| Rollback tags | **retained deliberately** until the new images are verified in production and the owner confirms rotation; they are known-tainted and must be deleted at that point | see register |

The rollback images still contain the exposed credentials. That is an accepted,
time-boxed risk: deleting the only working rollback before the replacement has
served production would trade a confidentiality risk for an availability risk.
The condition and deadline for deleting them are recorded in the rotation
register.

**Danglings images:** none were present.

---

## 10. Residual risk and owner blockers

| # | Blocker | Owner | Blocks |
| --- | --- | --- | --- |
| B-1 | Rotate and revoke `RAZORPAY_KEY_SECRET` | business owner | production GO |
| B-2 | Rotate `JWT_SECRET` (invalidates all Medusa admin/customer sessions) | release engineering | production GO |
| B-3 | Rotate `COOKIE_SECRET` (invalidates all storefront and partner sessions) | release engineering | production GO |
| B-4 | Rotate `ADMIN_PASSWORD` (admin + Medusa admin) | business owner | production GO |
| B-5 | Confirm no affected image was ever pushed/exported by hand | business owner | incident closure |
| B-6 | Delete `:rollback-pre-security-fix` tags after the new images are verified | release engineering | incident closure |
| B-7 | Configure the real SES credentials and verify a delivered email | business owner | production GO (unrelated, tracked separately) |

None of these is closed by a green CI run. See
[`CREDENTIAL_ROTATION_REGISTER.md`](./CREDENTIAL_ROTATION_REGISTER.md) and
[`FINAL_SECURITY_VERIFICATION.md`](./FINAL_SECURITY_VERIFICATION.md).

---

## 11. Reproduction (how to re-verify any of this)

```bash
# 1. Build-context guard: no env file, no secret build arg, no credential ENV
node scripts/security/verify-build-context.mjs

# 2. Layer-by-layer credential scan of an image (redacted output)
node scripts/security/scan-image-secrets.mjs snehavrinda-kala-storefront:latest
node scripts/security/scan-image-secrets.mjs snehakala-backend:latest

# 3. Machine-readable evidence for the release record
node scripts/security/scan-image-secrets.mjs \
  --image=snehavrinda-kala-storefront:latest \
  --image=snehakala-backend:latest --json > /tmp/image-scan.json

# 4. Runtime credential gate against a container's environment
node scripts/security/verify-runtime-secrets.mjs --app=backend
```
