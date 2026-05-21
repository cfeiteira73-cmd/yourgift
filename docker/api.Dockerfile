# ── Stage 1: builder ────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

# Install pnpm
RUN npm install -g pnpm@9

WORKDIR /app

# Copy monorepo root manifests first (layer cache)
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./

# Copy workspace package manifests
COPY packages/shared/package.json ./packages/shared/
COPY integrations/midocean/package.json ./integrations/midocean/
COPY services/api/package.json ./services/api/

# Install all dependencies (frozen to match lockfile exactly)
RUN pnpm install --frozen-lockfile

# Copy full source
COPY packages/shared ./packages/shared
COPY integrations/midocean ./integrations/midocean
COPY services/api ./services/api
COPY tsconfig.base.json ./

# Build shared package first (midocean and api depend on it)
RUN pnpm --filter @yourgift/shared run build

# Build midocean integration (api depends on it)
RUN pnpm --filter @yourgift/midocean run build

# Generate Prisma client (must happen before nest build)
RUN cd services/api && npx prisma generate --schema ./prisma/schema.prisma || true

# Build NestJS API
RUN pnpm --filter api run build

# ── Stage 2: production ──────────────────────────────────────────────────────
FROM node:20-alpine AS production

ENV NODE_ENV=production

# Install dumb-init for proper signal handling in containers
# Install openssl so Prisma can detect OpenSSL 3.x version at runtime
# (without it, Prisma defaults to openssl-1.1.x and fails to load the engine)
RUN apk add --no-cache dumb-init openssl

WORKDIR /app

# Root node_modules (pnpm .pnpm store + hoisted packages + workspace symlinks)
COPY --from=builder /app/node_modules ./node_modules

# Workspace packages — pnpm symlinks in node_modules point to these paths.
# @yourgift/shared:  /app/node_modules/@yourgift/shared → /app/packages/shared
# @yourgift/midocean: /app/node_modules/@yourgift/midocean → /app/integrations/midocean
COPY --from=builder /app/packages/shared ./packages/shared
COPY --from=builder /app/integrations/midocean ./integrations/midocean

# Keep api in its ORIGINAL path so pnpm symlinks resolve correctly:
# Node resolves modules from /app/services/api/dist/main.js upward:
#   → /app/services/api/node_modules  (api direct deps)
#   → /app/node_modules               (pnpm .pnpm store)
COPY --from=builder /app/services/api/dist ./services/api/dist
COPY --from=builder /app/services/api/node_modules ./services/api/node_modules
COPY --from=builder /app/services/api/package.json ./services/api/package.json

# Copy Prisma schema + generated client (needed at runtime)
COPY --from=builder /app/services/api/prisma ./services/api/prisma

# Copy startup script at root for convenience
COPY --from=builder /app/services/api/start.sh ./start.sh
RUN chmod +x ./start.sh

# Non-root user for security
RUN addgroup -g 1001 -S nodejs && adduser -S nestjs -u 1001
RUN chown nestjs:nodejs /app/start.sh
USER nestjs

EXPOSE 3001

# Use dumb-init to handle PID 1 signals correctly
ENTRYPOINT ["dumb-init", "--"]
CMD ["sh", "start.sh"]

# .dockerignore (place at repo root as docker/.dockerignore or repo-root .dockerignore):
#   node_modules
#   .next
#   .git
#   *.log
#   .env
#   .env.*
#   dist
#   coverage
#   **/*.test.ts
#   **/*.spec.ts
