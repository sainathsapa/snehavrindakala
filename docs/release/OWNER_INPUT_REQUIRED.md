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
- [ ] SES configuration-set → **SNS** event destination provisioned, with a topic
      subscription to `/api/webhooks/ses`, and `SES_SNS_TOPIC_ARN` pinned to the
      accepted topic (delivery/bounce/complaint events are otherwise unverified)
- [ ] Optional tuning: `NOTIFICATION_MAX_ATTEMPTS` (default 5, capped 50),
      `SES_SUPPRESS_ON_BOUNCE` / `SES_SUPPRESS_ON_COMPLAINT` (default true)

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

## Engineering gap closure — newly surfaced owner gates

The gap-closure branch implemented the mechanisms; activation of each still needs
an owner decision. Nothing below was invented or defaulted in code.

- [ ] **Finance policy selection** (GAP-12): choose `refund_effect`
      (`reverse_earnings` / `no_reversal`) and `payable_when` (`order_paid` /
      `order_delivered` / `return_window_elapsed`) and approve an active policy.
      `PARTNER_BUSINESS_RULES.md` §2 is still blank; the system fails closed until
      a real choice exists.
- [ ] **Return window**: set `RETURN_WINDOW_DAYS`. It is never defaulted; both
      return eligibility and `return_window_elapsed` settlements fail closed
      without it.
- [ ] **Notification retry activation**: set `CRON_SECRET` and enable the `ops`
      profile so `notification-retry-cron` actually calls the worker. Without it
      the retry state machine exists but never advances. Provision the SES
      configuration-set → SNS destination (above) for real delivery events.
- [ ] **Restock inspection evidence** (A110): condition, `physicallyReceived`,
      `inspected` and `restockApproved` are not in the database. Automatic stock
      restoration intentionally does not run; `inventory_restored` stays `false`
      until an owner-approved process supplies this evidence. No value was
      fabricated.
- [ ] **Webhook/event wiring**: point Razorpay and SES/SNS at the deployed
      `/api/webhooks/razorpay` and `/api/webhooks/ses` endpoints with real secrets
      before live events are trusted.

## How to provide these safely
1. Sandbox keys: add to the deployment environment / `.env` **locally** (gitignored), never to a tracked file.
2. Confirm to the Lead **which** variables were set (names only, not values).
3. The Lead runs a config validator that reports presence/absence without printing values.
4. Business rules (rates, basis, payout terms): provide as a signed document or a structured entry in the partner-agreement record — the config UI will not activate until validated and approved.
