# Credential Rotation Register

**Incident:** `docs/release/DOCKER_SECRET_EXPOSURE_REPORT.md`
**Owner of this register:** AGENT 00 (Lead Security Orchestrator) → release engineering
**Last updated:** 2026-11-26

> **This register records outstanding work. It does not claim work that was not
> done.** Every credential below that was embedded in a Docker image is marked
> `OUTSTANDING` with a named owner and a verification requirement. A credential
> becomes `CLOSED` only when there is evidence that the **old value no longer
> works** — not when a new value has been configured.
>
> No credential value may be pasted into this file, a commit, a ticket, or chat.
> Values are created directly in the approved secret store and injected at
> runtime.

---

## 1. Why a new value is not a rotation

Configuring a new secret while the old one still authenticates leaves an
attacker holding a working credential. The exposure window stays open.

Each entry therefore closes on **revocation evidence**, one of:

| Code | Evidence type | Example of acceptable proof |
| --- | --- | --- |
| `REVOKED` | the provider rejects the old value | a request signed with the old key returns 401 (log line, redacted) |
| `TERMINATED` | the old value is destroyed at the source | Razorpay dashboard shows the old key deleted; screenshot reference recorded |
| `INVALIDATED` | the old value can no longer verify anything | all sessions issued under the old secret fail validation |
| `NO-VALUE` | the field was empty in the exposed artifact | the classification in the exposure report; nothing to rotate |

---

## 2. Register

### R-01 — `RAZORPAY_KEY_SECRET`

| Field | Value |
| --- | --- |
| Exposure location | `/app/apps/storefront/.env` and `/app/apps/backend/.env` inside both pre-fix images |
| Exposure period | 2026-11-05 (Docker config commits `9bd3bcc` / `8e391b8`) → 2026-11-25 (`b042d79`) |
| Exposure scope | local image store + local BuildKit cache; no registry push found |
| Rotation method | Razorpay Dashboard → Account & Settings → API Keys → **Regenerate Key** (this replaces the pair; the new secret is shown once) |
| New value destination | AWS Secrets Manager `${env}/snehavrinda/razorpay/key_secret` (wired in `infra/terraform/secrets.tf`, consumed as a `secrets` entry — never an `environment` entry) |
| Owner | business owner (Razorpay account holder) |
| Revocation confirmation | required: `REVOKED` — old key secret rejected by a live API call |
| Verification evidence | one failed-at-401 request recorded with the old key (redacted), plus a successful order-create with the new key in the provider test mode |
| Status | **OUTSTANDING — owner blocker** |

Note: regenerating the Razorpay key also rotates `RAZORPAY_KEY_ID`. The key **id**
is not secret; update `NEXT_PUBLIC_RAZORPAY_KEY_ID` and the backend
`RAZORPAY_KEY_ID` at the same time so checkout does not fail.

### R-02 — `JWT_SECRET` (Medusa)

| Field | Value |
| --- | --- |
| Exposure location | both pre-fix images, `/app/apps/*/.env` |
| Exposure period | as above |
| Rotation method | generate a new 32-byte hex value directly into the secret store: `${env}/snehavrinda/jwt_secret` |
| Session invalidation plan | **this invalidates every Medusa admin and customer access token.** Sequence: (1) announce a short maintenance window; (2) publish the new value to Secrets Manager; (3) force a new ECS task deployment so no task runs with the old value; (4) confirm old tokens are rejected (`/admin/...` with an old token → 401); (5) require admin re-login; (6) confirm the storefront can no longer exchange an old customer token |
| Owner | release engineering |
| Revocation confirmation | required: `INVALIDATED` — a token minted before rotation returns 401 after |
| Verification evidence | one pre-rotation token rejected (redacted), one post-rotation login succeeding |
| Status | **OUTSTANDING — owner blocker** |

### R-03 — `COOKIE_SECRET`

| Field | Value |
| --- | --- |
| Exposure location | both pre-fix images |
| Exposure period | as above |
| Rotation method | generate a new value into `${env}/snehavrinda/cookie_secret` |
| Session invalidation plan | invalidates **storefront admin sessions and partner portal sessions** (`lib/session-secret.ts`, `lib/partner/session.ts` derive their HMAC from this). Partners must re-authenticate; partner reset links issued under the old secret stop working. Sequence mirrors R-02, and must be coordinated with R-02 so admins are not logged out twice |
| Owner | release engineering |
| Revocation confirmation | required: `INVALIDATED` — a cookie signed with the old secret fails `getAdminSessionSecret()` verification |
| Verification evidence | pre-rotation admin cookie rejected on `/admin`; post-rotation login succeeds |
| Status | **OUTSTANDING — owner blocker** |

### R-04 — `ADMIN_PASSWORD` / `MEDUSA_ADMIN_PASSWORD`

| Field | Value |
| --- | --- |
| Exposure location | both pre-fix images |
| Exposure period | as above |
| Rotation method | set a new password through the Medusa admin user update path (or `MEDUSA_ADMIN_PASSWORD` on a fresh provision); store in the secret store, not in `.env` |
| Session invalidation plan | existing admin sessions end with R-02/R-03; confirm the old password no longer authenticates |
| Owner | business owner |
| Revocation confirmation | required: `REVOKED` — login attempt with the old password fails |
| Verification evidence | failed old-password login; successful new-password login; password not present in any committed file |
| Status | **OUTSTANDING — owner blocker** |

### R-05 — `RAZORPAY_WEBHOOK_SECRET`

| Field | Value |
| --- | --- |
| Exposure location | key **name** only; the value was empty in the exposed `.env` files |
| Rotation method | not required for this incident |
| Owner | — |
| Revocation confirmation | `NO-VALUE` |
| Status | **CLOSED (no value exposed)** — but a production webhook secret must still be configured and verified before GO, tracked as a separate release blocker |

### R-06 — `DATABASE_URL` / database password

| Field | Value |
| --- | --- |
| Exposure location | key name plus a **placeholder** value; no real database password was in the exposed files |
| Rotation method | not required for this incident |
| Note | the same value is now injected as a `secrets` ARN (`aws_secretsmanager_secret.database_url`), not as a plaintext task-definition `environment` value |
| Owner | — |
| Revocation confirmation | `NO-VALUE` |
| Status | **CLOSED (no value exposed)** |

If the owner knows that the local `.env` ever held a real RDS password, this entry
must be reopened and rotated through RDS with a coordinated
`aws_db_instance` modification — **not** by editing the Terraform variable in a
commit.

### R-07 — `SANITY_API_TOKEN`, `AWS_SES_*`, `SHIPROCKET_*`, `SENTRY_DSN`, `CRON_SECRET`, `SHIPROCKET_WEBHOOK_TOKEN`

| Field | Value |
| --- | --- |
| Exposure location | key **names** only; all values were empty |
| Rotation method | not required for this incident |
| Owner | — |
| Revocation confirmation | `NO-VALUE` |
| Status | **CLOSED (no value exposed)** |

SES credentials still need to be configured and a real email delivered — that is a
production readiness blocker, unrelated to this incident.

---

## 3. Execution order (reduce the blast radius)

Each step invalidates sessions or keys, so they are sequenced to avoid two
lockouts at once and to keep checkout working throughout.

1. **R-01 Razorpay** first, in the provider's test mode, then regenerate the live
   pair. Checkout is the highest-value target and the only rotate that does not
   log anyone out.
2. **R-04 admin password**, while admins are already expecting a change.
3. **R-02 + R-03 together in one maintenance window.** They log out admins,
   customers and partners; splitting them means two outage windows for the same
   set of users. Publish both new values, then force one task deployment.
4. Announce re-login to partners *before* step 3, not after.
5. **Delete the tainted rollback images** (`:rollback-pre-security-fix`) only
   after the new images have served production without incident.

Verification after every step: the old value must fail. A step is not done until
that failure is observed and recorded.

---

## 4. Secret handling rules for whoever executes this

* Never paste a value into this repository, a commit, an issue, a PR comment, or
  chat — including "just so you can check it".
* Generate secrets directly into the destination: `openssl rand -hex 32` piped
  into the secret store, or the provider's own generator.
* Never pass a secret through a Docker build argument. Layer history is
  permanent.
* Never give a credential an `ENV` default in a Dockerfile; the startup gate
  (`scripts/security/verify-runtime-secrets.mjs`) exists to make a missing value
  fail loudly.
* Record evidence as a redacted reference (timestamp, endpoint, status code,
  dashboard location) — never the value itself.

---

## 5. Status summary

| ID | Credential | Classification | Status |
| --- | --- | --- | --- |
| R-01 | `RAZORPAY_KEY_SECRET` | plausibly real | **OUTSTANDING** |
| R-02 | `JWT_SECRET` | plausibly real | **OUTSTANDING** |
| R-03 | `COOKIE_SECRET` | plausibly real | **OUTSTANDING** |
| R-04 | `ADMIN_PASSWORD` | plausibly real | **OUTSTANDING** |
| R-05 | `RAZORPAY_WEBHOOK_SECRET` | empty | CLOSED (no value) |
| R-06 | `DATABASE_URL` | placeholder | CLOSED (no value) |
| R-07 | Sanity / SES / Shiprocket / Sentry / cron | empty | CLOSED (no value) |

**Rotation completion: 0 of 4 required rotations. Production readiness remains
NO-GO on that basis alone, independently of CI status.**

---

## 6. Addendum — historical (git) exposures added in the staging-qualification mission

The register above was derived from the **image** incident. A full `git log --all`
scan (see `CREDENTIAL_EXPOSURE_RECONCILIATION.md`) found additional committed
credential-shaped values. They are added here with the same closure rule: **only
observed rejection of the old value closes an entry.**

### R-08 — `SHIPROCKET_PASSWORD` / `SHIPROCKET_API_TOKEN`

| Field | Value |
| --- | --- |
| Exposure location | `apps/storefront/lib/shipping/shiprocket.ts` at commit `3975e315` — a literal fallback in `process.env.…` |
| Exposure period | from `3975e315` until the fallback was removed |
| Exposure scope | **git history** (any clone, `git log -p`); not present in current images (layer scans clean) |
| Current tree | clean — credentials read from environment only |
| Rotation method | Shiprocket dashboard → regenerate API token / change password; new value into the secret store (`infra/terraform/secrets.tf` already wires `SHIPROCKET_API_TOKEN` as a `secrets` ARN) |
| Owner | business owner |
| Revocation confirmation | required: `REVOKED` — a provider call with the old token returns an auth error |
| Verification evidence | redacted provider error for the old token + one successful authenticated call with the new one |
| Status | **OUTSTANDING — owner blocker** |

### R-09 — Local database default credential (`medusa` / `medusa`)

| Field | Value |
| --- | --- |
| Exposure location | hardcoded dev connection string in `lib/db.ts`, `lib/notifications.ts`, the account/returns route and several scripts, across many commits |
| Exposure period | entire history until the fallbacks were removed |
| Severity | **low by itself** — it is the local compose default, not a production secret |
| Condition that makes it critical | if any deployed environment ever ran with `POSTGRES_PASSWORD=medusa`, the value is a live production credential |
| Current tree | fallbacks removed; `resolveDatabaseUrl()` throws in production when `DATABASE_URL` is unset; Terraform injects a full URL from Secrets Manager |
| Owner | release engineering + business owner (confirm production never used the default) |
| Revocation confirmation | `NO-VALUE-IN-PROD` (config review) or `REVOKED` (rotate the RDS credential if it was ever the default) |
| Verification evidence | RDS parameter/secret review showing a non-default password, recorded redacted |
| Status | **OUTSTANDING — needs confirmation** |

### R-10 — Hand-copied artifacts

| Field | Value |
| --- | --- |
| Risk | the affected images/tags existed locally; only the owner knows whether one was `docker save`d, copied to another machine, or pushed to a registry by hand |
| Repository evidence | no `docker push`, no registry login, no registry-qualified tags, empty `~/.docker/config.json` `auths` (see `DOCKER_SECRET_EXPOSURE_REPORT.md §6`) |
| Owner | business owner |
| Revocation confirmation | written confirmation: "no affected image left this machine" — or, if one did, treat every credential in the register as compromised in that environment |
| Verification evidence | written statement recorded in the release tracker |
| Status | **OUTSTANDING — owner blocker** |

### R-11 — `RAZORPAY_KEY_ID` (context note, not a rotation item)

The Razorpay key **id** appears in image scans and history. A key id is published
to the browser by the checkout widget and is not a secret. Rotating the key pair
(R-01) changes it; no separate action is required. Recorded so a future reviewer
does not mistake it for an unremediated secret.

## 7. Where the register stands

| Rotation required | Closed | Outstanding |
| --- | --- | --- |
| 6 (`R-01`, `R-02`, `R-03`, `R-04`, `R-08`, `R-09`) | **0** | **6** |
| Confirmations required | — | `R-10` |

**No credential has been rotated in this mission.** No provider access, no
dashboard credentials and no authorization were available, and claiming otherwise
would be a fabrication. The engineering side of the incident — root cause,
remediation, prevention, reconciliation and tooling to verify revocation — is
complete; the revocation itself is an owner action with a named owner per row.
