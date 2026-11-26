# Next.js storefront production image.
# Build from the repository root:
#   docker build -f apps/storefront/Dockerfile .

FROM node:24-alpine AS deps

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@12 --activate

# Native build tooling required while installing the workspace.
RUN apk add --no-cache python3 make g++

# Workspace metadata is needed so pnpm links workspace packages correctly.
COPY package.json ./
COPY .npmrc pnpmfile.js pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/storefront/package.json ./apps/storefront/package.json
COPY packages/ui/package.json ./packages/ui/package.json
COPY packages/types/package.json ./packages/types/package.json
COPY packages/config-tailwind/package.json ./packages/config-tailwind/package.json

RUN pnpm install --frozen-lockfile --ignore-scripts

FROM deps AS builder

WORKDIR /app

# NEXT_PUBLIC_* values are baked at build time. Pass them via
# docker-compose build args.
ARG NEXT_PUBLIC_STOREFRONT_URL=http://localhost:3000
ENV NEXT_PUBLIC_STOREFRONT_URL=$NEXT_PUBLIC_STOREFRONT_URL
ARG NEXT_PUBLIC_RAZORPAY_KEY_ID=
ENV NEXT_PUBLIC_RAZORPAY_KEY_ID=$NEXT_PUBLIC_RAZORPAY_KEY_ID
ARG NEXT_PUBLIC_GA_MEASUREMENT_ID=
ENV NEXT_PUBLIC_GA_MEASUREMENT_ID=$NEXT_PUBLIC_GA_MEASUREMENT_ID
ARG NEXT_PUBLIC_ZOHO_SALESIQ_CODE=
ENV NEXT_PUBLIC_ZOHO_SALESIQ_CODE=$NEXT_PUBLIC_ZOHO_SALESIQ_CODE

COPY apps/storefront ./apps/storefront
COPY packages/ui ./packages/ui
COPY packages/types ./packages/types
COPY packages/config-tailwind ./packages/config-tailwind
# Runtime credential gate, shared with the backend image.
COPY scripts/security/verify-runtime-secrets.mjs ./scripts/security/verify-runtime-secrets.mjs
# Documentation ships with the app so the design system is readable from the
# running container, not only from a developer checkout.
COPY docs ./docs

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV NEXT_STANDALONE=true

# Point the build at a database that does not exist.
#
# Several pages are force-dynamic but Next still evaluates module-level data
# helpers while collecting build traces, so the build container tries to open a
# Postgres connection. The helpers already fall back to their defaults (the
# storefront renders fine without content rows), but each attempt logs a full
# ECONNREFUSED stack, which buries real build errors and made a clean build
# look broken.
#
# Setting the URL to the loopback port 1 makes the failure immediate and
# identical on every machine, so the noise is predictable rather than
# depending on whether a stray local database happens to be listening. This is
# a build-time default only; the runner stage gets the real URL from compose.
ENV BUILD_TIME_DATABASE_URL=postgresql://build:build@127.0.0.1:1/build

WORKDIR /app/apps/storefront

RUN DATABASE_URL="$BUILD_TIME_DATABASE_URL" \
    SITE_CONTENT_QUIET=1 \
    pnpm run build

FROM node:24-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs \
  && mkdir -p /data/uploads \
  && chown -R nextjs:nodejs /data

# Copy the complete standalone tree. In a pnpm monorepo the server lives at
# apps/storefront/server.js and its node_modules symlinks point at the
# workspace root, so the directory layout must be preserved.
COPY --from=builder --chown=nextjs:nodejs /app/apps/storefront/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/storefront/.next/static ./apps/storefront/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/storefront/public ./apps/storefront/public
COPY --from=builder --chown=nextjs:nodejs /app/docs ./docs

# The schema, its runner and the start-up helpers ship with the image so a
# deploy can create the tables before serving. Without these files in the runner
# stage the app falls back to creating tables lazily on first request, which is
# the behaviour this migration exists to remove.
COPY --from=builder --chown=nextjs:nodejs /app/apps/storefront/db ./apps/storefront/db
COPY --from=builder --chown=nextjs:nodejs /app/apps/storefront/scripts ./apps/storefront/scripts
COPY --from=builder --chown=nextjs:nodejs /app/scripts/security ./scripts/security
COPY --from=builder --chown=nextjs:nodejs /app/apps/storefront/docker-entrypoint.sh ./apps/storefront/docker-entrypoint.sh

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/ || exit 1

# Migrate, resolve the Medusa identifiers the app cannot know at build time, then
# serve. The script uses `exec`, so the server is PID 1 and receives signals.
CMD ["sh", "apps/storefront/docker-entrypoint.sh"]
