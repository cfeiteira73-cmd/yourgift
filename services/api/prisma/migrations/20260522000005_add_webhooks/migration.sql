-- CreateTable: webhook_endpoints
CREATE TABLE "webhook_endpoints" (
  "id" TEXT NOT NULL,
  "company_id" TEXT,
  "url" TEXT NOT NULL,
  "secret" TEXT NOT NULL,
  "events" TEXT[] NOT NULL DEFAULT '{}',
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "description" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "webhook_endpoints_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "webhook_endpoints_company_id_idx" ON "webhook_endpoints"("company_id");

-- CreateTable: webhook_deliveries
CREATE TABLE "webhook_deliveries" (
  "id" TEXT NOT NULL,
  "endpoint_id" TEXT NOT NULL,
  "event" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "status_code" INTEGER,
  "response_body" TEXT,
  "success" BOOLEAN NOT NULL DEFAULT false,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "delivered_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "webhook_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "webhook_deliveries_endpoint_id_idx" ON "webhook_deliveries"("endpoint_id");

-- CreateIndex
CREATE INDEX "webhook_deliveries_event_idx" ON "webhook_deliveries"("event");

-- AddForeignKey
ALTER TABLE "webhook_deliveries"
  ADD CONSTRAINT "webhook_deliveries_endpoint_id_fkey"
  FOREIGN KEY ("endpoint_id")
  REFERENCES "webhook_endpoints"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;
