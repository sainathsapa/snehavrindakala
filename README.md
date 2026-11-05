# SnehaVrinda Kala

Art-first creative-commerce platform built on **Next.js + Medusa v2 + PostgreSQL + Redis + Sanity CMS**.

## Architecture

| Layer | Technology |
|---|---|
| Storefront & customer portal | Next.js App Router + React + TypeScript |
| Commerce backend | Medusa v2 + Node.js + TypeScript |
| Custom business backend | Medusa custom modules, workflows, API routes, subscribers |
| Database | PostgreSQL |
| Cache / workflow infra | Redis |
| Editorial CMS | Sanity |
| Media / file storage | Amazon S3 + CloudFront |
| Payments | Razorpay (Medusa payment provider) |
| Shipping | Shiprocket API (custom fulfilment integration) |
| Hosting | Vercel Pro (storefront) + AWS ECS Fargate (backend) |
| Region | AWS Mumbai (`ap-south-1`) |
| CI/CD | GitHub Actions |
| IaC | Terraform |
| Package management | pnpm workspaces + Turborepo |

## Repository structure

```
apps/
  storefront/   # Next.js public store, customer & artist portal
  backend/      # Medusa v2 server + custom modules
  studio/       # Sanity Studio (editorial)
packages/
  ui/           # Shared design system & components
  types/        # Shared API/domain types
  config-*      # Shared lint/TypeScript/Tailwind config
infra/
  terraform/    # AWS infrastructure as code
docs/           # ADRs, design system, operations, security, launch
.github/workflows/  # CI/CD
```

## Getting started

1. Copy `.env.example` to `.env` and fill in values (variable names only, no real credentials committed).
2. Install dependencies: `pnpm install`
3. Start local services (PostgreSQL + Redis) via Docker Compose.
4. Run the dev stack: `pnpm dev`

## Build plan

See `SnehaVrinda_Kala_Full_Build_Plan.md` for the full business, product, design, engineering, operations, security, and production-launch blueprint.

## Development standards

- TypeScript strict mode; no broad `any` without a documented reason.
- ESLint + Prettier with consistent import rules.
- Zod runtime validation on all external input boundaries.
- All database changes through reviewed migrations.
- Secrets in environment/secret storage, never in Git.
- Feature branches and pull requests; protect `main`.
- Every business workflow has an owner, state diagram, failure path, and audit trail.
