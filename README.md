# SnehaVrinda Kala

> **A home for art in all its forms — made, curated, personalized, and shared by creators.**

SnehaVrinda Kala is an art-first creative-commerce platform: ready-to-ship artwork, handmade products, made-to-order pieces, custom commissions, artist profiles, and creative kits — built on a custom Next.js + Medusa v2 + Sanity stack.

---

## 🎨 The Vision

Every art has a place.

We believe in making the maker visible — artist profile, practice, materials, technique, and process. Custom requests are treated as a real product journey (brief → quote → create → approve → deliver), not a generic contact form. Curated variety under one coherent brand system, with educational content that makes art easier to discover and appreciate.

---

## 🏗️ Architecture

| Layer | Technology | Role |
|---|---|---|
| **Storefront & customer portal** | Next.js App Router + React + TypeScript | SEO-friendly website, product discovery, checkout, customer account, commission tracking |
| **Commerce backend** | Medusa v2 + Node.js + TypeScript | Products, variants, pricing, carts, promotions, customers, orders, inventory |
| **Custom business backend** | Medusa custom modules, workflows, API routes, subscribers | Artists, partners, commissions, approvals, production milestones, payout ledger |
| **Database** | PostgreSQL | System-of-record for commerce and custom business data |
| **Cache / workflow infra** | Redis | Caching, event/workflow infrastructure, locks, async work |
| **Editorial CMS** | Sanity (project `1ifsr3lr`, dataset `production`) | Journal, tutorials, campaign pages, homepage content, artist stories |
| **Media / file storage** | Amazon S3 + CloudFront | Product media, public assets, protected customer reference uploads |
| **Payments** | Razorpay (Medusa payment provider) | UPI/cards/net banking, payment/refund lifecycle |
| **Shipping** | Shiprocket API | Shipment creation, courier selection, labels, tracking, NDR/returns |
| **Hosting** | Vercel Pro + AWS ECS Fargate | Storefront on Vercel (Mumbai `bom1`); backend on AWS Mumbai (`ap-south-1`) |
| **CI/CD** | GitHub Actions | Version control, tests, build, controlled deployment |
| **IaC** | Terraform | Repeatable AWS environments |
| **Package management** | pnpm workspaces + Turborepo | Monorepo dependency/build management |

---

## 📁 Repository Structure

```
snehavrinda-kala/
├── apps/
│   ├── storefront/   # Next.js public store, customer & artist portal
│   ├── backend/      # Medusa v2 server + custom business modules
│   └── studio/       # Sanity Studio (editorial content)
├── packages/
│   ├── ui/           # Shared design system & components
│   ├── types/        # Shared API/domain types
│   └── config-*      # Shared lint/TypeScript/Tailwind config
├── infra/
│   └── terraform/    # AWS infrastructure (VPC, RDS, Redis, ECS, S3, CloudFront)
├── docs/
│   ├── adr/          # Architecture Decision Records
│   ├── design-system/
│   ├── operations/   # Runbooks
│   └── security/     # Security baseline
├── .github/workflows/# CI/CD pipelines
├── docker-compose.yml # Local dev: Postgres, Redis, Backend, Storefront
└── SnehaVrinda_Kala_Full_Build_Plan.md  # Full business & engineering blueprint
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js ≥ 20
- pnpm ≥ 12
- Docker & Docker Compose

### 1. Clone & Install
```bash
git clone https://github.com/sainathsapa/snehavrindakala.git
cd snehavrindakala
pnpm install
```

### 2. Environment
```bash
cp .env.example .env
# Fill in your credentials (test keys first for Razorpay/Shiprocket)
```

### 3. Start Local Stack
```bash
docker compose up -d
```
This starts PostgreSQL, Redis, the Medusa backend (port 9000), and the Next.js storefront (port 3000).

### 4. Seed Data
Seed the backend with launch catalogue data:
```bash
pnpm --filter @snehavrinda-kala/backend run seed
```

---

## 🛠️ Development

| Command | What it does |
|---|---|
| `pnpm dev` | Start all apps in dev mode |
| `pnpm build` | Build all apps for production |
| `pnpm typecheck` | TypeScript check across all packages |
| `pnpm lint` | ESLint across all packages |
| `pnpm test` | Run test suites |

### Backend
```bash
cd apps/backend
pnpm run dev      # Medusa develop (port 9000)
pnpm run build    # Production build
pnpm run test     # Vitest unit tests (commission state machine, etc.)
```

### Storefront
```bash
cd apps/storefront
pnpm run dev      # Next.js dev (port 3000)
pnpm run build    # Production build
```

### Sanity Studio
```bash
cd apps/studio
pnpm run dev      # Sanity Studio (editorial CMS)
```

---

## 🧭 Core Business Flows

### Standard Product Order
1. Customer discovers product → adds to cart
2. Medusa calculates cart, promotions, delivery, payment session
3. Razorpay payment created → customer pays
4. **Server-side verification** — order marked paid only after Razorpay callback confirmation (never trust a browser redirect)
5. Shiprocket shipment created when dispatch-ready
6. Customer gets tracking updates

### Custom Commission Request
1. Customer submits brief + reference uploads
2. Admin reviews feasibility, artist availability, rights
3. Versioned quote prepared (scope, timeline, deposit/milestone rules)
4. Customer accepts quote → pays through Medusa order flow
5. Artist works against milestone plan → private proofs uploaded
6. Customer approves or requests in-scope revision
7. Final payment collected → item quality-checked, packed, shipped, tracked

**Commission status machine:** `New → Needs clarification → Feasibility review → Awaiting artist/capacity → Quote drafted → Quote sent → Awaiting payment → Accepted → In production → Proof review → Approved → Ready to dispatch → Shipped → Completed`

---

## 🔐 Security

- JWT & cookie secrets configured (never committed to Git)
- Razorpay webhook signatures validated via HMAC-SHA256 over raw body
- Integration event ledger for idempotent webhook processing
- Private customer reference uploads in protected S3 with signed URLs
- Audit trail for security-sensitive operations (price changes, refunds, payouts)
- PostgreSQL & Redis in private subnets; secrets in AWS Secrets Manager

---

## 📦 Deployment

### Local
```bash
docker compose up -d
```

### Production (AWS Mumbai)
Infrastructure is defined in `infra/terraform/`:
- VPC with public/private subnets across 2 AZs
- RDS PostgreSQL (Multi-AZ), ElastiCache Redis
- ECS Fargate cluster with ALB
- S3 buckets (public media + private uploads), CloudFront CDN
- Secrets Manager for sensitive configuration

CI/CD via GitHub Actions: lint → typecheck → test → build → deploy.

---

## 📚 Build Plan

The full business, product, design, architecture, engineering, operations, security, and production-launch blueprint is in:

**`SnehaVrinda_Kala_Full_Build_Plan.md`**

This covers:
- Executive recommendation & technology decision
- Brand positioning, customer groups, category architecture
- Competitor research & differentiation
- Data ownership & domain model (Medusa + custom modules)
- Customer & operations workflows (orders, commissions, artist onboarding)
- Integration architecture (Razorpay, Shiprocket, Sanity, social)
- SEO, performance, security, compliance (GST, DPDP Act, Consumer Protection Rules)
- Hosting, infrastructure, reliability
- Testing, CI/CD, release management
- Day-zero-to-production execution plan (phases 0–11)
- Production operations checklists
- Launch metrics & risk mitigations

---

## 🤝 Contributing

1. Create a feature branch from `main`
2. Commit changes with descriptive messages
3. Open a pull request; all checks (lint, typecheck, test, build) must pass
4. Protect `main` — production deployments require review and approval

---

> **Note:** This is a custom platform built on a commerce framework — not a demo storefront and not an attempt to code an entire commerce engine from scratch. Launch first with a curated, centrally managed commerce model and real custom-commission workflow.

---

*Built with terracotta, indigo, and saffron. 🎨*
