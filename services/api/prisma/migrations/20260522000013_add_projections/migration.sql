-- ORDER PROJECTIONS (read model, rebuilt from events)
CREATE TABLE "order_projections" (
  "id" TEXT PRIMARY KEY,              -- same as orderId
  "tenant_id" TEXT NOT NULL DEFAULT 'default',
  "ref" TEXT NOT NULL,
  "client_id" TEXT NOT NULL,
  "company_id" TEXT,
  "department_id" TEXT,
  "campaign_id" TEXT,
  "status" TEXT NOT NULL DEFAULT 'created',
  "currency" TEXT NOT NULL DEFAULT 'EUR',
  "supplier" TEXT,
  "supplier_order_id" TEXT,
  "total_amount" FLOAT,
  "margin_amount" FLOAT,
  "item_count" INT NOT NULL DEFAULT 0,
  "shipping_address" JSONB,
  "tracking_number" TEXT,
  "approved_at" TIMESTAMP,
  "shipped_at" TIMESTAMP,
  "delivered_at" TIMESTAMP,
  "last_event_type" TEXT,
  "last_event_at" TIMESTAMP,
  "event_sequence" INT NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- AGGREGATE SNAPSHOTS (for fast state reconstruction)
CREATE TABLE "aggregate_snapshots" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "aggregate_id" TEXT NOT NULL,
  "aggregate_type" TEXT NOT NULL,     -- order | quote | employee | client
  "snapshot_version" INT NOT NULL DEFAULT 1,
  "state" JSONB NOT NULL DEFAULT '{}',
  "last_sequence_num" INT NOT NULL DEFAULT 0,
  "taken_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE("aggregate_id", "aggregate_type")
);

-- PROJECTION REBUILD LOG (track async rebuild jobs)
CREATE TABLE "projection_rebuild_logs" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "projection_name" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'running',  -- running | completed | failed
  "events_processed" INT NOT NULL DEFAULT 0,
  "started_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "completed_at" TIMESTAMP,
  "error" TEXT
);

CREATE INDEX "order_proj_client_idx" ON "order_projections"("client_id");
CREATE INDEX "order_proj_company_idx" ON "order_projections"("company_id");
CREATE INDEX "order_proj_status_idx" ON "order_projections"("status");
CREATE INDEX "order_proj_created_idx" ON "order_projections"("created_at");
CREATE INDEX "order_proj_tenant_idx" ON "order_projections"("tenant_id");
CREATE INDEX "snap_aggregate_idx" ON "aggregate_snapshots"("aggregate_id", "aggregate_type");
