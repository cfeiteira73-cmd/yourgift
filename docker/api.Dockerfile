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
RUN apk add --no-cache dumb-init

WORKDIR /app

# Copy only the compiled output and runtime dependencies
COPY --from=builder /app/services/api/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/services/api/node_modules ./services/api/node_modules
COPY --from=builder /app/services/api/package.json ./package.json

# Copy Prisma schema + generated client (needed at runtime)
COPY --from=builder /app/services/api/prisma ./prisma

# Copy startup script
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
