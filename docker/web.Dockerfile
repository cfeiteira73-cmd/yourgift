# ── Stage 1: builder ────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

# Install pnpm
RUN npm install -g pnpm@9

WORKDIR /app

# Copy monorepo root manifests first (layer cache)
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./

# Copy workspace package manifests
COPY packages/shared/package.json ./packages/shared/
COPY apps/web/package.json ./apps/web/

# Install all dependencies
RUN pnpm install --frozen-lockfile

# Copy full source
COPY packages/shared ./packages/shared
COPY apps/web ./apps/web
COPY tsconfig.base.json ./

# Build shared package first
RUN pnpm --filter @yourgift/shared run build

# Build Next.js web app (outputs standalone build)
RUN pnpm --filter web run build

# ── Stage 2: runner ──────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

WORKDIR /app

# Non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

# Copy Next.js standalone output (includes a self-contained server.js)
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./

# Copy static assets (must sit at .next/static relative to server.js)
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./.next/static

# Copy public assets
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./public

USER nextjs

EXPOSE 3000

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server.js"]

# Requires next.config.js to have: output: 'standalone'
