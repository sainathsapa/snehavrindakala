# ADR-0004: Hosting and infrastructure

## Status
Proposed

## Context
The plan (Section 16) recommends Vercel Pro for the Next.js storefront and AWS ECS Fargate for the Medusa backend/workers, with PostgreSQL (RDS), Redis (ElastiCache), S3, CloudFront, in AWS Mumbai (`ap-south-1`).

## Decision
- Storefront: Vercel Pro, Mumbai (`bom1`) region where applicable.
- Backend/workers: AWS ECS Fargate, `ap-south-1` (Mumbai), behind ALB.
- Database: Amazon RDS PostgreSQL (private subnets, automated backups, Multi-AZ for production).
- Cache: Amazon ElastiCache Redis.
- Media: S3 + CloudFront (separate public/private buckets/prefixes).
- Secrets: AWS Secrets Manager / Parameter Store.
- DNS/certs: Route 53 / ACM.
- IaC: Terraform, versioned, reviewed changes.
- Environments: development (local Docker), staging (production-like), production (live keys, approval-gated).

## Consequences
- Hyderabad (`ap-south-2`) to be evaluated before provisioning for service availability and pricing.
- Region kept as infrastructure configuration, not hard-coded application logic.
- Commercial Vercel plan required for production (not free/personal plan).
