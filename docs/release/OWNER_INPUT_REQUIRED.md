# Owner Input Required — consolidated register

> **This is the authoritative owner-input tracker** for the release
> `release/owner-input-staging-qualification`. Older trackers
> (`FINAL_GO_BLOCKERS.md`, `RELEASE_BLOCKERS.md`) are preserved as history; where
> they disagree with this file, this file wins.
>
> **Never post secrets in chat, tickets, source files or reports.** Configure them
> directly in the approved secret store / deployment environment and confirm
> out-of-band. No agent will ask you to paste a credential anywhere. Every value
> below is injected at runtime; the application fails closed when one is missing.

**Last updated:** 2026-11-26
**Legend:** ✅ supplied · 🟡 partially supplied · ⛔ not supplied (blocking) · — not applicable

---

## 1. Credential rotation (highest priority — confirmed exposures)

These are **not** "configure a new value" tasks. They close only when the **old**
value is proven rejected. See `CREDENTIAL_ROTATION_REGISTER.md` and
`CREDENTIAL_EXPOSURE_RECONCILIATION.md`.

| ID | Item | Owner | Secure delivery | Validation method | Status |
| --- | --- | --- | --- | --- | --- |
| O-01 | Rotate Razorpay **key secret** (exposed in images) | business owner | Razorpay dashboard → regenerate; new value into Secrets Manager | old key returns 401 on a real API call | ⛔ |
| O-02 | Rotate `JWT_SECRET` | release eng | generate into `${env}/snehavrinda/jwt_secret` | pre-rotation token rejected (401) | ⛔ |
| O-03 | Rotate `COOKIE_SECRET` | release eng | generate into `${env}/snehavrinda/cookie_secret` | pre-rotation cookie rejected at `/admin` | ⛔ |
| O-04 | Rotate admin password | business owner | Medusa admin user update / bootstrap | old password refuses to authenticate | ⛔ |
| O-05 | Rotate **Shiprocket** password/API token (committed in git history) | business owner | Shiprocket dashboard; value into secret store | old token rejected by provider | ⛔ |
| O-06 | Confirm no affected image was exported/pushed by hand | business owner | written confirmation | recorded in register R-10 | ⛔ |
| O-07 | Confirm production DB never used the default `medusa/medusa` password | release eng + owner | config review | RDS credential check | ⛔ |
| O-08 | Authorize deletion of `:rollback-pre-security-fix` tags | business owner | written authorization | tags removed after rotations verified | ⛔ |

## 2. Payments (Razorpay)

| ID | Item | Owner | Delivery | Validation | Status |
| --- | --- | --- | --- | --- | --- |
| O-10 | Razorpay **sandbox** key id + secret | business owner | secret store | one sandbox order completes | ⛔ |
| O-11 | Razorpay webhook secret + webhook URL registered | business owner | provider dashboard + secret store | signed webhook accepted; forged rejected | ⛔ |
| O-12 | Live keys + written authorization before enabling live checkout | business owner | written authorization | explicit go/no-go record | ⛔ |

## 3. Partner identities and commercial terms

| ID | Item | Owner | Delivery | Validation | Status |
| --- | --- | --- | --- | --- | --- |
| O-20 | Legal identity per partner | business owner | secure form / file share | recorded via admin partner workflow | ⛔ |
| O-21 | Signed agreement (reference, signing date, effective-from) | owner + legal | document store; **reference only** into the app | activation gate accepts | ⛔ |
| O-22 | Commission rate + basis (gross vs discounted, tax/shipping inclusion, refund effect, payable timing) | owner + accountant | admin commercial workflow | commission preview matches the agreed example | ⛔ |
| O-23 | Payout frequency + terms | owner + accountant | admin commercial workflow | activation gate accepts | ⛔ |
| O-24 | Product ownership per partner (stable product ids) | business owner | spreadsheet of id → partner | audit reports 0 unresolved for marketplace items | ⛔ |
| O-25 | Fulfilment/return responsibility per partner | business owner | admin workflow | recorded against partner | ⛔ |
| O-26 | Partner portal logins for staging isolation test | release eng | synthetic accounts only | two-partner E2E unskips and passes | ⛔ |

## 4. Shipping (Shiprocket)

| ID | Item | Owner | Delivery | Validation | Status |
| --- | --- | --- | --- | --- | --- |
| O-30 | Shiprocket **test/staging** credentials | business owner | secret store | authenticate + serviceability check | ⛔ |
| O-31 | Webhook token/secret configured in provider | business owner | provider + secret store | signed webhook accepted | ⛔ |
| O-32 | Verified pickup address + contact | business owner | admin/settings | pickup serviceable | ⛔ |
| O-33 | Measured weight + package dimensions **per product** | business owner | admin shipping-data endpoint | audit reports 0 missing | ⛔ (19 of 19 missing) |
| O-34 | Explicit authorization before any real courier booking | business owner | written authorization | recorded per attempt | ⛔ |

## 5. Catalogue and inventory

| ID | Item | Owner | Delivery | Validation | Status |
| --- | --- | --- | --- | --- | --- |
| O-40 | Real photographs of the actual artworks (15 products currently show generated stand-ins) | business owner | shared drive | `placeholderOrBrokenMedia == 0` | ⛔ |
| O-41 | Accurate descriptions/specifications per product | business owner | admin product editor | reviewed, no invented attributes | ⛔ |
| O-42 | Actual stock counts per variant | business owner | import file (dry-run first) | undersell/oversell controls pass | ⛔ (0 of 20 tracked) |
| O-43 | Unique-artwork vs series vs replenishable classification | business owner | import file | recorded per variant | ⛔ |
| O-44 | Confirmation of any sales made off-platform | business owner | written list | reflected in starting counts | ⛔ |

## 5a. Legal and policy

| ID | Item | Owner | Delivery | Validation | Status |
| --- | --- | --- | --- | --- | --- |
| O-45 | Grievance officer contact | business owner | written | published on the legal pages | ⛔ |
| O-46 | Privacy / refunds / terms policy sign-off | owner + legal counsel | written | legal pages marked approved | ⛔ |

- [ ] Grievance officer contact
- [ ] Privacy / refunds / terms policy sign-off

Neither has been supplied, so the legal pages report themselves as unsigned rather
than presenting invented identities. No legal counsel has reviewed the policies.

## 6. Production operations

| ID | Item | Owner | Delivery | Validation | Status |
| --- | --- | --- | --- | --- | --- |
| O-50 | Production domain name(s) | business owner | written | `check-dns-tls.mjs <host>` passes | ⛔ |
| O-51 | DNS provider access / delegated runner | business owner | approved workflow | records created by authorized party | ⛔ |
| O-52 | Production secret manager access | business owner | IAM role / console | runtime injection verified | ⛔ |
| O-53 | Monitoring destination + recipients + severity policy | business owner | their alerting tool | a test alert is received by a named human | ⛔ |
| O-54 | Backup destination + retention + encryption-key custody | business owner | bucket + policy | off-site restore drill passes | ⛔ |
| O-55 | Authorization + window for a production restore/rollback exercise | business owner | written authorization | exercise recorded | ⛔ |

## 7. Explicitly excluded from this mission — do NOT mark resolved

These remain separate blockers. No value was configured, validated or approved in
this mission, and no statutory invoice or customer-facing email flow may depend on
them.

| ID | Item | Why it stays open |
| --- | --- | --- |
| X-01 | **SES sender/credentials + verified email delivery** | needs real AWS resources and a delivered test email; excluded by instruction |
| X-02 | **GSTIN registration details** | statutory data; excluded by instruction |
| X-03 | **HSN/SAC selection and validation** | statutory classification; excluded by instruction |
| X-04 | **Refund policy + returns window approval** | business/legal policy; excluded by instruction |

Production GO remains blocked by X-01…X-04 **even if every other gate passes.**

## 8. Tax treatment warning (read before any invoice work)

The seller's home state is configured as **Rajasthan**. That is **not** proof that
a transaction is taxed as CGST + SGST. Correct treatment depends on the registered
supplier location, the place of supply, both parties' GST registrations and the
circumstances of the transaction (intra-state vs inter-state, B2B vs B2C, and any
e-commerce-operator obligation). It must be validated per transaction with CA
approval before any statutory invoice is issued.

Do not generate statutory invoices while mandatory business information is
incomplete.

## 9. How to supply an input safely

1. Put the value in the approved secret store (AWS Secrets Manager /
   deployment environment) — **not** in a file, a message, or a commit.
2. Tell the release engineer **that it is done**, not **what it is**.
3. For non-secret business data (identity, terms, product mapping), use the admin
   workflow so the change is attributed and audited.
4. The release engineer records the gate transition with evidence, and only after
   verifying it (e.g. the old credential fails).

## 10. Current blocking count

| Category | Blocking items |
| --- | --- |
| Credential rotation | 8 |
| Payments | 3 |
| Partner | 7 |
| Shipping | 5 |
| Catalogue / inventory | 5 |
| Production operations | 6 |
| **Total blocking owner inputs** | **34** |
| Excluded (separate blockers) | 4 |
