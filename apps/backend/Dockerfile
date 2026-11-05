# Medusa v2 backend Dockerfile (production-grade)
FROM node:24-alpine AS base

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@12 --activate

# Install build tools needed to compile native modules
RUN apk add --no-cache python3 make g++

# Copy npmrc + pnpmfile (allows dependency build scripts)
COPY .npmrc ./
COPY pnpmfile.js ./

# Copy workspace files for dependency installation
COPY pnpm-workspace.yaml ./
COPY pnpm-lock.yaml ./

# Only the backend is needed in this image (it imports no workspace packages).
COPY apps/backend/package.json ./apps/backend/package.json

# Install dependencies (frozen lockfile for reproducible builds)
RUN pnpm approve-builds core-js medusa-telemetry && pnpm install --frozen-lockfile

# Remove build tools to reduce image size
RUN apk del python3 make g++

FROM base AS runtime

WORKDIR /app/apps/backend

# Copy application source. node_modules/dist are excluded via .dockerignore so the
# linux node_modules installed in the `base` stage is preserved intact.
COPY apps/backend/ ./

# Create non-root user
RUN addgroup --system --gid 1001 medusa && \
    adduser --system --uid 1001 medusa

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

# Production server (no file watching / HMR).
CMD ["node", "server.js"]
