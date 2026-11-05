# Next.js storefront Dockerfile (production-grade)
FROM node:24-alpine AS builder

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@12 --activate

# Install build tools needed to compile native modules (sharp, esbuild, next
# platform binaries, msgpackr-extract, etc.)
RUN apk add --no-cache python3 make g++

# Copy npmrc + pnpmfile (allows dependency build scripts required by pnpm supply-chain policy)
COPY .npmrc ./
COPY pnpmfile.js ./

# Copy workspace files for dependency installation
COPY pnpm-workspace.yaml ./
COPY turbo.json ./
COPY pnpm-lock.yaml ./

# Copy package manifests for all workspace members
COPY apps/storefront/package.json ./apps/storefront/package.json
COPY packages/ui/package.json ./packages/ui/package.json
COPY packages/types/package.json ./packages/types/package.json
COPY packages/config-tailwind/package.json ./packages/config-tailwind/package.json

# Install dependencies (frozen lockfile for reproducible builds)
RUN pnpm approve-builds core-js medusa-telemetry && pnpm install --frozen-lockfile

# Copy source code
COPY apps/storefront ./apps/storefront
COPY packages/ui ./packages/ui
COPY packages/types ./packages/types
COPY packages/config-tailwind ./packages/config-tailwind

# Build the storefront (Next.js standalone output)
WORKDIR /app/apps/storefront
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
RUN pnpm run build

FROM node:24-alpine AS runtime

WORKDIR /app

# Install pnpm for runtime
RUN corepack enable && corepack prepare pnpm@12 --activate

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Create pnpm wrapper script
RUN if [ ! -f ./pnpm-wrapper ]; then echo '#!/bin/sh\nexec pnpm "$@"' > ./pnpm-wrapper && chmod +x ./pnpm-wrapper; fi

# Environment variables (overridden at runtime)
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV NEXT_PUBLIC_MEDUSA_BACKEND_URL="http://localhost:9000"
ENV NEXT_PUBLIC_STOREFRONT_URL="http://localhost:3000"
ENV NEXT_PUBLIC_SANITY_PROJECT_ID=""
ENV NEXT_PUBLIC_SANITY_DATASET="production"
ENV NEXT_PUBLIC_SANITY_API_VERSION="2026-01-01"

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

USER nextjs

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/ || exit 1

CMD ["node", "-r", "./pnpm-wrapper", "./pnpm-wrapper", "./standalone/server.js"]
