# SnehaVrinda Kala

<div align="center">

```svg
<svg width="600" height="120" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 120">
  <defs>
    <linearGradient id="brandGradient" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:#B96545;stop-opacity:1" />
      <stop offset="50%" style="stop-color:#D8A441;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#343C67;stop-opacity:1" />
    </linearGradient>
    <filter id="glow">
      <feGaussianBlur stdDeviation="2.5" result="coloredBlur"/>
      <feMerge>
        <feMergeNode in="coloredBlur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>

  <!-- Decorative diya (lamp) motif -->
  <g transform="translate(40, 40)">
    <path d="M20,40 Q30,20 40,40 Q30,60 20,40 Z" fill="url(#brandGradient)" filter="url(#glow)"/>
    <circle cx="30" cy="35" r="6" fill="#FFF" opacity="0.9">
      <animate attributeName="r" values="6;7;6" dur="3s" repeatCount="indefinite"/>
      <animate attributeName="opacity" values="0.9;1;0.9" dur="3s" repeatCount="indefinite"/>
    </circle>
    <path d="M25,40 L35,40" stroke="#F7F4ED" stroke-width="2" stroke-linecap="round">
      <animate attributeName="stroke-dasharray" values="0 20; 20 0" dur="2s" repeatCount="indefinite"/>
    </path>
  </g>

  <!-- Brand wordmark -->
  <text x="110" y="55" font-family="'Cormorant Garamond', serif" font-size="42" font-weight="700" fill="url(#brandGradient)" letter-spacing="2">
    SnehaVrinda
  </text>
  <text x="110" y="95" font-family="'Manrope', sans-serif" font-size="18" fill="#6B6862" letter-spacing="4">
    A home for art in all its forms
  </text>

  <!-- Rangoli-inspired decorative dots -->
  <circle cx="520" cy="40" r="3" fill="#B96545" opacity="0.8">
    <animate attributeName="opacity" values="0.4;1;0.4" dur="2s" repeatCount="indefinite"/>
  </circle>
  <circle cx="540" cy="80" r="3" fill="#D8A441" opacity="0.8">
    <animate attributeName="opacity" values="0.4;1;0.4" dur="2.5s" repeatCount="indefinite"/>
  </circle>
  <circle cx="500" cy="100" r="3" fill="#343C67" opacity="0.8">
    <animate attributeName="opacity" values="0.4;1;0.4" dur="2s" repeatCount="indefinite"/>
  </circle>
</svg>
```

</div>

---

## 🎨 The Vision

**SnehaVrinda Kala** — Every art has a place.

An art-first creative-commerce platform where the maker stays visible. Ready-to-ship artwork, handmade décor, made-to-order pieces, custom commissions, artist profiles, and creative kits — built on a custom **Next.js + Medusa v2 + Sanity** stack, rooted in Indian craft traditions and designed for a global audience.

> _Not a marketplace on day one. A curated, centrally managed creative brand with a real custom-commission workflow — brief → quote → create → approve → deliver._

---

```svg
<svg width="100%" height="60" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 60" preserveAspectRatio="none">
  <defs>
    <linearGradient id="borderGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:#B96545;stop-opacity:0.6" />
      <stop offset="50%" style="stop-color:#343C67;stop-opacity:0.4" />
      <stop offset="100%" style="stop-color:#D8A441;stop-opacity:0.6" />
    </linearGradient>
  </defs>
  <path d="M0,30 Q250,10 500,30 T1000,30" fill="none" stroke="url(#borderGrad)" stroke-width="3"/>
  <path d="M0,30 Q250,50 500,30 T1000,30" fill="none" stroke="url(#borderGrad)" stroke-width="1" opacity="0.4"/>
</svg>
```

---

## 🏛️ The Stack

<div align="center">

| Layer | Technology | Role |
|---|---|---|
| **Storefront & customer portal** | Next.js App Router + React + TypeScript | SEO-friendly website, product discovery, checkout, customer account |
| **Commerce backend** | Medusa v2 + Node.js + TypeScript | Products, variants, pricing, carts, orders, inventory |
| **Custom business backend** | Medusa custom modules, workflows, API routes | Artists, partners, commissions, milestones, payout ledger |
| **Database** | PostgreSQL | System-of-record |
| **Cache / workflow** | Redis | Caching, events, locks |
| **Editorial CMS** | Sanity (`1ifsr3lr` / `production`) | Journal, tutorials, artist stories |
| **Payments** | Razorpay | UPI / cards / net banking |
| **Shipping** | Shiprocket API | Courier, labels, tracking |
| **Hosting** | Vercel Pro + AWS ECS Fargate | Mumbai region (`ap-south-1`) |
| **IaC** | Terraform | Repeatable AWS infrastructure |
| **Package manager** | pnpm + Turborepo | Monorepo |

</div>

---

## 📁 Repository

```
snehavrinda-kala/
├── apps/
│   ├── storefront/   # Next.js public store & customer portal
│   ├── backend/      # Medusa v2 + custom business modules
│   └── studio/       # Sanity Studio (editorial)
├── packages/
│   ├── ui/           # Shared design system (terracotta · indigo · saffron)
│   ├── types/        # Shared API/domain types
│   └── config-*      # Lint / TypeScript / Tailwind config
├── infra/
│   └── terraform/    # AWS Mumbai infrastructure
├── docs/
│   ├── adr/          # Architecture Decision Records
│   ├── operations/   # Runbooks
│   └── security/     # Security baseline
├── .github/workflows/# CI/CD pipelines
├── docker-compose.yml # Local dev stack
└── SnehaVrinda_Kala_Full_Build_Plan.md  # Full business blueprint
```

---

## 🚀 Getting Started

### Prerequisites
Node.js ≥ 20 · pnpm ≥ 12 · Docker & Docker Compose

### 1. Clone
```bash
git clone https://github.com/sainathsapa/snehavrindakala.git
cd snehavrindakala
```

### 2. Environment
```bash
cp .env.example .env
```
Fill in your Razorpay, Shiprocket, Sanity, and AWS credentials. Test keys first.

### 3. Start the Local Stack
```bash
docker compose up -d
```
This brings up **PostgreSQL**, **Redis**, the **Medusa backend** (port 9000), and the **Next.js storefront** (port 3000).

### 4. Seed the Catalogue
```bash
pnpm --filter @snehavrinda-kala/backend run seed
```

---

## 🧭 Core Flows

### Standard Product Order
1. Discover → add to cart
2. Medusa calculates cart, promotions, delivery
3. Razorpay payment session created
4. **Server-side verification** — order marked paid only after Razorpay callback confirmation
5. Shiprocket shipment created when dispatch-ready
6. Customer receives tracking

### Custom Commission (The Heart)
```
Brief → Feasibility Review → Quote → Accept → Pay → Create → Proofs → Approve → Deliver
```

Commission status machine:
`New → Needs clarification → Feasibility review → Awaiting artist/capacity → Quote drafted → Quote sent → Awaiting payment → Accepted → In production → Proof review → Approved → Ready to dispatch → Shipped → Completed`

---

## 🎨 Design Tokens

| Token | Hex | Use |
|---|---|---|
| **Terracotta** | `#B96545` | Primary brand accent |
| **Indigo** | `#343C67` | Secondary accent, collections |
| **Saffron** | `#D8A441` | Small highlights |
| **Sage** | `#78856B` | Supporting, natural |
| **Paper** | `#F7F4ED` | Warm background |
| **Ink** | `#242321` | Primary text |
| **Border** | `#E4DED3` | Dividers |

Typography: **Cormorant Garamond** (editorial headings) · **Manrope** (body, forms, commerce UI)

---

## 🛠️ Development

| Command | What it does |
|---|---|
| `pnpm dev` | Start all apps |
| `pnpm build` | Build all apps |
| `pnpm typecheck` | TypeScript strict check |
| `pnpm lint` | ESLint |
| `pnpm test` | Vitest + Playwright |

**Backend** (port 9000): `pnpm --filter @snehavrinda-kala/backend run dev`
**Storefront** (port 3000): `pnpm --filter @snehavrinda-kala/storefront run dev`

---

## 🔐 Security

- JWT & cookie secrets configured (never committed)
- Razorpay webhooks validated via HMAC-SHA256 over raw body
- Integration event ledger for idempotent processing
- Private customer uploads in protected S3 with signed URLs
- Audit trail for price changes, refunds, payouts
- PostgreSQL & Redis in private subnets

---

## 🇮🇳 Launch Scope (Production)

- Custom Next.js storefront, mobile-responsive, SEO-optimized
- Medusa commerce backend/admin: products, inventory, carts, orders
- Sanity CMS for editorial content
- Razorpay payments with server verification
- Shiprocket shipping with tracking
- Custom commission request → quote → milestone → delivery workflow
- Partner application & artist profile foundation
- Role permissions, audit trail, transactional email
- Policies, privacy, GST/tax process, operational runbooks

---

## 📦 Deploy

### Local
```bash
docker compose up -d
```

### Production (AWS Mumbai)
Infrastructure defined in `infra/terraform/` — VPC, RDS Multi-AZ, ElastiCache, ECS Fargate, ALB, S3, CloudFront, Secrets Manager, CloudWatch.

CI/CD via GitHub Actions: lint → typecheck → test → build → deploy.

---

## 📚 Full Build Plan

The complete business, product, design, engineering, operations, security, and production-launch blueprint:

**`SnehaVrinda_Kala_Full_Build_Plan.md`**

---

<div align="center">

```svg
<svg width="100%" height="40" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 40">
  <defs>
    <linearGradient id="footerGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:#343C67;stop-opacity:1" />
      <stop offset="50%" style="stop-color:#B96545;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#343C67;stop-opacity:1" />
    </linearGradient>
  </defs>
  <text x="500" y="28" font-family="'Cormorant Garamond', serif" font-size="16" fill="url(#footerGrad)" text-anchor="middle" letter-spacing="3">
    SnehaVrinda Kala — Art made, curated, personalized, and shared
  </text>
</svg>
```

</div>
