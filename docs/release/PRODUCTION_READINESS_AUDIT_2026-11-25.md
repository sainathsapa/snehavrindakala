# Production & release readiness audit — 2026-11-25

Run against a full `docker compose up -d --build` stack on an empty-ish local
database, then against the built images. Every number here was measured on that
running system; the command that produces it is listed next to it.

**Verdict: NO-GO for public launch until the four owner-input items in §6 are
supplied.** The code, the containers and the customer journeys are in good
shape (0 broken sitemap URLs, 37/37 storefront E2E journeys green, 1669 unit
tests green, no secrets in the images). What is missing is business data the
shop is not allowed to invent: a verified sender address, a GSTIN, a refund
policy decision, and the partner identities that gate half the E2E suite.

---

## 1. What was broken and is now fixed (verified on the running stack)

| # | Severity | Problem | Fix | Verification |
|---|---|---|---|---|
| 1 | **Critical** | Both production images shipped real credentials: `.dockerignore` excluded only the *root* `.env`, so `COPY apps/storefront` / `COPY apps/backend` carried `apps/*/.env` into the image. `/app/apps/storefront/.env` held `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `JWT_SECRET`, `COOKIE_SECRET`, `DATABASE_URL`, SES keys, admin passwords, `SANITY_API_TOKEN`. | `.dockerignore` now ignores `.env` and `**/.env*` everywhere, keeping `.env.example`. Runtime values come from compose `environment:`. | `docker run … find /app -name .env` → **clean** on both images. Unit/E2E unchanged. |
| 2 | **High** | The partner portal answered **404 everywhere** on a production build: the next-intl middleware rewrote `/partner/*` onto `/[locale]/partner/*`, which only contains the two marketing pages. A maker could not reach `/partner/login` to sign in. | `middleware.ts` serves `/partner/*` directly (with `x-locale`/`x-pathname` stamped) while leaving the localized `/partner/apply` and `/partner/status` on next-intl. | `/partner/login` 200, `/partner/orders` 307 → login, `/partner/apply` 200; 3 new E2E tests pass. |
| 3 | **High** | The sitemap, the nav and `/art-forms` linked to five tradition pages (`madhubani`, `warli`, `pattachitra`, `gond`, `kalamkari`) that 404'd in both languages, because the page only accepted rows from `site_art_form` while the taxonomy lives in `lib/slugs.ts`. 10 sitemap URLs were 404. | `/art-forms/[slug]` falls back to the static taxonomy; a stored admin row still wins. | Sitemap crawl: **114/114 URLs return 200** (was 10 × 404). New E2E test asserts every tradition link resolves in both locales. |
| 4 | **High** | `artForm.alertHeading` / `artForm.alertBody` did not exist in either message bundle; next-intl only warns, so every tradition page rendered the raw key text. | Added both keys to `en.json` and `hi.json`. | No `MISSING_MESSAGE` in container logs; heading renders ("Be first to see a new Madhubani work"). |
| 5 | **High** | `/api/cron/release-reservations` and `/api/cron/reconcile-payments` had **no scheduler** anywhere in the repo, although `/admin/marketplace/reconciliation` tells operators a scheduled job runs them. Stock held by abandoned payment sessions was never released; a payment captured at Razorpay whose webhook never arrived was never recorded. | Two `ops`-profile compose services added, same bearer-token pattern as the existing cron containers; `docs/DEPLOY.md` corrected (it claimed the reminder job was "the only recurring job"). | `docker compose --profile ops up -d …` → `{"released":0}` and `{"total":0,…}` (both endpoints answered 200). |
| 6 | Medium | `next@15.5.28` carried three moderate advisories (incl. HttpOnly cookie exposure on Edge routes) — and CI's dependency gate was already red. | `next` bumped to `15.5.29` (advisories resolved), lockfile updated. | Typecheck + 1669 unit tests green; image rebuilt and running. |
| 7 | Medium | `/partner/apply` and `/partner/status` had **no `h1`** — `SectionHeading` hard-coded `h2`. | `SectionHeading` gained an `as` prop (default still `h2`); both pages pass `as="h1"`. | Each page now has exactly one `h1`. |
| 8 | Low | E2E suite was red on a correct shop: stale product handle (`wearable-art-pendant` → `art-pendant`), a raw-key test that matched image file names (`commission.jpg`), an address-form helper keyed to a removed layout, a `Pay .* now` regex that cannot match "Pay now", and a promo test requiring an unseeded `WELCOME10`. | Tests updated; the promo test now **skips with a reason** when the promotion is not configured instead of failing. | Full suite: **37 passed, 16 skipped, 0 failed**. |

## 2. Site data updated to the owner's address

`Snehavrinda Arts Works · Napasar Road, Near Ramdev Mandir, Ward No. 16,
Deshnok, Nokha, Bikaner, Rajasthan – 334801, India`

- `apps/storefront/lib/studio.ts` is now the single source: name, address lines,
  one-line form and `PostalAddress` parts.
- Footer renders the full postal address; JSON-LD `ArtGallery` carries
  `streetAddress`/`addressLocality`/`addressRegion`/`postalCode` + `legalName`.
- Messages `footer.place` → "Deshnok · Bikaner · Rajasthan" (hi: "देशनोक · बीकानेर · राजस्थान").
- `.env` / `.env.example`: `SELLER_LEGAL_NAME`, `SELLER_ADDRESS`, and
  **`SELLER_HOME_STATE=Rajasthan`** (it defaulted to *Karnataka*, which put every
  Rajasthan order on the IGST branch of the GST split). Checkout now shows
  "Includes CGST 2.5% + SGST 2.5%" for a Bikaner delivery.
- `scripts/seed-hindi-titles.mjs` re-keyed to the live `art-pendant` handle and
  run: 19 Hindi product titles written, so `/hi/products/…` no longer serves
  English titles.

## 3. Measured evidence

| Check | Command | Result |
|---|---|---|
| Storefront typecheck | `pnpm --filter …/storefront typecheck` | pass |
| Backend typecheck | `pnpm --filter …/backend typecheck` | pass |
| Storefront unit tests | `pnpm --filter …/storefront test` | 127 files, **1669 passed**, 4 skipped |
| Backend unit tests | `pnpm --filter …/backend test` | 7 files, **101 passed** |
| Storefront E2E (production image) | `E2E_BASE_URL=http://localhost:3000 npx playwright test --project=chromium` | **37 passed, 16 skipped, 0 failed** |
| Sitemap crawl | rewrite `https://snehavrinda.in` → localhost, GET every `<loc>` | **114/114 → 200** |
| Secrets in images | `docker run --rm … find /app -name .env` | **none** |
| Unauthenticated webhooks | POST razorpay/shiprocket/internal without secret | **401** each |
| Cron endpoints without secret | POST all four | **401** each |
| Admin gate | GET `/admin` signed out / signed in | 307 → login / 200 |
| Admin screens | 9 admin routes with cookie | all 200 |
| Storefront TTFB (local) | `/`, `/shop`, `/hi`, PDP | 28–260 ms |
| Commit secret scan | `node apps/storefront/scripts/secret-scan.mjs` | OK, 857 files |
| Container users | `docker exec … id` | backend `medusa` (1001), storefront `nextjs` (1001) |

## 4. Release blockers that remain in code/config

1. **CI dependency gate fails** — `node apps/storefront/scripts/audit-deps.mjs`
   reports 5 unexcepted advisories:
   - `tinypool` **critical** ×2 (dev-only, via vitest 3.2.6)
   - `postcss` **high** ×2 (build-time, via next/tailwind)
   - `zod` **high** (runtime, `zod@3.25.76` pulled by Medusa — patched only in ≥4.6.6)
   Fix = upgrade vitest/postcss (safe) and either upgrade Medusa's zod or add a
   time-boxed exception in `apps/storefront/scripts/audit-exceptions.json` with a
   justification for the backend-only exposure.
2. **`POSTGRES_PASSWORD` is empty in `.env`** — compose silently falls back to
   `medusa`. Fine on a laptop; on any host that is a default credential.
3. **No `error.tsx` / `global-error.tsx`** in the storefront: a render error in
   production shows the framework's default page, not the house's.
4. **No `/api/health`** — the storefront healthcheck fetches `/`, which is a
   full RSC render. It works, but it is a liveness probe pretending to be a
   readiness probe.
5. **Terraform is unverified** — `infra/terraform/*.tf` has never been planned
   (`terraform` is not installed here, no state, no `terraform validate` in CI).
6. **Single-node Redis, no HA** (documented by the team): a restart drops cached
   sessions and in-flight workflow state.
7. **In-process rate limiting** — correct for one container, not for two.
8. If these images were ever pushed to a registry, **the credentials in them
   must be treated as leaked and rotated** (Razorpay key + webhook secret,
   `JWT_SECRET`, `COOKIE_SECRET`, SES keys, admin passwords, Sanity token).
   `docs/release/CREDENTIAL_ROTATION_PLAN.md` is the checklist.

## 5. Deliberately off (documented, not defects)

- `CHECKOUT_RAZORPAY_PROVIDER=0` — the storefront creates and verifies the
  Razorpay order itself; the Medusa provider path stays off until one sandbox
  purchase has been run on it end to end.
- Backups, cart reminders, notification retries and the two new sweeps are all
  `ops`-profile: they do not start by default.
- Refunds are recorded and approved, never released, from the admin; money moves
  in the Razorpay dashboard by design.

## 6. Owner input still required (the actual launch gate)

| Item | Where it shows | Effect while missing |
|---|---|---|
| `FROM_EMAIL` + SES credentials (`AWS_SES_*`) | `/admin/settings` → Email: **missing** | order confirmations, quote emails, cart reminders are logged `skipped` and never sent |
| `SELLER_GSTIN`, `HSN_SAC_DEFAULT` (CA-approved) | Tax & invoicing: **partial** | no statutory GST invoice is issued |
| Refund policy approval (`REFUND_POLICY_APPROVED`) + `RETURN_WINDOW_DAYS` | owner-input status | returns window reported UNCONFIGURED |
| Partner legal identities / signed agreements | owner-input status | partner onboarding cannot complete; 16 E2E scenarios stay skipped |
| Confirmed product weights & dimensions | shipping | shipment creation relies on defaults |

Also confirm with the CA that **`SELLER_HOME_STATE=Rajasthan`** is right (it was
`Karnataka` by default) and decide whether `WELCOME10` should exist as a seeded
promotion — the E2E discount journey skips until it does.

## 7. Reproduce

```bash
cp .env.example .env            # fill the secrets
docker compose up -d --build    # postgres, redis, backend, storefront
docker compose --profile ops up -d cron notification-retry-cron \
  release-reservations reconcile-payments backup

pnpm --filter @snehavrinda-kala/backend test
pnpm --filter @snehavrinda-kala/storefront test
E2E_BASE_URL=http://localhost:3000 \
  pnpm --filter @snehavrinda-kala/storefront test:e2e

docker run --rm --entrypoint sh snehavrinda-kala-storefront:latest \
  -c 'find /app -maxdepth 4 -name ".env"'   # must print nothing
node apps/storefront/scripts/audit-deps.mjs # must pass before release
```
