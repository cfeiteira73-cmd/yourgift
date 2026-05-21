#!/bin/sh
set -e

echo "→ Running Prisma migrations..."
# Use the locally installed prisma binary to avoid npx downloading a newer version
# Prisma is hoisted by pnpm to /app/node_modules/.bin/prisma
if [ -f "/app/node_modules/.bin/prisma" ]; then
  /app/node_modules/.bin/prisma migrate deploy --schema /app/prisma/schema.prisma && echo "✓ Migrations applied" || echo "⚠ Migrations skipped (no pending or error)"
elif [ -f "./node_modules/.bin/prisma" ]; then
  ./node_modules/.bin/prisma migrate deploy --schema ./prisma/schema.prisma && echo "✓ Migrations applied" || echo "⚠ Migrations skipped"
else
  echo "⚠ Prisma binary not found — skipping migrations (schema already up to date)"
fi

echo "→ Starting YourGift API..."
exec node dist/main
