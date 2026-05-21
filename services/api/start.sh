#!/bin/sh
set -e

echo "→ Running Prisma migrations..."
npx prisma migrate deploy --schema ./prisma/schema.prisma || echo "Migrations skipped (no pending)"

echo "→ Starting YourGift API..."
exec node dist/main
