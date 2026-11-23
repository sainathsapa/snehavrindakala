# Test evidence

All commands run from repo root on branch `remediation/production-readiness`.

## Baseline — 2026-11-23 (before changes)

```
pnpm --filter @snehavrinda-kala/backend typecheck   PASS (clean)
pnpm --filter @snehavrinda-kala/backend test        PASS 90/90 (6 files)
pnpm --filter @snehavrinda-kala/storefront typecheck PASS (clean)
pnpm --filter @snehavrinda-kala/storefront test     PASS 433/437 (4 skipped, 44 files)
```

Evidence captured in session transcript 2026-11-23 14:54 UTC.

## Wave 1 evidence — 2026-11-23

Implemented SEC-01..SEC-06. Exact results:

```
pnpm --filter @snehavrinda-kala/storefront typecheck   PASS (clean)
pnpm --filter @snehavrinda-kala/storefront test        PASS 445/449 (4 skipped, 45 files)
```

New/changed tests:
- `tests/rbac-session.test.ts` (11 tests): role matrix (viewer cannot write
  products / approve refunds; finance cannot manage products/users; support
  requests but cannot approve; unknown roles denied), session sign/verify
  roundtrip + tamper + expiry, shared-secret chain, production fail-closed.
- `tests/api-auth.test.ts` (was 7, now 8 tests): static assertion that the 7
  most sensitive mutation routes call `requirePermission` with the right perm.
- Existing 433 baseline tests all still pass (no regressions).

Notes:
- `deployment-env.test.ts` initially FAILED because the first draft referenced
  `ADMIN_SESSION_SECRET`, which is absent from Docker Compose. Fixed by
  removing that broken variable from the chain entirely (COOKIE_SECRET/JWT_SECRET
  only) — this is the same variable that caused the original middleware mismatch.
- Backend tests (90) unchanged and still green.

## Integration / regression evidence

### Wave 2 — notifications, GST, SEO, analytics (commit `99f4dcd`)
```
backend typecheck   PASS
backend test        PASS 101/101 (7 files; +11 dedupe tests)
storefront typecheck PASS
storefront test     PASS 494/498 (4 skipped, 50 files)
```

### Wave 2 — inventory (commit `1ca0144`)
```
storefront typecheck PASS
storefront test     PASS 503/507 (4 skipped, 51 files; +9 inventory tests)
```

### Wave 2 — payments (commit `13510a5`)
```
storefront test     PASS 510/514 (4 skipped, 52 files; +7 payment-guard tests)
```

### Wave 4 — invoice gating (commit `23b85a1`)
```
storefront test     PASS 513/517 (4 skipped, 53 files; +3 invoice-gst tests)
```

### Wave 3 — shipping webhook (commit `8653c66`)
```
storefront test     PASS 519/523 (4 skipped, 54 files; +6 shipping-webhook tests)
```

### Full monorepo verification (final, HEAD `270d0c8`)
```
pnpm typecheck   Tasks: 4 successful, 4 total (turbo 2.11.10)
pnpm test        storefront: Test Files 54 passed (54); Tests 519 passed | 4 skipped (523)
                 backend:    Test Files 7 passed (7);  Tests 101 passed (101)
pnpm build       Tasks: 2 successful, 2 total — Next.js + Medusa builds completed
```

### Build note
Backend `medusa build` emits a harmless `ts-node cannot be loaded ... set NODE_ENV
to production` warning from the CLI but completes "Backend build completed
successfully". Storefront build emits the full route table including
`/api/webhooks/shiprocket` and the new cron/admin routes.

### Not executed (and why)
- Live Razorpay sandbox purchase/webhook/refund: no sandbox credentials.
- Live Shiprocket callback: no webhook token.
- Playwright E2E scenarios A–H: no running Medusa/Postgres/Shiprocket stack.
- Real SES send: no verified sender/credentials (outbox correctly records `skipped`).
- These are honest blockers, not green claims. See `RELEASE_BLOCKERS.md`.
