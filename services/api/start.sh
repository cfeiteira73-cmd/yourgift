#!/bin/sh
set -e

echo "→ Running Prisma migrations..."
# Use locally installed prisma binary (pnpm hoisted to root node_modules)
if [ -f "/app/node_modules/.bin/prisma" ]; then
  /app/node_modules/.bin/prisma migrate deploy --schema /app/services/api/prisma/schema.prisma && \
    echo "✓ Migrations applied" || echo "⚠ Migrations skipped (no pending or error)"
else
  echo "⚠ Prisma binary not found — skipping migrations (schema already up to date)"
fi

echo "→ Starting YourGift API..."
exec node /app/services/api/dist/main
