# ── Stage 1: builder ────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

# Install pnpm
RUN npm install -g pnpm@9

WORKDIR /app

# Copy monorepo root manifests first (layer cache)
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./

# Copy workspace package manifests
COPY packages/shared/package.json ./packages/shared/
COPY services/api/package.json ./services/api/

# Install all dependencies (frozen to match lockfile exactly)
RUN pnpm install --frozen-lockfile

# Copy full source
COPY packages/shared ./packages/shared
COPY services/api ./services/api
COPY tsconfig.base.json ./

# Build shared package first (api depends on it)
RUN pnpm --filter @yourgift/shared run build

# Generate Prisma client (must happen before nest build)
RUN pnpm --filter @yourgift/api exec prisma generate || \
    cd services/api && npx prisma generate || true

# Build NestJS API
RUN pnpm --filter @yourgift/api run build

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

# Copy Prisma schema + generated client (needed at runtime)
COPY --from=builder /app/services/api/prisma ./prisma

# Non-root user for security
RUN addgroup -g 1001 -S nodejs && adduser -S nestjs -u 1001
USER nestjs

EXPOSE 3001

# Use dumb-init to handle PID 1 signals correctly
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main"]

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
