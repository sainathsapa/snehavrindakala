# ADR-0003: Architecture and data ownership

## Status
Proposed

## Context
The plan (Sections 7, 8, 10) defines a modular monolith on Next.js + Medusa v2 + PostgreSQL + Redis + Sanity, with custom Medusa modules for artists, partners, commissions, and the payout ledger.

## Decision
- Modular monolith, not microservices; split services only when measured load/team ownership justifies it.
- Medusa owns commerce records (products, variants, prices, carts, orders, inventory).
- Custom modules own artist/partner/commission/ledger records, linked to commerce entities via Medusa module links (no duplicated product/order tables).
- Sanity owns editorial content; refers to Medusa artist/product IDs rather than duplicating operational data.
- PostgreSQL is the durable system of record; Redis is cache/workflow infrastructure only.
- Separate deployable apps in one monorepo: storefront, backend, studio, infra, packages/ui, packages/types, packages/config.

## Consequences
- No second product/inventory database.
- No custom payment vault or card-data handler.
- No generic cart/order engine rebuilt from scratch.
- Media stored in S3/CloudFront, not PostgreSQL.
