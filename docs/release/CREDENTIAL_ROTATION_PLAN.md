# Credential rotation plan — SnehaVrinda Kala FINAL GO

> Owner: AGENT A85 (documentation) — actions remain with the repository OWNER.
> Branch: `remediation/final-go`
> Date: 2026-11-23
> Status: **OPEN — EXTERNAL OWNER ACTION REQUIRED, NOT COMPLETE**

This document records how to deal with credentials that were committed in the
historical commit `d8894ec` ("feat: add Shiprocket shipping integration"). It is
deliberately written without any credential values. **This repository must not
contain the exposed values, and this document must not contain them either.**

## 1. What is known (and what is not)

- Historical report / `RELEASE_BLOCKERS.md` (SECRETS) and
  `OWNER_INPUT_REQUIRED.md` (Credential security) identify **two** credentials
  exposed in `d8894ec`: a **Shiprocket password** (hardcoded in
  `apps/storefront/lib/shipping/shiprocket.ts` at that commit) and a **Medusa
  admin password** (per the historical report).
- The working tree was cleaned in earlier remediation work: present-day source
  reads these values from environment variables (see `SHIPROCKET_PASSWORD`,
  `MEDUSA_ADMIN_PASSWORD` in `docker-compose.yml`). Cleaning the working tree
  **does not remove the values from git history** — `d8894ec` and every later
  commit still carry them.
- What this document does **not** know: the actual values, which accounts they
  belong to, whether they are still active, when they were last used, or whether
  the repository is/was public. Those are owner facts and must not be guessed.

> **Rotation is an EXTERNAL OWNER action. Adding a new env var, changing code, or
> committing a fix is NOT rotation. This item stays open until the owner confirms
> external revocation/rotation out of band (names only, never values).**

## 2. Revoke / rotate externally (owner)

Do these at the providers — not in this repository.

1. **Shiprocket account**
   - In the Shiprocket dashboard, rotate the password for the account whose
     credentials were committed. Prefer generating a new strong password and, if
     the dashboard supports it, invalidating active API sessions/tokens.
   - If API tokens are separate from the login password, revoke/rotate those too
     (the leaked password can be used to mint new tokens).
   - Update the deployment secret `SHIPROCKET_PASSWORD` (and any
     `SHIPROCKET_API_TOKEN` / `SHIPROCKET_EMAIL` as applicable) in the approved
     secret manager / `.env` — locally, gitignored, never in a tracked file.
   - Confirm the new value reaches the running backend **and** storefront
     containers (`docker-compose.yml` passes `SHIPROCKET_*` to both). Rebuild /
     restart so the provider re-reads it; the Shiprocket provider reads its
     credentials at construction.

2. **Medusa admin account**
   - In the running deployment, change the password for the affected Medusa
     admin user. Prefer invalidating other active sessions after the change.
   - Update `MEDUSA_ADMIN_PASSWORD` (and related admin secrets
     `ADMIN_PASSWORD`, `COOKIE_SECRET`, `JWT_SECRET`) in the secret manager /
     `.env`. Note `COOKIE_SECRET`/`JWT_SECRET` are required in production with no
     fallback (`apps/storefront/lib/startup-validation.ts`,
     `docker-compose.yml` `:?` interpolation).
   - Removing the default `ADMIN_PASSWORD=changeme-admin-password` from any
     deployed `.env` is part of this step (see `PRODUCTION_CONFIGURATION.md`).

3. **Verify no exposed credential is still active** — do this *without posting
   values*:
   - Attempt to sign in to Shiprocket using the old credential and confirm it is
     rejected; confirm only the new credential works.
   - Attempt to sign in to the Medusa admin (`/app` and the storefront `/admin`)
     with the old password and confirm rejection; rotate sessions if needed.
   - Review provider audit/login logs for use of the old credentials around and
     after the leak window; escalate to the owner if unexpected activity appears.
   - Confirm to the Lead **which** variables were rotated (names only) and that
     the old values no longer authenticate. Presence-only verification tooling
     exists and is safe to use: `GET /api/admin/config-status`
     (`apps/storefront/app/api/admin/config-status/route.ts`) and
     `validateProductionConfig` / `assertProductionConfig`
     (`apps/storefront/lib/startup-validation.ts`) report variable **presence**,
     never values — but note that *presence is not proof of rotation*.

## 3. Decide on git history rewrite (owner decision)

- Determine whether the repository is or was **public**, or was ever cloned /
  forked / mirrored with `d8894ec` in its history.
- The FINAL GO governing rule is to preserve all 9 remediation commits and never
  rewrite history (`FINAL_GO_EXECUTION_PLAN.md` §2). A history rewrite would
  conflict with that rule, so **do not rewrite without an explicit owner
  decision** that overrides it.
- If the repo was public or shared, a rewrite (e.g. `git filter-repo`) plus
  force-push and invalidation of forks/caches is the owner's call, coordinated
  with anyone holding a clone. Secrets must be considered compromised regardless;
  rotation (§2) is the control that actually protects the accounts, and it is
  required whether or not history is rewritten.
- Record the decision in `OWNER_INPUT_REQUIRED.md` / `RELEASE_BLOCKERS.md` with a
  date. If the decision is "no rewrite," state the rationale (e.g. private repo,
  single trusted clone) so it is auditable.

## 4. Definition of done

This item is **NOT COMPLETE** until the owner has, out of band:
1. Confirmed the Shiprocket password/tokens were revoked and rotated externally
   and the old credential no longer authenticates.
2. Confirmed the Medusa admin password was changed and old sessions are invalid.
3. Confirmed no exposed credential remains active (§2 verification).
4. Recorded the history-rewrite decision (§3).

Until then it remains `BLOCKED BY OWNER INPUT` in `RELEASE_BLOCKERS.md` and
`OWNER_INPUT_REQUIRED.md`, and no one may mark it PASS. No credential values are
recorded in this repository or in any report.
