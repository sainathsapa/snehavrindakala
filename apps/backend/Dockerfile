# Medusa v2 backend Dockerfile (production-grade)
# Build: docker build -t snehavrinda-backend . --build-arg NODE_ENV=production
FROM node:24-alpine AS builder

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@12 --activate

# Copy workspace files for dependency installation
COPY pnpm-workspace.yaml ./
COPY turbo.json ./
COPY package.json ./
COPY pnpm-lock.yaml ./

# Copy package manifests for all workspace members (for hoisting)
COPY apps/backend/package.json ./apps/backend/package.json
COPY apps/storefront/package.json ./apps/storefront/package.json
COPY apps/studio/package.json ./apps/studio/package.json
COPY packages/ui/package.json ./packages/ui/package.json
COPY packages/types/package.json ./packages/types/package.json
COPY packages/config-eslint/package.json ./packages/config-eslint/package.json
COPY packages/config-typescript/package.json ./packages/config-typescript/package.json
COPY packages/config-tailwind/package.json ./packages/config-tailwind/package.json

# Install dependencies (production only for backend build)
RUN pnpm install --frozen-lockfile

# Copy source code
COPY apps/backend ./apps/backend
COPY packages/ui ./packages/ui
COPY packages/types ./packages/types
COPY packages/config-eslint ./packages/config-eslint
COPY packages/config-typescript ./packages/config-typescript
COPY packages/config-tailwind ./packages/config-tailwind

# Build the backend
WORKDIR /app/apps/backend
RUN pnpm run build

# Remove dev dependencies to keep image small
RUN pnpm prune --prod

# Runtime stage
FROM node:24-alpine AS runner

WORKDIR /app

# Install pnpm for runtime
RUN corepack enable && corepack prepare pnpm@12 --activate

# Create non-root user
RUN addgroup --system --gid 1001 medusa && \
    adduser --system --uid 1001 medusa

# Copy built backend
COPY --from=builder --chown=medusa:medusa /app/apps/backend/dist ./dist
COPY --from=builder --chown=medusa:medusa /app/apps/backend/node_modules ./node_modules
COPY --from=builder --chown=medusa:medusa /app/apps/backend/package.json ./package.json
COPY --from=builder --chown=medusa:medusa /app/apps/backend/tsconfig.json ./tsconfig.json
COPY --from=builder --chown=medusa:medusa /app/apps/backend/medusa-config.ts ./medusa-config.ts

# Copy shared packages
COPY --from=builder --chown=medusa:medusa /app/packages/ui ./packages/ui
COPY --from=builder --chown=medusa:medusa /app/packages/types ./packages/types

# Environment variables (overridden at runtime)
ENV DATABASE_URL=""
ENV REDIS_URL=""
ENV MEDUSA_BACKEND_URL="http://localhost:9000"
ENV MEDUSA_ADMIN_URL="http://localhost:9000/app"
ENV STORE_CORS="http://localhost:3000"
ENV ADMIN_CORS="http://localhost:7000,http://localhost:3000"
ENV AUTH_CORS="http://localhost:3000"
ENV JWT_SECRET=""
ENV COOKIE_SECRET=""
ENV RAZORPAY_KEY_ID=""
ENV RAZORPAY_KEY_SECRET=""
ENV RAZORPAY_WEBHOOK_SECRET=""
ENV SHIPROCKET_API_TOKEN=""
ENV SHIPROCKET_EMAIL=""
ENV SHIPROCKET_PASSWORD=""
ENV SANITY_PROJECT_ID=""
ENV SANITY_DATASET="production"
ENV SANITY_API_TOKEN=""
ENV AWS_REGION="ap-south-1"
ENV NODE_ENV="production"

EXPOSE 9000

USER medusa

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:9000/health || exit 1

CMD ["pnpm", "run", "start"]
