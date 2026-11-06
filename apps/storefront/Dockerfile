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

RUN pnpm install --frozen-lockfile

FROM deps AS builder

WORKDIR /app

COPY apps/storefront ./apps/storefront
COPY packages/ui ./packages/ui
COPY packages/types ./packages/types
COPY packages/config-tailwind ./packages/config-tailwind

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV NEXT_STANDALONE=true

WORKDIR /app/apps/storefront

RUN pnpm run build

FROM node:24-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

# Copy the complete standalone tree. In a pnpm monorepo the server lives at
# apps/storefront/server.js and its node_modules symlinks point at the
# workspace root, so the directory layout must be preserved.
COPY --from=builder --chown=nextjs:nodejs /app/apps/storefront/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/storefront/.next/static ./apps/storefront/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/storefront/public ./apps/storefront/public

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/ || exit 1

CMD ["node", "apps/storefront/server.js"]
