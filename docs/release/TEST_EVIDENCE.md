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

_To be appended after each wave._
