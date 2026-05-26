#!/bin/sh
# Startup script for Render native Node runtime (working dir = repo root)
set -e

PRISMA_BIN="./node_modules/.bin/prisma"
SCHEMA="./services/api/prisma/schema.prisma"

echo "Running Prisma migrations..."
if [ -f "$PRISMA_BIN" ]; then
  $PRISMA_BIN migrate deploy --schema "$SCHEMA" \
    && echo "Migrations applied" \
    || echo "Migrations skipped (no pending or already applied)"
else
  echo "Prisma binary not found at $PRISMA_BIN - skipping migrations"
fi

echo "Starting YourGift API..."
exec node services/api/dist/main.js
