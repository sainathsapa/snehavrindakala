# Partner Configuration Validation

**Gate status: PASS for isolation and configuration controls · BLOCKED BY OWNER INPUT for real partners**
**Executed:** 2026-11-26 · **Environment:** staging stack + unit suites
**Owner:** AGENT 02 (engineering) · business owner (real identities/terms)

---

## 1. What was validated

| Requirement | Result | Evidence |
| --- | --- | --- |
| Two distinct partners cannot see each other's data | **PASS** | 38 negative tests across two suites |
| Tenant scoping is applied at the query layer, not the UI | **PASS** | `buildScopedStatement` / `tenantQuery` force `partner_id` |
| Modified identifiers / direct API calls do not cross tenants | **PASS** | cross-partner suite |
| A partner cannot become commercially active without approved terms | **PASS** | 22-test gate suite (new in this mission) |
| Unapproved commercial configuration cannot enable settlement | **PASS** | `approved_by` required by both code and DB CHECK |
| Suspension / offboarding works without agreement data | **PASS** | gate excludes non-commercial transitions |
| Artist link does not create partner ownership | **PASS** | `platform-partners` suite |
| Partner statements stay tenant-isolated | **PASS** | earnings/ledger scoping tests |

```
tests/partner-tenant-isolation.test.ts   19 passed
tests/qa-cross-partner.test.ts           19 passed
tests/partner-commercial-gate.test.ts    22 passed
tests/platform-partners.test.ts          (existing suite, extended for the gate)
```

## 2. How isolation is actually enforced

Isolation does not depend on a UI check or a role string. Every partner read and
write goes through a scoped statement builder that binds the partner id from the
**verified session**, never from the request:

```
lib/partner/repository.ts → buildScopedStatement() / tenantQuery()
lib/partner/context.ts    → the session's partner id is the tenant
```

Consequences worth stating explicitly:

* passing another partner's `id` in a URL path or body does not change the
  tenant — the scoped statement still filters by the session's partner id;
* a suspended membership is re-read from the database on every request, so a
  revocation takes effect on the next request, not at token expiry;
* the audit log is append-only and tenant-scoped, so one partner cannot observe
  or erase another's trail.

## 3. Commercial configuration controls

The activation gate (`lib/admin-partners/commercial.ts`) is a pure evaluator; the
enforcement point is `setAccountStatus()` in `lib/admin-partners/platform.ts`, so
every caller — admin action, API route, script — hits the same rule.

Refusal is actionable, not a bare 400: the API returns
`PlatformValidationError.blockers` with codes such as `agreement_missing` and
`payout_terms_missing`.

Tested refusal paths: missing agreement; draft agreement; terminated agreement;
expired agreement; signed-but-no-reference; signed-but-no-date; future-dated
agreement; past `effective_to` with a stale `signed` status; missing commercial
config; unapproved config; missing commission policy; invalid payout frequency;
empty payout terms; future-dated config; and "one missing term among many" (all
blockers reported at once).

## 4. Synthetic staging partners

Isolation is verified with **two distinct synthetic tenants** in the test
fixtures. No real partner identity is created, and none is implied. This meets
the "at least two synthetic partners pass tenant-isolation tests" requirement
without inventing business data.

## 5. What is not validated, and why

| Item | Status | Reason |
| --- | --- | --- |
| Real partner identities | BLOCKED BY OWNER INPUT | must not be invented |
| Signed agreements | BLOCKED BY OWNER INPUT | legal documents |
| Real commission rates and basis | BLOCKED BY OWNER INPUT | financial decision |
| Payout frequency / terms | BLOCKED BY OWNER INPUT | financial decision |
| Live settlement run against a real partner | BLOCKED BY OWNER INPUT | needs the above + authorization |
| Partner financial statement with real amounts | BLOCKED BY OWNER INPUT | needs the above |

Configuring a rate "so the system has one" would create a settlement obligation
nobody agreed to. The correct state is an empty configuration and a gate that
refuses — which is what is deployed.

## 6. Remaining risk

* Isolation is proven at the repository/route layer with tests; a full
  two-partner **browser** journey is part of the E2E suite (`multi-partner-isolation.spec.ts`)
  and remains **skipped** because it needs two provisioned partner accounts with
  credentials. Skipped is not passed — see
  `STAGING_E2E_QUALIFICATION_REPORT.md`.
* No penetration test or external security review covers the partner portal.

## 7. Verification commands

```bash
cd apps/storefront
npx vitest run tests/partner-tenant-isolation.test.ts tests/qa-cross-partner.test.ts
npx vitest run tests/partner-commercial-gate.test.ts
npx vitest run tests/platform-partners.test.ts
npx playwright test e2e/multi-partner-isolation.spec.ts   # skipped until partner fixtures exist
```
