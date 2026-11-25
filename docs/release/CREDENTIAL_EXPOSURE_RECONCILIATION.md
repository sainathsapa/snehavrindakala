# Credential Exposure Reconciliation

**Gate status: FAIL — exposures confirmed, rotation OUTSTANDING (owner action)**
**Scan date:** 2026-11-26 · **Scanned:** every commit on every branch (`git log --all -p`)
**Owners:** AGENT 01 (reconciliation) · business owner + release engineering (rotation)
**Companion documents:** `CREDENTIAL_ROTATION_REGISTER.md` (per-credential status),
`DOCKER_SECRET_EXPOSURE_REPORT.md` (the image incident)

> No credential value appears in this document. Values were never printed to a
> terminal, a log, a commit, or a report. Findings are identified by rule,
> commit and file only.

---

## 1. Why this document exists

The image incident answered "what was in the container images". It did not
answer the adjacent question: **what credential-shaped values were ever
committed to git?** Removing a value from the working tree does not remove it
from history — every clone carries it, and `git log -p` retrieves it.

This is the reconciled, evidence-based inventory across both surfaces.

## 2. Method

```bash
node scripts/security/audit-history-exposure.mjs          # human summary
node scripts/security/audit-history-exposure.mjs --json   # machine-readable
```

The scanner streams `git log --all -p`, applies high-confidence credential
patterns **only to added lines** (a removed line is not a new exposure), and
groups findings by rule and commit. Generic `secret = …` matching was rejected
because it returns thousands of fixture hits and buries the real ones.

Rules applied: AWS access-key id, PEM private-key header, Razorpay key id,
GitHub/Slack/Google tokens, env-fallback credential literals, SCREAMING_CASE
credential constants assigned a literal, and DB URLs carrying a password.

## 3. Confirmed exposures by class

### 3.1 — Admin credentials committed as fallbacks (HIGH)

| Commit | File | Shape |
| --- | --- | --- |
| `99ca576b` | `scripts/seed-full.mjs`, `scripts/seed-auto.mjs` | `process.env.ADMIN_PASSWORD || "<literal>"` |
| `f2acf264` | `apps/storefront/lib/admin.ts` | `ADMIN_PASSWORD =` with a literal default |

A committed admin password is a working login for anyone who clones the
repository. It is exposed from the first push onward and cannot be un-exposed by
a later commit.

**Current state:** all three files now require the variable and fail loudly when
it is absent (`scripts/seed-*.mjs` were fixed in the previous mission;
`lib/admin.ts` reads `MEDUSA_ADMIN_PASSWORD || ADMIN_PASSWORD || ""` and has no
literal). The **history** still contains them.

**Required:** rotate `ADMIN_PASSWORD` / `MEDUSA_ADMIN_PASSWORD` and confirm the
old password no longer authenticates. Register item **R-04**.

### 3.2 — Shiprocket credentials as env fallbacks (HIGH)

| Commit | File | Shape |
| --- | --- | --- |
| `3975e315` | `apps/storefront/lib/shipping/shiprocket.ts` | `process.env.SHIPROCKET_*` with a literal fallback |

**Current state:** `lib/shipping/shiprocket.ts` reads credentials from the
environment only.

**Required:** rotate the Shiprocket password/API token (register item **R-08**,
new) and confirm the old credential is rejected by the provider.

### 3.3 — Development database URLs (LOW, and not a production credential)

| Commits | Files | Shape |
| --- | --- | --- |
| `c3441e78`, `c0f361d8`, `a33aa0e8`, `885dd6ff`, `6d3136e1`, `a670bf80`, `dd3e9ba6` | `lib/db.ts`, `lib/notifications.ts`, journal/returns routes, seed scripts | `postgresql://medusa:<pw>@localhost:5432/medusa` |

The credential is the local compose default (`medusa`/`medusa`), not a
production secret. It is still a working credential **for any environment that
uses the default compose file**, which is why the hardcoded fallbacks were
removed in the previous mission and are now assembled from parts with a
production fail-closed check.

**Required:** confirm that no deployed environment uses the default Postgres
password. If the production database ever ran with these defaults, rotate the
database credential (register item **R-09**). The Terraform module now injects a
full connection URL from Secrets Manager, so a default cannot be inherited there.

### 3.4 — Documentation false positive (NOT a credential)

| Commit | File | Shape |
| --- | --- | --- |
| `bd7bb555` | `docs/release/DOCKER_SECRET_EXPOSURE_REPORT.md` | the literal PEM header text, quoted while explaining a false positive |

This is prose, not key material. It has been reworded. Not a credential, no
rotation required — recorded so the reconciliation is complete and nobody later
"discovers" it and panics.

## 4. Reconciliation against the image incident

| Surface | Credential | Confirmed exposed | Rotated | Status |
| --- | --- | --- | --- | --- |
| Docker images (pre-fix) | `RAZORPAY_KEY_SECRET` | **yes** | no | R-01 OUTSTANDING |
| Docker images (pre-fix) | `JWT_SECRET` | **yes** | no | R-02 OUTSTANDING |
| Docker images (pre-fix) | `COOKIE_SECRET` | **yes** | no | R-03 OUTSTANDING |
| Docker images (pre-fix) | `ADMIN_PASSWORD` | **yes** | no | R-04 OUTSTANDING |
| Git history | `ADMIN_PASSWORD` / `MEDUSA_ADMIN_PASSWORD` | **yes** | no | R-04 (same fix) |
| Git history | `SHIPROCKET_PASSWORD` / `SHIPROCKET_API_TOKEN` | **yes** | no | R-08 OUTSTANDING |
| Git history + images | local DB default credential | **yes** (dev value) | n/a unless defaulted in prod | R-09 verify |
| Docker images | `RAZORPAY_WEBHOOK_SECRET` | **no** (field was empty) | — | R-05 closed (no value) |
| Docker images | `DATABASE_URL` real password | **no** (placeholder) | — | R-06 closed (no value) |
| Docker images | `SANITY_API_TOKEN`, SES keys, `SENTRY_DSN` | **no** (fields empty) | — | R-07 closed (no value) |
| Any surface | Razorpay key **id** (`rzp_*`) | yes — but a key id is published to the browser by design | — | not a secret |
| Any surface | PEM header in a release doc | prose only | — | not a secret |

## 5. What is verified, and what is not

**Verified here:**

* every credential-shaped value that was ever committed is enumerated by rule and
  commit, reproducibly (`audit-history-exposure.mjs`);
* the current tree contains none of them (`secret-scan.mjs` passes over 860
  tracked files);
* the current images contain none of them (layer scans pass for both images);
* the previously exposed fallbacks in `seed-*.mjs`, `db.ts`, `notifications.ts`
  and the returns route have been removed and cannot recur (a scanner rule now
  catches that exact shape, proven by the fix in the previous mission).

**Not verified — and not claimed:**

* that any credential has been **rotated or revoked**. No provider access exists
  in this environment. A registry entry closes only on observed rejection of the
  old value (`CREDENTIAL_ROTATION_REGISTER.md §1`).
* that no affected image or clone was copied or pushed by hand. Only the owner
  can confirm that (register item R-10).

## 6. Consequence for the release decision

The **Credential exposure** gate is **FAIL**, not "blocked": confirmed exposed
values remain valid until revoked. It cannot be closed by code, by CI, or by a
rebuild. It closes when the owner produces revocation evidence for R-01, R-02,
R-03, R-04 and R-08 (and confirms R-09/R-10).

## 7. Reproduction

```bash
# 1. what was ever committed (redacted, every branch)
node scripts/security/audit-history-exposure.mjs

# 2. what is committed right now
node apps/storefront/scripts/secret-scan.mjs

# 3. what is inside the current images, layer by layer
node scripts/security/scan-image-secrets.mjs --base=node:24-alpine \
  --image=snehavrinda-kala-storefront:latest --image=snehakala-backend:latest
```
