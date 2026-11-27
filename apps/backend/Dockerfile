# Medusa v2 backend Dockerfile (production-grade)

# ── base: install linux node_modules ──────────────────────────────────────────
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
COPY package.json ./
COPY pnpm-workspace.yaml ./
COPY pnpm-lock.yaml ./

# Only the backend is needed in this image (it imports no workspace packages).
COPY apps/backend/package.json ./apps/backend/package.json

# Install dependencies (frozen lockfile for reproducible builds)
RUN pnpm approve-builds core-js medusa-telemetry && pnpm install --frozen-lockfile --ignore-scripts

# ── build: compile backend + admin into ./dist ───────────────────────────────
FROM base AS build

WORKDIR /app/apps/backend

# Copy backend source (.dockerignore excludes node_modules/dist, so the
# linux node_modules installed in `base` is preserved intact).
COPY apps/backend/ ./

# Runtime credential gate. Lives at the repository root so the storefront image
# can use the same file; copied here because this stage only ships apps/backend.
# The destination must be ABSOLUTE: this stage's WORKDIR is /app/apps/backend, so
# a relative destination would place the script where the entrypoint cannot find
# it (it looks in /app/scripts/security) and the container would fail to start.
COPY scripts/security/verify-runtime-secrets.mjs /app/scripts/security/verify-runtime-secrets.mjs

# Medusa build → dist/ (backend server + admin UI in dist/public/admin)
#
# The heap ceiling is set explicitly. Node derives its default old-space limit from
# the host's total memory and container limits, and on a 2 GB build box that limit
# sat below what this build needs: it aborted with "Ineffective mark-compacts near
# heap limit" (exit 134) after 76 seconds, while the same build succeeds on a laptop
# with no flag at all. 1536 MB fits inside a 2 GB box with the OS and Postgres on it.
ARG BUILD_HEAP_MB=1536
ENV NODE_OPTIONS="--max-old-space-size=${BUILD_HEAP_MB}"
RUN pnpm exec medusa build && apk del python3 make g++

# ── runtime: minimal production image ──────────────────────────────────────────
FROM node:24-alpine AS runtime

WORKDIR /app/apps/backend

# pnpm's node_modules are symlinks relative to the workspace root
# (/app/node_modules + /app/apps/backend/node_modules), so we must copy
# the whole workspace — symlink resolution breaks if we copy only part.
COPY --from=build /app /app

# Tests are not part of a runtime image.
#
# The whole workspace is copied because pnpm's node_modules are symlinks into
# /app/node_modules, so a partial copy breaks resolution. That also copied
# `apps/backend/tests`, which ships certification-adjacent code and fixtures into
# every production image and shows up in credential scans. They are removed here
# so the artifact contains only what the server needs.
RUN rm -rf /app/apps/backend/tests /app/apps/backend/coverage /app/node_modules/.cache

# medusa start serves the admin UI from <root>/public/admin. The build
# emits to dist/public/admin, so move it next to the backend root.
RUN mkdir -p /app/apps/backend/public/admin && \
    cp -r /app/apps/backend/dist/public/admin/. /app/apps/backend/public/admin/

# Create non-root user
RUN addgroup --system --gid 1001 medusa && \
    adduser --system --uid 1001 medusa && \
    chown -R medusa:medusa /app

# Non-secret defaults only.
#
# These used to include `ENV JWT_SECRET=""` and `ENV COOKIE_SECRET=""` (plus the
# Razorpay/Shiprocket/SES credentials) so that "the image documents the env it
# wants". That is actively dangerous: an image-level default is inherited by the
# container and nothing forces the orchestrator to override it, so a deployment
# that missed one started successfully with an empty signing key. Secret names
# are documented in .env.example; the values arrive at runtime from the
# orchestrator's secret store, and docker-entrypoint.sh refuses to start when a
# required one is missing or a placeholder (scripts/security/verify-runtime-secrets.mjs).
ENV MEDUSA_BACKEND_URL="http://localhost:9000"
ENV MEDUSA_ADMIN_URL="http://localhost:9000/app"
ENV STORE_CORS="http://localhost:3000"
ENV ADMIN_CORS="http://localhost:7000,http://localhost:3000"
ENV AUTH_CORS="http://localhost:3000"
ENV SANITY_DATASET="production"
ENV AWS_REGION="ap-south-1"
ENV NODE_ENV="production"

EXPOSE 9000

WORKDIR /app/apps/backend

USER medusa

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:9000/health || exit 1

# Entrypoint waits for Postgres, applies migrations, syncs module links, then
# execs `medusa start`. A migrated database is the difference between "the
# containers are up" and "the shop works".
CMD ["sh", "/app/apps/backend/docker-entrypoint.sh"]
