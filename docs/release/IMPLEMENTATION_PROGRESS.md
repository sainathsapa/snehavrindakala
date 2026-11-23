# Implementation progress (master tracker)

Statuses: NOT STARTED · IN PROGRESS · REVIEW REQUIRED · BLOCKED BY EXTERNAL INPUT ·
FAILED TEST · COMPLETED AND VERIFIED. Only AGENT 00 sets COMPLETED AND VERIFIED.

| ID | Priority | Owner | Status | Evidence / notes |
|---|---|---|---|---|
| SEC-01 | P0 | AGENT 00 | COMPLETED AND VERIFIED | `lib/session-secret.ts` shared chain; prod fail-closed; test in `rbac-session.test.ts` |
| SEC-02 | P0 | AGENT 00 | COMPLETED AND VERIFIED | Middleware uses shared secret, compares seconds correctly, no cookie-presence bypass |
| SEC-03 | P0 | AGENT 00 | COMPLETED AND VERIFIED | `requirePermission` on 12 API routes + 22 server actions; static + matrix tests |
| SEC-04 | P1 | AGENT 00 | COMPLETED AND VERIFIED | `getDefaultSuperAdminEmail()` no default; `.env.example` password default removed |
| SEC-05 | P1 | AGENT 00 | COMPLETED AND VERIFIED | Last trusted XFF hop, IP+account key, kill switch disabled in prod |
| SEC-06 | P2 | AGENT 00 | COMPLETED AND VERIFIED | `lib/audit.ts`; wired to refund decisions + admin-user create/update/delete |
| PAY-01..03 | P0/P1 | AGENT 02 | NOT STARTED | Sandbox creds needed for E2E (see blockers) |
| INV-01 | P0 | AGENT 03 | NOT STARTED | Atomic reservation; cart/checkout surface |
| NOT-01 | P1 | AGENT 04 | NOT STARTED | Duplicate confirmation email |
| NOT-02 | P2 | AGENT 04 | NOT STARTED | Outbox retry/status |
| GST-01 | P1 | AGENT 05 | NOT STARTED | GST/seller config validation |
| GST-02 | P1 | AGENT 05 | BLOCKED BY EXTERNAL INPUT | GSTIN/HSN/legal identity — owner/CA |
| REF-01/02 | P0 | AGENT 06 | BLOCKED BY EXTERNAL INPUT | Sandbox Razorpay creds to execute |
| SHIP-01 | P1 | AGENT 08 | BLOCKED BY EXTERNAL INPUT | Shiprocket token/webhook |
| PART-01..03 | P0 | AGENT 07 | BLOCKED BY EXTERNAL INPUT | Commission/payout/accounting rules |
| SEO-01/02 | P1 | AGENT 09 | NOT STARTED | Canonicals + hreflang |
| ANA-01 | P1 | AGENT 10 | NOT STARTED | Consent + 5 events |
| LEG-01/02 | P2 | AGENT 10 | NOT STARTED | Cookie policy + data export |
| DB-01 | P2 | AGENT 11 | NOT STARTED | Lazy DDL → migrations |
| CI-01 | P2 | AGENT 11 | NOT STARTED | CI/health/CSP |
| QA-01 | P0 | AGENT 12 | NOT STARTED | Scenarios A–H |

## Wave gates
- Wave 0 baseline: PASS (90 + 433 tests green).
- Wave 1 gate: PASS — typecheck clean, 445/449 tests green (4 pre-existing skips).
- Integration gate: full `pnpm test` + `pnpm typecheck` + `next build` after each wave.
