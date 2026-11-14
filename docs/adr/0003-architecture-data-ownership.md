# ADR-0003: Architecture and data ownership

## Status
Proposed

## Context
The plan (Sections 7, 8, 10) defines a modular monolith on Next.js + Medusa v2 + PostgreSQL + Redis + Sanity, with custom Medusa modules for artists, partners, commissions, and the payout ledger.

## Decision
- Modular monolith, not microservices; split services only when measured load/team ownership justifies it.
- Medusa owns commerce records (products, variants, prices, carts, orders, inventory).
- Custom modules own artist/partner/commission/ledger records, linked to commerce entities via Medusa module links (no duplicated product/order tables).
- Editorial content (hero slides, art forms, featured categories, journal) lives in PostgreSQL tables managed through the storefront's own admin panel at `/admin`. There is no separate CMS: products live in Medusa, everything else in these tables, so the admin is the single place to edit the site.
- PostgreSQL is the durable system of record; Redis is cache/workflow infrastructure only.
- Separate deployable apps in one monorepo: storefront, backend, infra, packages/ui, packages/types, packages/config.

> The Sanity Studio app was removed. It was never wired into the stack — it
> pointed at a placeholder projectId and nothing imported it, so it documented a
> content model the site did not actually use.

## Consequences
- No second product/inventory database.
- No custom payment vault or card-data handler.
- No generic cart/order engine rebuilt from scratch.
- Media stored in S3/CloudFront, not PostgreSQL.
