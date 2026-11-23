# Agent assignments

Branch model: all agents work on `remediation/production-readiness`. Concurrent
agents own **disjoint file sets** (no two agents edit the same file). The Lead
reviews every diff before integration. Specialist analysis agents (read-only)
are listed first; implementation agents own the workstreams below.

## Read-only analysis (Wave 0) — COMPLETED

| Agent | Workstream | Output |
|---|---|---|
| Explore A | Auth, admin security, RBAC | Gap report in session `ses_df8469dfbffen5G5DmJXfC0iCV` |
| Explore B | Payments, refunds, ledger, finance | `ses_df8469dfaffeKV5IpjBJ189FsZ` |
| Explore C | Inventory, multi-partner marketplace | `ses_df8469df9ffe8bxUx3nBJeHiFd` |
| Explore D | Email/outbox, GST/invoices, config | `ses_df8469dedffefNgSONDSwM36ir` |
| Explore E | SEO, analytics, legal, DevOps, shipping | `ses_df8469decffeJhzUX09o26jSS0` |

## Implementation agents

### AGENT 00 — Lead Orchestrator / CTO (this agent)
- Owns: overall implementation, integration, tests, tracker, release report.
- Directly implements Wave 1 security work (highest severity) and reviews all.
- Files: `lib/admin-session.ts`, `lib/rbac.ts`, `middleware.ts`,
  `app/admin/actions.ts`, `app/api/admin/login/route.ts`, `lib/rate-limit.ts`,
  selected admin API routes, `docs/release/*`, new tests.

### AGENT 01 — Auth / RBAC (owned by AGENT 00 for Wave 1)
- Tasks: SEC-01..SEC-06. Acceptance: viewer cannot modify products/approve
  refunds at backend; invalid cookies cannot grant access; every role tested.

### AGENT 04/05 — Notifications + GST (implementation subagent, disjoint files)
- Files: `lib/outbox.ts`, `src/subscribers/order-payment.subscriber.ts`,
  `app/api/store/checkout/complete/route.ts`, `lib/config-status.ts`,
  `lib/tax-server.ts`, `.env.example`.
- Tasks: NOT-01, NOT-02, GST-01. Acceptance: single confirmation send; outbox
  retry/status; GST config validated & surfaced. **No fabricated GSTIN/HSN.**

### AGENT 09/10 — SEO + analytics + legal (implementation subagent, disjoint files)
- Files: `lib/seo.ts`, `app/[locale]/layout.tsx`, the 3 canonical-less pages,
  new consent component, `app/[locale]/policies/cookie/page.tsx`,
  `app/api/account/data/route.ts`, `messages/en.json`, `messages/hi.json`,
  `app/sitemap.ts`, `components/footer.tsx`.
- Tasks: SEO-01, SEO-02, ANA-01, LEG-01, LEG-02. Acceptance: correct canonicals,
  consent-gated analytics with 5 events, cookie policy, data export/erase.
  **Legal prose flagged for professional review, no invented identities.**

### Deferred / blocked workstreams (owner input or large surface — documented)
- AGENT 02 Payments: PAY-01..03 (needs sandbox creds to run E2E; code changes
  PAY-01 is safe but touches checkout — scheduled after Wave 1 review).
- AGENT 03 Inventory: INV-01 (real, but modifies cart+checkout; scheduled Wave 2).
- AGENT 06/07/08: refund execution, partner portal/tenant isolation, shipping
  sync — blocked on partner/commission/payout business rules and credentials.
- AGENT 11/12: DB-01, CI-01, full QA — Wave 5/6.

## Conflict-avoidance contract
- No agent edits `app/admin/actions.ts` or `middleware.ts` except AGENT 00.
- Subagents must not modify files outside their listed set; AGENT 00 verifies
  with `git diff --name-only` after each subagent completes.
