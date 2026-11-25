# Product → Partner Mapping Report

**Gate status: BLOCKED BY OWNER INPUT**
**Measured:** 2026-11-26 against the staging database
**Owner:** business owner (ownership + commission confirmation)

---

## 1. Rule being verified

A product sold through the marketplace must have **exactly one** owning partner,
recorded against the **stable Medusa product id** — never a display name, slug,
tag or artist name. Display data is mutable; a mapping keyed on it silently
re-points when someone renames a product.

Enforcement added in this mission:

* `partner_product.product_id` now has a **unique index**
  (`uq_partner_product_product`, migration 010), so two partners cannot claim the
  same product id at the database level.
* The audit reports every marketplace-enabled product with no `partner_product`
  row as *unresolved ownership* rather than assigning it to anyone.

## 2. Measured result

| Metric | Count |
| --- | --- |
| Products | 19 |
| Products with an owning partner | **0** |
| **Unresolved ownership** | **19** |
| Partner rows in database | 0 |
| `partner_product` rows | 0 |

Every product is currently **unowned**. That is the honest state: no partner
identities or agreements exist yet (see
`PARTNER_ONBOARDING_AND_AGREEMENT_REGISTER.md`), and nothing in the code invented
an owner.

Unresolved product ids (the working queue):

```
prod_01M89WXJ71ER9MNEAP8Q64RJ11  prod_01M89WXHDPQSTQVQ01TBVG50WK
prod_01M89WXJ3JKPYARJABYFA628AW  prod_01M89WXHRFCB7WDDH88TV6N40B
prod_01M89WXHY09C9FDC09EHG5TKNQ  prod_01M89WXH1ZN0Y2Q5MQNXAA7B86
prod_01M89WXJ8KVSJS78KAYR9R2RVC  prod_01M89WXHT8YYM7F4HJ4TXVHXMJ
prod_01M89WXH7C4EZ0Y4VDTW49NH7P  prod_01M89WXHVXZP69MBPG12S09A1D
prod_01M89WXHPS9E13AYQKDZXM5BB7  prod_01M89WXHMBEH7G6RNRZR523YKR
prod_01M89WXJ5HEMS133NM85Y9Q5JC  prod_01M89WXHJ2AG6KYR6DEP2Q598B
prod_01M89WXH55SE0Q5301FKH6VNHA  prod_01M89WXH9B3CDH6SF27GSYBVTK
prod_01M89WXJ0JDFX44M4S3XVV30CC  prod_01M89WXHAZDWKATHNPKGFA09EC
prod_01M89WXHGDNF585S1JAX7C05JA
```

Reproduce with:

```bash
DATABASE_URL=… node scripts/ops/catalogue-readiness-audit.mjs --json | \
  jq '.unresolvedOwnershipProductIds'
```

## 3. Why an "artist" is not automatically a partner

The database has `partner.artist_id` (an optional link to a `site_artist` row).
The platform deliberately does **not** treat that link as ownership:

* an artist profile is public content; a partner is a commercial counterparty
  with an agreement and commission terms;
* promoting an artist to a partner by inference would silently create a
  settlement obligation that no one signed;
* the admin "link artist" action records the link and activates nothing
  (`lib/admin-partners/platform.ts` documents this explicitly).

The mission brief says the same thing, and the code agrees with it.

## 4. Assignment workflow (ready; waits for owner data)

1. Owner confirms, in writing, which partner owns each product.
2. Admin records the mapping through the partner product submission/approval
   path (`partner_product`, status `approved` for marketplace fulfilment).
3. The unique index guarantees one owner per product id.
4. Re-run the audit: `unresolvedOwnership` must reach the agreed launch scope —
   0 for any product that will be sold through the marketplace.
5. Products that will be sold **directly by the house** (not marketplace-fulfilled)
   must be marked as such by owner decision; they are not silently excluded.

## 5. Publish-blocking behaviour

The audit exits non-zero with `--strict`, so it can be wired into a release
check:

```bash
node scripts/ops/catalogue-readiness-audit.mjs --strict   # exit 1 while gaps remain
```

There is intentionally no automatic "assign to the only partner" fallback. A
guessed owner is worse than a missing one: it pays the wrong counterparty.

## 6. Status summary

| Item | Status |
| --- | --- |
| Stable-ID mapping model | **DONE** (`partner_product.product_id`) |
| Single-owner constraint | **DONE** (`uq_partner_product_product`) |
| Unresolved ownership queue | **DONE** (audit output + this report) |
| Artist ≠ partner rule | **DONE** (already enforced, documented here) |
| Actual product ownership data | **BLOCKED BY OWNER INPUT** |
| Partner identities/agreements | **BLOCKED BY OWNER INPUT** |

Marketplace fulfilment cannot be enabled until every marketplace product has a
verified owner. Selling with ambiguous attribution would misdirect settlement.
