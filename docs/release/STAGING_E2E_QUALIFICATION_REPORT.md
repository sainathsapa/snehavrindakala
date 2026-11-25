# Staging E2E Qualification Report

**Gate status: PARTIAL PASS** — executed against the running staging stack; provider scenarios remain skipped
**Executed:** 2026-11-26 · **Commit:** `security/closure-final` + this branch's changes
**Environment:** Docker Compose staging stack (`snehavrinda-kala-storefront` / `snehakala-backend`, both healthy)
**Runner:** Playwright 1.x, chromium + Pixel 7 projects, `E2E_BASE_URL=http://127.0.0.1:3000`

---

## 1. Headline result

```
71 passed
 0 failed
35 skipped
exit 0   (1.2 min)
```

The 35 skips are **not passes**. They are scenarios that require credentials or
fixtures this environment does not have (§5).

## 2. How this run was made honest

The first full run reported failures that were **environment artefacts**, not
product defects. Each was investigated rather than accepted:

| Observed | Root cause | Resolution |
| --- | --- | --- |
| Product journeys failed, 0 products rendered; log showed `A valid publishable key is required` | the Playwright-managed server was started without the Medusa publishable key (`webServer.env` replaces the environment rather than merging) | re-ran against the **running staging stack**, which has the real runtime config |
| 4 chromium tests timed out at 30 s (36–45 s durations) while the same journeys passed on mobile in 1–7 s | 2 projects × default workers over one Node + Medusa process | proved by serial re-run, then capped workers for external targets (`playwright.config.ts`) |
| `a valid code discounts the cart` skipped | `discount_codes` table has **0** rows — there is no code to apply | recorded as a fixture gap, not a pass |

Direct verification of the product journey, independent of Playwright:

```
/products/art-pendant      → 200, own <title>, Product JSON-LD ×1, one <h1>
/en/products/art-pendant   → 200, same
/hi/products/art-pendant   → 200, Hindi title, Product JSON-LD ×1
```

## 3. Serial proof of the previously failing journeys

```
$ npx playwright test --project=chromium --workers=1 \
    -g "every page has exactly one h1|every tradition linked|every product linked|a product page carries its own title|a valid code discounts the cart"

✓ every page has exactly one h1 and a document language        3.0s
✓ every tradition linked from the art-forms index resolves     1.9s
✓ every product linked from the shop actually resolves         7.6s
✓ a product page carries its own title and Product schema      1.4s
- a valid code discounts the cart                              (skipped: no discount code)
4 passed, 1 skipped
```

This is what distinguishes "the page is broken" from "the harness over-subscribed
the server". The pages were never broken.

## 4. What passed (by area)

| Area | Coverage |
| --- | --- |
| Home, shop listing, empty states | renders, no placeholders claimed, honest empty state |
| Search | keyword search, empty-query form, no 404 |
| Product pages | readable slugs, per-product title, Product JSON-LD, every linked product resolves, both locales |
| Art forms / traditions | index and detail links resolve |
| Journal | seeded essays, own titles, serif body copy |
| Hindi / i18n | `/hi` served in Hindi, `<html lang>`, hreflang pairing, cookie does not hijack an English URL, no raw message keys, product title language matches URL |
| Cart | empty-cart copy, unknown promo code rejected in plain language, saved address reveals pay button |
| Payment guards | forged payment signature refused |
| Admin gate | login page reachable while signed out, wrong password refused without leaking why, dashboard redirect |
| Partner portal reachability | sign-in renders, protected pages bounce to sign-in (not 404) |
| Chrome / a11y | one `<h1>` per page, document language, alt text, no admin link exposed, single-brand mode hides platform pages |
| Mode gating | platform-only pages not advertised in single-brand mode |

## 5. Skipped scenarios — the actual marketplace/payment/finance gaps

These specs self-skip when their precondition env flag is absent. They are
implemented, not missing; they need credentials and provisioned fixtures.

| Spec | Scenario | Needs |
| --- | --- | --- |
| `partner-marketplace.spec.ts` (A) | customer purchases from one partner | Razorpay **sandbox** keys + a provisioned partner + product |
| `partner-marketplace.spec.ts` (B) | multi-partner checkout, each partner fulfils its own items | two provisioned partners + sandbox keys |
| `multi-partner-isolation.spec.ts` (C) | cross-partner isolation attack via UI and direct API | two partner logins (synthetic) |
| `multi-partner-isolation.spec.ts` (G) | partner statements tenant-isolated | two partners with earnings |
| `payment-sandbox.spec.ts` (E) | valid capture | Razorpay sandbox keys |
| `payment-sandbox.spec.ts` (F) | delayed webhook reconciliation | sandbox keys + webhook secret |
| `payment-sandbox.spec.ts` (H) | duplicate / invalid webhook handling | webhook secret |
| storefront specs | promo-code discount applied | a seeded `discount_codes` row |
| storefront specs | artists/sell menu, art-forms menu | multi-brand mode flag |

**No skipped scenario is reported as passed anywhere in this report or in the
release decision.**

## 6. Scenarios that cannot run at all yet

| # | Scenario | Blocker |
| --- | --- | --- |
| 8 | Sandbox refund + ledger treatment | needs an approved staging refund test policy (separate from the production refund policy, which is out of scope) |
| 10 | Settlement ledger with no real payout | needs approved commission terms + partner fixtures |
| 11 | Shiprocket test shipment + tracking sync | needs Shiprocket test credentials and measured parcels |
| 13 | Backup restore + smoke against restored DB | **partially done**: restore + schema verification executed (see `BACKUP_RESTORE_DRILL_REPORT.md`); application smoke against the restored DB not run |

## 7. Environment and safety

* No live payment credentials were used. No real charge, refund or payout was
  executed.
* No real customer data was used; the staging database holds 19 catalogue
  products, 1 order and no partner records.
* A synthetic value was supplied for `RAZORPAY_WEBHOOK_SECRET` **only** for a
  locally spawned server, so the production startup gate would pass. It is not a
  real secret and was not used to reach Razorpay.
* The suite ran against the staging stack, not production.

## 8. Reproduce

```bash
# stack must be up and healthy
docker compose ps

cd apps/storefront
E2E_BASE_URL=http://127.0.0.1:3000 npx playwright test --reporter=list
```

## 9. Verdict

Staging **storefront** journeys: **qualified** (71 passing, 0 failing).
Staging **marketplace, payment and finance** journeys: **not qualified** — all
skipped pending owner credentials and fixtures. The release gate therefore stays
**BLOCKED BY OWNER INPUT**, not PASS.
