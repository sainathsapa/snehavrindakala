# Owner input required — SnehaVrinda Kala FINAL GO

> Consolidated list of every external input that cannot be fabricated in code.
> **Never post secrets in chat, tickets, source files or reports.** Configure them
> directly in the approved secret manager / deployment environment (Docker Compose
> env, AWS Secrets Manager, or the hosting provider's secret store) and confirm
> out-of-band. Code is written to fail loudly in production when these are missing.

## Payments (Razorpay)
- [ ] Razorpay **sandbox** key ID (`RAZORPAY_KEY_ID`)
- [ ] Razorpay **sandbox** key secret (`RAZORPAY_KEY_SECRET`)
- [ ] Razorpay webhook secret (`RAZORPAY_WEBHOOK_SECRET`) + webhook URL registered on the dashboard
- [ ] Live keys + explicit written authorization before `CHECKOUT_RAZORPAY_PROVIDER=1` in production
- [ ] Approval of refund policy (windows, partial-refund rules)

## Email (SES)
- [ ] Verified SES sender / domain
- [ ] `AWS_REGION` and SES credentials via IAM role or secret manager
- [ ] `FROM_EMAIL`
- [ ] One controlled test recipient for delivery verification

## Shipping (Shiprocket)
- [ ] Shiprocket sandbox or approved integration credentials (`SHIPROCKET_*`)
- [ ] Webhook token (`SHIPROCKET_WEBHOOK_TOKEN`)
- [ ] Pickup/warehouse address
- [ ] Actual product weight and dimensions (kg, cm) — no hardcoded assumptions
- [ ] HSN codes where applicable (see Finance & legal)

## Partner business (defines whether settlements can be enabled)
- [ ] Legal identities of each real partner
- [ ] Signed partner agreements
- [ ] Commission **rates** (never guessed)
- [ ] Commission **basis**: gross vs discounted item value, tax inclusion, shipping inclusion, refund/cancellation effect, payable timing
- [ ] Settlement frequency and payout terms
- [ ] Cancellation / return ownership responsibility per partner
- [ ] Payout provider (bank / UPI) and who is authorized to confirm payouts
- [ ] TDS / withholding treatment (CA to confirm)

## Finance & legal
- [ ] Seller legal identity and registered address
- [ ] GSTIN (where applicable)
- [ ] HSN/SAC per product + place-of-supply rules
- [ ] CA-approved tax treatment (CGST/SGST/IGST applicability)
- [ ] Grievance officer contact
- [ ] Privacy / refunds / terms policy sign-off

## Catalogue & inventory
- [ ] Real product images and measured dimensions
- [ ] Product descriptions
- [ ] Actual inventory counts for one-of-a-kind works
- [ ] Authoritative product → partner/artist mapping (for migration/linking)

## Production
- [ ] Domain, DNS, TLS (Caddy config in `deploy/Caddyfile`)
- [ ] Production hosting configuration and secrets (`COOKIE_SECRET`/`JWT_SECRET`, DB URL, admin credentials)
- [ ] Backup destination and restore-drill window
- [ ] Monitoring / error-alerting configuration

## Credential security
- [ ] Confirmation that credentials leaked in historical commit `d8894ec` were **revoked and rotated externally** (e.g. Shiprocket password, Medusa admin password). A new env var is NOT proof of rotation.
- [ ] Confirmation that no exposed credential remains active
- [ ] Decision on history rewrite if the repository is/was public

## How to provide these safely
1. Sandbox keys: add to the deployment environment / `.env` **locally** (gitignored), never to a tracked file.
2. Confirm to the Lead **which** variables were set (names only, not values).
3. The Lead runs a config validator that reports presence/absence without printing values.
4. Business rules (rates, basis, payout terms): provide as a signed document or a structured entry in the partner-agreement record — the config UI will not activate until validated and approved.
