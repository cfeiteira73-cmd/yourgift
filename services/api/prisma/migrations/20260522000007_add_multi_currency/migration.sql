ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'EUR';
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'EUR';

CREATE TABLE IF NOT EXISTS "exchange_rates" (
  "id" TEXT NOT NULL,
  "from_currency" TEXT NOT NULL,
  "to_currency" TEXT NOT NULL,
  "rate" DOUBLE PRECISION NOT NULL,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "exchange_rates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "exchange_rates_from_to_key" ON "exchange_rates"("from_currency", "to_currency");
