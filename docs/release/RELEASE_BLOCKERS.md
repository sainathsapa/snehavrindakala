> **LATEST AUTHORITATIVE RELEASE DECISION:** `docs/release/FINAL_OWNER_INPUT_AND_STAGING_GO_REPORT.md`
> (branch `release/owner-input-staging-qualification`, 2026-11-26).
> This file is preserved as history. Where it disagrees with the report
> above, the report wins.

# Release blockers

Items that cannot be closed by code alone. None of these may be fabricated.

| ID | Blocker | Why it blocks | Owner action |
|---|---|---|---|
| GST-02 | Seller legal name, address, GSTIN, HSN/SAC, place-of-supply rules | Statutory invoice cannot be issued with missing mandatory fields | Owner + qualified CA to supply/verify; do not issue tax invoice until present |
| PAY-E2E | Razorpay sandbox key id, secret, webhook secret | Payment/webhook/refund lifecycle can only be *unit* tested; sandbox run required to flip `CHECKOUT_RAZORPAY_PROVIDER=1` | Owner supplies sandbox credentials; run one sandbox purchase (see DEPLOY.md) |
| EMAIL | Verified SES sender/domain + credentials, `FROM_EMAIL` | Email outbox intentionally no-ops without these | Owner verifies SES identity and sets env |
| SHIP | Shiprocket production credentials + webhook token | Status sync cannot be exercised live | Owner supplies creds; configure webhook |
| PART | Partner commission rates, payout/accounting/TDS rules, partner identities | Commission calculation, settlements and partner login need business rules | Owner + accountant to define; configurable fields must be supplied, not guessed |
| OWNER-DATA | Real product photos, measured dimensions, 1 product description, maker bio | Storefront content integrity | Owner (see PHOTO-AND-MEASUREMENT-BRIEF.md) |
| LEGAL | Grievance officer, legal identity, policy sign-off | Legal/policy pages require professional review | Owner + legal counsel |
| ANALYTICS | GA4 measurement id | GA4 events only fire when configured | Owner supplies id |
| SECRETS | Rotate leaked Shiprocket password + Medusa admin password (committed in `d8894ec`, still in git history) | Working tree cleanup did not remove from history | Owner rotates now; consider history rewrite if repo public |
| SECRETS-DOCKER | Rotate the four credentials baked into the pre-fix Docker images: `RAZORPAY_KEY_SECRET`, `JWT_SECRET`, `COOKIE_SECRET`, `ADMIN_PASSWORD` | The images are fixed (`docs/release/DOCKER_SECRET_EXPOSURE_REPORT.md`), but a rebuilt artifact does not revoke a leaked value | Owner + release engineering follow `docs/release/CREDENTIAL_ROTATION_REGISTER.md` (R-01 to R-04); each closes only on observed revocation, not on a new value being configured |
| SECRETS-COMMITTED | Committed admin email/password defaults removed from `scripts/seed-full.mjs` and `scripts/seed-auto.mjs` | Removed from the working tree, still present in git history; the CI secret scanner now rejects the pattern | Owner confirms whether those values were ever used for a real login, and rotates if so |
| SECRETS-HANDOFF | Confirm no affected image was exported or pushed by hand; then delete the `:rollback-pre-security-fix` tags | No registry push was found, but only the owner knows about manual transfers | Owner confirms; release engineering deletes the tainted rollback tags afterwards |

Rotating external credentials is deliberately left to the owner. No credential
values are recorded in this repository.
