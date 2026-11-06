# SnehaVrinda Kala — Full Audit Report

**Date:** 2026-11-06  
**Repository:** `https://github.com/sainathsapa/snehavrindakala.git`  
**Branch:** `main`  
**HEAD:** `2c7c4d1 Add Indian-authentic design system, customer auth, and seller portal MVP`  
**Scope:** Production readiness, storefront, backend, auth, seller portal, design system, security, accessibility, performance, SEO, CI/CD, data, and launch readiness.

---

## 1. Executive summary

The storefront is stable, builds cleanly, starts in Docker Compose, and is connected to the existing Medusa backend. The design direction is now genuinely Indian-authentic — ivory, madder, indigo, haldi, peacock, rose, sage, and gold — with a small reusable UI system.

It is **not launch-complete yet** because the live catalogue and commerce data are empty, the custom artist/commission backend modules still fail at runtime, real payments/shipping are not wired end-to-end, and dependency/security/CI gaps remain.

**Readiness:** Beta / staging-ready storefront shell; not production-complete for selling.

---

## 2. Verified checks

### 2.1 Stack state

- Monorepo: `apps/backend`, `apps/storefront`, `apps/studio`, `packages/ui`, `packages/types`, `packages/config-tailwind`.
- Existing Medusa backend is used; no duplicate backend service was created.
- Storefront talks to Medusa via `MEDUSA_BACKEND_URL` / `NEXT_PUBLIC_MEDUSA_BACKEND_URL`.
- Backend health: `GET /health` returns `200`.

### 2.2 Automated checks run

| Check | Result |
|---|---|
| `pnpm --filter @snehavrinda-kala/backend typecheck` | Pass |
| `pnpm --filter @snehavrinda-kala/storefront typecheck` | Pass |
| `pnpm --filter @snehavrinda-kala/backend test` | Pass — 26 tests |
| `pnpm --filter @snehavrinda-kala/storefront build` | Pass |
| `pnpm --filter @snehavrinda-kala/backend lint` | Fail — `eslint: command not found` |
| `pnpm --filter @snehavrinda-kala/storefront lint` | Fail — prompts for ESLint setup |
| `pnpm audit --prod` | 95 vulnerabilities: 5 low, 47 moderate, 34 high, 9 critical |
| Docker Compose | Backend, storefront, Postgres, Redis all healthy |

### 2.3 Route smoke check on storefront

| Route | Status |
|---|---|
| `/` | 200 |
| `/shop` | 200 |
| `/art-forms` | 200 |
| `/artists` | 200 |
| `/custom-art` | 200 |
| `/sell` | 200 |
| `/seller` | 307 → login when unauthenticated |
| `/account` | 307 → login when unauthenticated |
| `/account/login` | 200 |
| `/account/register` | 200 |
| `/cart` | 200 |
| `/checkout` | 200 |
| `/design-system` | 200 |
| `/journal` | 200 |
| `/about` | 200 |

Security headers on `/` include `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, and production HSTS.

---

## 3. Critical findings

### 3.1 [CRITICAL] Catalogue is empty in the database

**Evidence:**

```sql
products  | 0
regions   | 0
customers | 1
publishable_api_key_sales_channel | 1
```

Store API works, but there are no products and no regions.

**Impact:** Shop, product detail, add-to-cart, and checkout cannot demonstrate a real sale.

**Fix:**

1. Create an INR region in Medusa Admin.
2. Link publishable key to the default sales channel (already done once locally).
3. Add products with variants/prices.
4. Verify `/store/products?limit=2` returns product data.

### 3.2 [CRITICAL] Custom artist/commission modules still fail at runtime

**Evidence:**

```text
GET /store/artists → 500
POST /store/commissions → 500

Could not resolve 'artistModuleService'
Could not resolve 'commissionModuleService'
Metadata for entity Artist not found
```

**Root cause:** The custom modules use plain classes with an injected `manager`, not Medusa v2 `MedusaService` data models. Several routes still resolve old-style service names, and the entity metadata is not registered.

**Impact:** Artists directory, commissions, custom-art flow, and seller commission history cannot work against the real backend.

**Fix:**

1. Convert custom modules to Medusa v2 `MedusaService` + DML models, or implement a proper `manager` runtime binding.
2. Replace legacy resolve names with the actual container names, or remove reliance on them.
3. Ensure custom entities have migration-backed metadata.
4. Test `/store/artists`, `/store/commissions`, `/store/commissions/:referenceId`.

**Note:** A prior attempt to convert to `MedusaService` caused method/type conflicts and a runtime collection error, so the legacy implementations were restored to keep typecheck/backend health green.

### 3.3 [CRITICAL] Real online payment is not enabled

**Evidence:** `apps/storefront/app/checkout/page.tsx` saves delivery details to Medusa and then tells the customer to contact the store. There is no completed Razorpay order/payment/complete flow.

**Impact:** The storefront can collect cart and delivery data, but cannot complete paid orders.

**Fix:**

1. Configure Razorpay test keys.
2. Implement payment session → verify → complete order flow.
3. Add webhook/idempotency handling.
4. Test success/failure/timeout/duplicate webhook cases.

---

## 4. High findings

### 4.1 [HIGH] No root `package.json`

**Evidence:** `ls package.json` → `no root package.json`.

**Impact:** Root-level `pnpm dev`, `pnpm build`, `pnpm typecheck`, `pnpm test` are unavailable. README and contributors must know per-app filter commands.

**Fix:** Add a root `package.json` with workspace scripts for dev/build/typecheck/test/lint.

### 4.2 [HIGH] Lint is not working in CI-friendly mode

**Evidence:**

- Backend lint fails with `eslint: command not found`.
- Storefront lint prompts interactively for ESLint setup.

**Impact:** CI cannot enforce lint, and style/quality gates are not meaningful.

**Fix:**

1. Add ESLint config for storefront and backend.
2. Add missing ESLint dependencies where needed.
3. Add lint step to CI.

### 4.3 [HIGH] Dependency vulnerabilities: 95 total

**Audit summary:** `95 vulnerabilities found — 5 low | 47 moderate | 34 high | 9 critical`.

**Impact:** Includes Next/Sanity/Vite/Sendgrid/deepmerge-related advisories from the lockfile. Not all are directly exploitable, but 9 critical findings should be triaged before public launch.

**Fix:**

1. Run `pnpm audit --prod`.
2. Prioritize critical/high.
3. Upgrade or replace vulnerable transitive dependencies.
4. Re-run audit after upgrade.

### 4.4 [HIGH] Git history contains a previously committed secret

**Evidence:** Current working tree no longer contains the hardcoded token, but earlier commits did. The working `.env.example`, `docker-compose.yml`, and docs no longer include it.

**Impact:** Any token that was ever committed must be treated as exposed.

**Fix:** Rotate/revoke the previously committed Sanity token and any related JWT/cookie secrets.

### 4.5 [HIGH] Checkout is honest but not production-complete

**Evidence:** Checkout saves delivery details to Medusa cart via server action, but does not create an order or payment.

**Impact:** Customers can start checkout, but cannot complete a purchase.

**Fix:** Finish Razorpay/medusa checkout flow or clearly label the store as preorder/contact-to-complete.

### 4.6 [HIGH] Seller portal is MVP, not a full creator portal

Current state:

- `/sell` marketing page exists.
- `/seller` dashboard exists.
- Application is stored in customer metadata.
- Commission list attempts backend fetch but the backend custom module is broken.

Missing:

- Portfolio uploads.
- Product submission workflow.
- Review status pipeline.
- Earnings/payout ledger UI.
- Approval/rejection email flow.
- Artist profile publish flow.

---

## 5. Medium findings

### 5.1 [MEDIUM] SEO metadata only exists in two places

**Evidence:**

```text
apps/storefront/app/layout.tsx
apps/storefront/app/design-system/page.tsx
```

**Missing:**

- Product page title/description/Open Graph.
- Shop/collection metadata.
- Artist metadata.
- Sanity/article metadata.
- Canonical URLs per page.
- JSON-LD Product schema.
- Dynamic sitemap products.

**Fix:** Add `generateMetadata` for product/artist/article routes and dynamic sitemap entries.

### 5.2 [MEDIUM] Sitemap is static and incomplete

Current sitemap includes home, shop, art-forms, artists, custom-art, journal, about, policies.

Missing:

- Individual products.
- Individual artists.
- Journal articles.
- `/sell`, `/design-system` intentionally not included.

**Fix:** Fetch products/artists at sitemap generation time.

### 5.3 [MEDIUM] Robots.txt is good but needs maintenance

Current robots disallow:

- `/account`
- `/cart`
- `/checkout`
- `/commission-status/`

It allows the public site and references sitemap. Good for MVP.

**Check before launch:** Ensure staging uses `noindex` if needed and production robots point to the production sitemap URL.

### 5.4 [MEDIUM] No `next/image` usage

**Evidence:** All artwork uses raw `<img>` tags. Count of `next/image` usage: `0`.

**Impact:**

- No responsive image sizing.
- No automatic optimization.
- Worse LCP on mobile.

**Fix:** Convert artwork and product images to `next/image`, with `remotePatterns` for Medusa and Sanity hosts.

### 5.5 [MEDIUM] All Medusa catalog fetches are `no-store`

**Evidence:** `apps/storefront/lib/medusa.ts` uses `cache: "no-store"`, and most pages are `force-dynamic`.

**Impact:** No ISR/static caching for public catalogue/editorial pages; every request hits the backend.

**Fix:**

- Keep cart/checkout/account/auth private with dynamic rendering.
- Add `revalidate` for catalog, artists, journal, product pages where safe.

### 5.6 [MEDIUM] No Content-Security-Policy header

Current headers:

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy`
- `Permissions-Policy`
- HSTS in production

Missing:

- Content-Security-Policy.

**Fix:** Add CSP after GA/Sanity/font/script requirements are known.

### 5.7 [MEDIUM] `console.log` and `any` hygiene

- `console.log` count: `31`, mostly backend subscribers/webhook handlers.
- `: any` count: `177`, mostly Medusa types and legacy modules.

**Impact:** Log noise and weak type safety.

**Fix:** Replace backend `console.log` with structured logging. Tighten `any` in storefront and custom modules.

### 5.8 [MEDIUM] `dangerouslySetInnerHTML` exists in three places

**Evidence:** `apps/storefront/app/layout.tsx` has three uses.

**Impact:** Low, because they inject JSON.stringify structured data and GA config. Still, any future dynamic content must not be injected unsafely.

**Fix:** Keep only static JSON-LD, avoid user-controlled HTML, and consider CSP to reduce risk.

### 5.9 [MEDIUM] Auth is server-side but incomplete

Current auth:

- Register/login via Medusa `/auth/customer/emailpass`.
- JWT stored in httpOnly cookie.
- Account dashboard reads `/store/customers/me`.
- Recent orders from `/store/orders`.

Missing:

- Email verification.
- Password reset.
- MFA.
- Address book CRUD.
- Order detail route.
- Order tracking route.
- Account preferences.

---

## 6. Design system and colour audit

### 6.1 Current direction

The site now uses an Indian-craft-inflected palette:

- Ivory `#F4EFE6`
- Paper `#F7F2E8`
- Surface `#FFFDF8`
- Ink `#221F1A`
- Madder `#A63D2F`
- Indigo `#1F2A44`
- Haldi `#D9A441`
- Peacock `#1E6F6A`
- Rose `#9C3F63`
- Sage `#6F7F5B`
- Gold `#B8860B`
- Border `#D8CCB8`

Typography:

- Cormorant Garamond for editorial headings.
- Manrope for body/UI.

Reusable UI:

- `Button`
- `Card`
- `Badge`
- `Input`
- `Textarea`
- `Select`
- `Section`
- `Container`
- `SectionHeading`

### 6.2 User feedback: “needs more colours”

The palette is still intentionally restrained for a gallery/craft-studio feel. The user requested more colour.

**Recommended next pass:**

1. Add optional festive accent tokens:
   - Kumkum rose
   - Turmeric amber
   - Peacock teal
   - Mango-leaf green
   - Indigo dusk
   - Terracotta clay
   - Sandstone
   - Brass
2. Add colour-coded collection tiles by art form.
3. Add festival/occasion themes: Diwali, Pongal, Ganesh Chaturthi, Eid, Christmas, wedding season.
4. Add colour-coded stock/availability badges:
   - Ready to ship: peacock.
   - Made to order: haldi.
   - Custom only: madder.
   - New: rose.
5. Add motif textures:
   - Jaali lattice.
   - Block-print repeat.
   - Lotus border.
   - Paisley (mango motif).
   - Rangoli accents.
6. Add `/design-system` swatches for the new tokens.

### 6.3 Accessibility notes

Positive:

- All `<img>` tags reviewed include `alt` text.
- Forms mostly use `<label htmlFor>`.
- Header has accessible menu button with `aria-expanded`, `aria-controls`, and `aria-label`.
- Quantity buttons use `aria-label`.
- Focus outlines exist on primary controls.

Remaining work:

- Run keyboard-only traversal test.
- Run axe/Lighthouse accessibility audit.
- Confirm contrast for muted text on paper in dark mode.
- Add visible focus styles to all interactive elements.
- Test mobile menu focus trapping/escape.

---

## 7. Backend audit

### 7.1 Healthy parts

- Migrations apply successfully.
- Link sync is up-to-date.
- Medusa core Store API works for products/regions.
- Customer auth works: register/login/me.
- Backend `/health` is healthy.
- TypeScript compiles.
- 26 commission-state tests pass.

### 7.2 Broken custom modules

Affected:

- `/store/artists`
- `/store/artists/:slug`
- `/store/commissions`
- `/store/commissions/:referenceId`
- Admin artists/commissions/ledger/partner/audit routes.

**Primary issue:** Legacy service pattern does not match Medusa v2 runtime module registration/metadata.

### 7.3 Migrations fixed

Custom migration files were converted from string exports to `Migration` classes. `db:migrate` passes. Duplicate older migration files were removed.

### 7.4 Seed data missing

There is no working seed script. `apps/backend/data/seed.json` exists, but there is no `src/scripts/seed.ts`.

**Fix:** Implement a seed script that creates:

- INR region.
- Sales channel.
- Publishable key.
- Product categories.
- Sample products.
- Artists.
- Commission demo data.

---

## 8. Storefront audit

### 8.1 Working

- Home, shop, art forms, artists, custom art, sell, seller, account, cart, checkout, design system, journal, about, policies, product detail, commission status.
- Cart is cookie-backed and uses Medusa server actions.
- Checkout saves delivery details to Medusa.
- Product links use handles.
- Product card shows price/availability.
- Product page has gallery, price, description, stock type, add-to-cart.

### 8.2 Needs work

- Product page needs metadata and structured data.
- Shop needs filters/sort/search UX beyond `q`.
- Journal is a Sanity placeholder.
- About/policies are static MVP copy.
- Checkout cannot complete payment.
- Seller dashboard is MVP.
- No search autocomplete.
- No wishlist.
- No reviews/ratings.
- No related products.
- No image zoom.
- No variant selection UI.
- No personalization fields.
- No order tracking page.
- No address book UI.

### 8.3 Image handling

All six `<img>` locations were checked. Alt text is present, but images are unoptimized.

Locations:

- `apps/storefront/app/products/[handle]/page.tsx`
- `apps/storefront/app/artists/page.tsx`
- `apps/storefront/app/artists/[slug]/page.tsx`
- `apps/storefront/app/page.tsx`
- `apps/storefront/components/product-card.tsx`

Artist images use `/images/artists/${portrait_media_id}.jpg`, which is not a real public asset path. This will 404 when artists exist.

**Fix:** Use `portrait_media_id` as a URL, or map it to a public asset that actually exists.

---

## 9. Customer and seller portal audit

### 9.1 Customer portal

Built:

- `/account/register`
- `/account/login`
- `/account`
- Logout
- Profile summary
- Recent orders

Missing:

- Order detail.
- Address CRUD.
- Password reset.
- Email verification.
- Commission request list in account.
- Wishlist.
- Preferences.

### 9.2 Seller portal

Built:

- `/sell` landing page.
- `/seller` dashboard.
- Application form.
- Application metadata stored on customer.
- Commission list attempt.

Missing:

- Requirements/terms page.
- Uploads.
- Review pipeline.
- Payouts.
- Product management.
- Approval workflow.
- Notifications.

---

## 10. CI/CD and infrastructure audit

### 10.1 CI workflow

Current CI:

- Installs dependencies.
- Typechecks backend/storefront.
- Runs backend tests.
- Builds storefront.
- Deploys backend Docker image to ECR/ECS.
- Deploys storefront via Vercel.

Missing:

- Lint.
- Root scripts.
- Storefront tests.
- Backend Docker build in CI.
- Migration check.
- Security audit gate.
- Preview environments.

### 10.2 Docker

Positive:

- Storefront standalone layout fixed.
- Backend Docker build uses repo-root context.
- Compose uses `http://backend:9000` for server-side.
- Storefront container healthy.

Risks:

- Backend image contains build deps / source.
- No migration job on deploy.
- No secrets manager integration.
- No CDN/WAF.
- No observability.

### 10.3 Terraform

Terraform exists but was not deeply audited in this pass.

Check before production:

- ECS service definition.
- ALB/HTTPS.
- RDS/ElastiCache.
- ECR.
- Secrets.
- WAF.
- CloudWatch alarms.

---

## 11. Tests

### Backend

Passing:

- `tests/commission-state-machine.test.ts` — 26 tests.

Missing:

- API route tests.
- Auth tests.
- Cart/checkout tests.
- Commission workflow tests.
- Provider webhook tests.
- Integration tests against Medusa.

### Storefront

Current script:

```json
"test": "playwright test"
```

But no Playwright config/tests were verified.

Missing:

- Smoke tests for home/shop/product/cart.
- Auth tests.
- Mobile accessibility tests.
- Visual regression tests.

---

## 12. Documentation audit

### Positive

- `README.md` includes setup and named commands.
- Build plan exists.
- Design system page exists.

### Missing

- Audit report was missing until this file.
- No runbook for production deploy.
- No seed/catalogue setup guide.
- No seller onboarding SOP.
- No payment/shipping test checklist.
- No `DATABASE_URL`, migration, and rollback procedure.

---

## 13. Recommended remediation order

### P0 — before launch

1. Rotate exposed secrets.
2. Fix custom Medusa modules.
3. Seed region/products/artists.
4. Fix artist image URL mapping.
5. Complete real checkout payment flow.
6. Add root `package.json`.
7. Fix lint.
8. Triage critical/high vulnerabilities.
9. Add `<img>` → `next/image` or explicit optimization.
10. Add page-level SEO metadata and product structured data.

### P1 — before beta

1. Add address book and order detail/tracking.
2. Add seller application review pipeline.
3. Add CMS journal rendering.
4. Add search filters/sort.
5. Add related products.
6. Add migration job in deployment pipeline.
7. Add CSP.
8. Add structured logging.
9. Add Playwright smoke tests.
10. Expand design system colours/motifs.

### P2 — growth

1. Wishlist.
2. Reviews.
3. Festival/occasion collections.
4. Corporate gifting.
5. Workshops.
6. Marketplace vendor model.
7. Analytics dashboards.
8. Performance budget and Lighthouse CI.
9. Visual regression tests.
10. More Devanagari/regional language support.

---

## 14. Positive findings to preserve

- Storefront Docker startup bug is fixed.
- `.dockerignore` no longer blocks public assets.
- `.env.example` no longer contains a hardcoded token.
- Security headers are present.
- Auth cookies are httpOnly and secure in production.
- Publishable key is server-side.
- Sanity public client does not expose the token.
- GA ID is env-driven.
- Robots/sitemap exclude transactional pages.
- TypeScript compiles for backend/storefront.
- Backend tests pass.
- Docker Compose is healthy.

---

## 15. Evidence snapshot

### Dependency audit

```text
95 vulnerabilities found
Severity: 5 low | 47 moderate | 34 high | 9 critical
```

### Database counts

```text
products          | 0
regions           | 0
customers         | 1
publishable links | 1
```

### Backend errors

```text
GET /store/artists → 500 — Could not resolve 'artistModuleService'
POST /store/commissions → 500 — Could not resolve 'commissionModuleService'
```

### Storefront performance markers

- No `next/image` usage.
- Most catalog pages use `force-dynamic`.
- Medusa client uses `cache: "no-store"`.
- First Load JS from build is around 101 KB shared.

---

## 16. Final verdict

The project is a good staging/beta skeleton with a clear Indian-authentic brand system and a working storefront shell. It is **not production-complete** because the catalogue is empty, custom backend features are runtime-broken, payments are not real, and lint/vulnerability/SEO/image issues remain.

**Next best move:** Fix the custom Medusa modules and seed a small real catalogue; that unlocks artists, commissions, seller portal, SEO, and confidence for the next design iteration.
