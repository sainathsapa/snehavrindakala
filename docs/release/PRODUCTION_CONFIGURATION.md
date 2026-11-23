# Production configuration checklist (owner-controlled)

All values live in environment variables / a secrets manager. **No secret values
are recorded here.** Safe startup validation should fail loudly when a mandatory
value is missing in production rather than silently disabling a feature.

## Payments (sandbox first, then live)
- [ ] `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` (sandbox for testing).
- [ ] `RAZORPAY_WEBHOOK_SECRET` (required to enable provider).
- [ ] `CHECKOUT_RAZORPAY_PROVIDER=1` only after one sandbox purchase end-to-end.
- [ ] Live credentials supplied by owner with explicit authorization; never switch silently.

## Email / notifications
- [ ] `FROM_EMAIL` and verified SES sender/domain.
- [ ] `AWS_REGION` + SES credentials (IAM role preferred over static keys).

## Shipping
- [ ] `SHIPROCKET_*` production credentials + webhook token.

## Infrastructure
- [ ] Production domain + DNS + TLS (Caddy config in `deploy/Caddyfile`).
- [ ] `COOKIE_SECRET` / `JWT_SECRET` (admin session HMAC — required in prod, no fallback).
- [ ] `DATABASE_URL`, managed Postgres, verified backups + restore drill.
- [ ] `MEDUSA_ADMIN_EMAIL` / `MEDUSA_ADMIN_PASSWORD` / `ADMIN_EMAIL` / `ADMIN_PASSWORD`.
- [ ] Remove default `ADMIN_PASSWORD=changeme-admin-password` from `.env.example` usage.

## Tax / finance (owner + CA)
- [ ] Seller legal name + registered address.
- [ ] GSTIN (where applicable) — validated format.
- [ ] HSN/SAC codes per product; place-of-supply rules; CGST/SGST/IGST applicability.
- [ ] Accountant sign-off before any statutory tax invoice is issued.

## Business / legal (owner + counsel)
- [ ] Seller/contact/grievance identity for policy pages.
- [ ] Partner commission agreements, payout details, accounting/TDS rules.
- [ ] Analytics measurement id (`NEXT_PUBLIC_GA_MEASUREMENT_ID`).

## Content
- [ ] Real product photos, measured dimensions, 1 product description, maker bio
      (see `docs/PHOTO-AND-MEASUREMENT-BRIEF.md`). Do not invent these.

## Security housekeeping
- [ ] Rotate credentials leaked in git history `d8894ec`.
