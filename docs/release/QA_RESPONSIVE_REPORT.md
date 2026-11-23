# QA responsive report — partner portal UI (AGENT A102)

> Branch: `remediation/final-go`
> Owner: AGENT A102 (QA)
> Date: 2026-11-23
> Status: **static verification DONE (20/20 passing). Live browser + two-partner-session verification NOT RUN — BLOCKED BY OWNER INPUT.**

## 0. Honesty statement

This report separates two things that are easy to blur:

- **Proven statically** — assertions over the source that pass with no browser,
  no database and no credentials. These are real, reproducible checks in
  `apps/storefront/tests/qa-partner-ui.test.ts` (run:
  `cd apps/storefront && npx vitest run tests/qa-partner-ui.test.ts` →
  **20 passed**).
- **Needs live verification** — rendering at real viewports and cross-session
  isolation. No such check was executed, no browser was launched and no partner
  session was created. These are **BLOCKED BY OWNER INPUT** (stack + two real
  partner identities). A skipped/unrun check is an honest `NOT VERIFIED`, never
  a pass.

Per the shared contract I did **not** run `pnpm test`, `pnpm typecheck` or any
pnpm-wide command; only my single test file was executed.

## 1. Files owned / created

| File | Purpose |
|---|---|
| `apps/storefront/tests/qa-partner-ui.test.ts` | 20 static + pure assertions (created) |
| `docs/release/QA_RESPONSIVE_REPORT.md` | This report (created) |

No other file was edited.

## 2. What is proven statically (PASS — 20/20)

### 2.1 Design-system usage, not invented inline styles
- No partner page uses inline `style={{…}}` objects, raw hex colours (`#RRGGBB`)
  or raw `rgb()/hsl()` colour literals.
- The brand tokens the pages rely on (`rang-paper`, `surface`, `deep-ink`,
  `muted-ink`, `sand-border`, `sindoor`, `terracotta`) are all defined in
  `packages/config-tailwind`, which `tailwind.config.js` spreads as the single
  source of truth.
- The login page and shell use those tokens through named Tailwind utilities
  (`bg-rang-paper`, `bg-surface`, `text-deep-ink`, `text-muted-ink`,
  `border-sand-border`, `text-sindoor`, `font-serif`, `font-sans`).
- The nav and header import `Icon` from the shared `@snehavrinda-kala/ui`
  package rather than bespoke SVG/markup.
- The component primitives (`btn-primary`, `btn-outline`, `btn-link`, `section`,
  `section-tight`, `shell`) are safelisted so a page can adopt them without a
  missing-style regression.

Note: three small arbitrary sizing utilities (`text-[10px]`, `text-[11px]`) exist
in the nav/header. These are **Tailwind utilities**, not inline CSS or invented
colours, so they are allowed by the check. They are called out here for
transparency; the project has named `caption`/`body` steps in the config that
could replace them in a later naming pass, but that is not a gate for this mission.

### 2.2 Nav lists all 14 required sections
The sidebar declares exactly 14 distinct partner routes and 14 labels, grouped
under the five headings (Workspace, Catalogue, Fulfilment, Finance, Account):

Overview, Notifications, Business profile, Products, Product submissions,
Inventory, Orders, Shipments, Customers, Earnings, Commission statements,
Settlements, Team, Security.

Every section except the universally-available Notifications link is gated by a
`partnerHasPermission(role, item.permission)` check — visibility is driven by the
signed-in role, not by a hard-coded per-user section list.

The test pins the **14 named sections** and that each resolves to a partner route,
while accepting either a dedicated `/partner/submissions` route or the
`/partner/products?status=all` surface. The catalogue agent folded "Product
submissions" into the products list via a query parameter; see the observation
in §4.

### 2.3 Responsive utility classes present in the shell
- Layout: `md:pl-64` (full-width mobile → fixed sidebar at `md`), plus `sm:px-6`
  and `lg:px-8` on the content region.
- Nav: real mobile drawer with `md:hidden`, `md:translate-x-0` and a
  `matchMedia("(min-width: 768px)")` breakpoint listener; open/close buttons
  carry `aria-label`s.
- Header: `sm:block` / `sm:hidden` content swap plus `sm:px-6` / `md:px-8`.

These are static presence checks; they prove the classes and breakpoint logic
exist in source, **not** that they render correctly at a real viewport (§5).

### 2.4 No fabricated credentials or mock records
- Login inputs start empty (`useState("")`); no email or password is prefilled.
- No partner file assigns a literal credential, embeds a mock/dummy/fixture/
  demo record, invents a GSTIN, or hard-codes a commission rate or stock count.

### 2.5 Login separated from admin auth
- The sign-in form posts only to `/api/partner/auth/login` and contains no
  `/api/admin`, `/admin/login` or `verifyAdminSession` reference.
- The shell gate uses `requirePartnerContext()` from `@/lib/partner/context`,
  never the admin `requirePermission` / `@/app/admin/actions` / `@/lib/admin`.
- Partner and admin sessions are distinct contexts: different cookie names
  (`svk_partner_session` vs `svk_admin_session`), different signing namespaces
  (`svk:partner-session:v1`), and neither module references the other's verifier
  or secret.
- The auth screens (`/partner/login`, `/partner/reset`, `/partner/logout`) are
  listed as public so signing out / resetting cannot redirect-loop, while
  protected sections are not; unauthenticated visitors redirect to `/partner/login`.
- A pure path-normalisation check confirms trailing slashes and query strings are
  stripped before the public-path test, so `/partner/login?next=…` is public and
  `/partner`, `/partner/products`, `/admin/login` are not.

## 3. Pure checks (no I/O)

The path-normalisation classification in §2.5 is a pure function replicated from
the layout's documented logic. It needs no request scope, headers or database,
and is asserted directly in the test file.

## 4. Observations (non-blocking, for the Lead)

- **Product submissions active state.** The nav item now uses
  `href: "/partner/products?status=all"`. The nav's active-state logic compares
  `usePathname()` (which excludes the query string) against the full `href`, so
  this item's `aria-current="page"` / highlight will never activate. This is a
  cosmetic issue in a file owned by the catalogue agent; I did not edit it. The
  section itself is present and reachable, so it does not fail the 14-section
  gate. Recommend the nav compare on the path portion (split off `?`) in a
  follow-up owned by that agent.
- No other design-system, credential, responsive or auth-separation defect was
  found statically.

## 5. Needs a real browser — BLOCKED BY OWNER INPUT

A browser is required to confirm what static presence cannot:

| Check | Why static is insufficient | Gate |
|---|---|---|
| Sidebar renders and is usable at mobile (~375px) and desktop (≥768px) | Presence of `md:`/`sm:` classes does not prove the drawer opens, the overlay closes, or content reflows without clipping/overlap | no running stack / sandbox (`QA-STACK`) |
| Mobile menu toggle actually opens/closes on tap at <768px and resets at ≥768px | Depends on real `matchMedia`, pointer events and hydration | `QA-STACK` |
| No horizontal overflow / truncated critical text on narrow viewports at each of the 14 pages | Requires layout measurement | `QA-STACK` |
| Focus, `aria-current` and keyboard behaviour of nav + header | Requires a real DOM and assistive-tech semantics | `QA-STACK` |

None of the above was run. They map to the existing `QA_E2E_PLAN.md` scenarios and
remain **AUTHORED/NOT RUN → BLOCKED BY OWNER INPUT** until the stack exists.

## 6. Needs two partner sessions — BLOCKED BY OWNER INPUT

Cross-session facts that cannot be proven from source and were **not** tested:

- Two distinct partner memberships (partner A and partner B) signed in
  simultaneously, each seeing only its own catalogue, orders, inventory,
  earnings, shipments and customers (the tenant-isolation scenarios C/G in
  `QA_E2E_PLAN.md`).
- Role-filtered nav actually hides finance/team/security links for a viewer or
  finance member in the rendered UI (source shows the filter, but the rendered
  outcome per real membership needs sessions).
- Partner cookie cannot authenticate an admin route, and an admin cookie cannot
  authenticate the partner portal, at runtime.

These require owner-supplied partner identities and credentials
(`OWNER-PARTNER`, `E2E_PARTNER_*` env names in `QA_E2E_PLAN.md`), a seeded
fixture service and a running stack. **No credential or partner identity value
was fabricated**; none appears in the test or this report. Until those inputs
exist and AGENT 00 independently re-runs the live specs and records evidence,
these items are **BLOCKED BY OWNER INPUT** and must not be marked PASS.

## 7. Assumptions

- The "14 required sections" are the 14 named sidebar sections listed in §2.2.
- The catalogue agent's `?status=all` folding of Product submissions is an
  intentional, in-scope design decision; the test therefore accepts it rather
  than failing on the exact href.
- `@snehavrinda-kala/ui`, the Tailwind config and the partner/auth modules are
  owned and committed by other agents; this work builds on them without
  modification.
- The static test intentionally scans source only; it cannot detect a runtime
  regression introduced by future edits to files it does not own, so it should
  be re-run by the Lead during integration.
