# Partner Onboarding & Agreement Register

**Gate status: BLOCKED BY OWNER INPUT** — no real partner exists yet
**Owner:** business owner (identities, agreements, commercial terms)
**Engineering status:** intake + validation workflow **DONE and tested**

---

## 1. Register state

| Partner | Legal identity | Agreement | Commercial config | Status |
| --- | --- | --- | --- | --- |
| *(none recorded)* | — | — | — | — |

Measured on the staging database:

```
partner rows                0
marketplace_partner_agreement rows   0
partner_commercial_config rows       0
partner_product rows                 0
```

**No partner has been invented.** Nothing in this mission creates a partner
identity, a commission rate, or an agreement date. The workflow that records them
is built and tested; the data is the owner's.

## 2. What the owner must supply, per partner

Submit through the agreed secure channel — **never** in chat, a commit, or a
ticket. No bank details are requested here; payout instrument details are out of
scope until a payouts process is designed to protect them.

| Field | Required | Purpose | Validation |
| --- | --- | --- | --- |
| Legal / business name | yes | contracting party | non-empty, ≤ 500 chars |
| Display name | yes | storefront attribution | non-empty, unique slug |
| Authorised owner / contact | yes | operational contact | verified channel |
| Contact email + phone | yes | fulfilment and disputes | format-checked |
| Signed agreement reference | yes | the thing that makes activation legal | non-empty |
| Agreement signing date | yes | audit trail | `YYYY-MM-DD` |
| Agreement effective from | yes | activation gate | `YYYY-MM-DD`, ≤ today |
| Agreement effective to | optional | expiry | must be ≥ effective-from |
| Agreement document reference | optional | pointer to the owner's document store | not the document itself |
| Commission policy id | yes | rate + basis | must reference an existing `commission_policy` |
| Payout frequency | yes | settlement cadence | one of weekly / fortnightly / monthly / on_demand |
| Payout terms | yes | net days, conditions | non-empty, ≤ 2000 chars |
| Product ownership list | yes | mapping | stable Medusa product ids |
| Fulfilment responsibility | yes | who ships | owner-approved setting |
| Approver (for commission config) | yes | attribution | the admin who approved it |

The database enforces the important subset directly (migration 010):

* a `signed` agreement cannot exist without a reference, a signing date and an
  effective date;
* a commercial configuration cannot be marked approved without an approver, an
  approval timestamp, a commission policy, a payout frequency and an effective
  date.

## 3. Activation is now gated, not assumed

Until this mission, `account_status` could be flipped to `active` with one call.
It now requires the evidence above:

```
lib/admin-partners/platform.ts  →  setAccountStatus('active')
                                  └─ assertCommerciallyActivatable()
                                       ├─ signed, in-force agreement
                                       └─ approved commission + payout config
```

Refusal returns machine-readable blockers the admin UI can act on:

`agreement_missing`, `agreement_not_signed`, `agreement_reference_missing`,
`agreement_signed_on_missing`, `agreement_not_yet_effective`,
`agreement_expired`, `commercial_config_missing`, `commission_policy_missing`,
`payout_frequency_missing`, `payout_terms_missing`,
`commercial_config_not_approved`, `commercial_config_not_yet_effective`.

Two behaviours worth noting:

* **Re-activation is re-gated.** An agreement that lapsed while the partner was
  live is not silently ignored — setting `active` again re-evaluates.
* **A stale status cannot keep a lapsed agreement alive.** An `effective_to` in
  the past refuses activation even if the status column still says `signed`.

Non-commercial transitions (`suspended`, `rejected`, `pending`) are **not**
gated, so suspension and offboarding still work during an incident even if the
paperwork is missing. Suspending must never be blocked by missing data.

## 4. Admin workflow (operational now)

| Step | Endpoint | Permission |
| --- | --- | --- |
| Read agreement/config/readiness | `GET /api/admin/marketplace-partners/[id]/commercial` | `partners:read` |
| Record agreement revision | `POST …/commercial` with `{ agreement: {…} }` | `partners:write` |
| Record/approve commercial config | `POST …/commercial` with `{ commercial: {…, approve: true} }` | `partners:write` |
| Activate | `POST /api/admin/marketplace-partners/[id]/status` | `partners:write` |
| Suspend / offboard | same status endpoint | `partners:write` |

The acting admin comes from the signed session, never from the request body, so an
approval cannot be attributed to someone who did not perform it. Recording terms
and flipping the status are two separate actions, each audited.

## 5. Commission preview and explanation

The commission engine already records the basis on every ledger row
(`gross_basis`, `discount`, `tax_amount`, `shipping_amount`,
`commission_amount`, `payable_amount`, `commission_policy_id`), and the policy
itself stores `rate_basis`, `tax_included`, `shipping_included`, `refund_effect`
and `payable_when`. A partner statement can therefore explain *why* a number is
what it is rather than showing a bare total.

No rate has been configured, so no preview with real numbers can be produced.
Inventing one would be worse than showing nothing.

## 6. Suspension and offboarding

* `suspended` immediately fails partner session validation: the session helper
  re-reads membership on every request, so a suspension takes effect on the next
  request rather than at token expiry.
* `suspended` / `rejected` do not require agreement data, so they can be applied
  during an incident.
* No function deletes a partner or an agreement row. Offboarding is a status
  change plus membership suspension, preserving order and settlement history.

## 7. What remains blocked

| Item | Blocker |
| --- | --- |
| Real partner identities | owner |
| Signed agreements (reference + dates) | owner + legal |
| Commission rates and basis | owner + accountant |
| Payout frequency and terms | owner + accountant |
| Product ownership per partner | owner |
| Fulfilment responsibility per partner | owner |

Until these exist, `partner_commercial_config` stays empty, the activation gate
refuses, and no partner can transact or receive settlement. That is the intended
fail-closed behaviour, not a defect.

## 8. Verification

```bash
# the gate is covered by 22 tests, including every refusal path
npx vitest run tests/partner-commercial-gate.test.ts

# tenant isolation with synthetic partners is covered separately
npx vitest run tests/partner-tenant-isolation.test.ts tests/qa-cross-partner.test.ts
```
