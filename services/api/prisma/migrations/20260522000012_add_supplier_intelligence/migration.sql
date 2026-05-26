-- Supplier performance tracking (updated after every order)
CREATE TABLE "supplier_performance" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "supplier" TEXT NOT NULL UNIQUE,
  "total_orders" INT NOT NULL DEFAULT 0,
  "on_time_deliveries" INT NOT NULL DEFAULT 0,
  "late_deliveries" INT NOT NULL DEFAULT 0,
  "cancelled_orders" INT NOT NULL DEFAULT 0,
  "avg_delivery_days" FLOAT,
  "reliability_score" FLOAT NOT NULL DEFAULT 1.0,  -- 0.0 to 1.0
  "last_order_at" TIMESTAMP,
  "updated_at" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Procurement intelligence: trending products and categories
CREATE TABLE "procurement_intelligence" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "entity_type" TEXT NOT NULL,    -- product | category | supplier
  "entity_id" TEXT NOT NULL,
  "signal_type" TEXT NOT NULL,    -- trending_up | trending_down | popular | seasonal
  "score" FLOAT NOT NULL DEFAULT 0,
  "order_count_30d" INT NOT NULL DEFAULT 0,
  "order_count_7d" INT NOT NULL DEFAULT 0,
  "revenue_30d" FLOAT NOT NULL DEFAULT 0,
  "computed_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE("entity_type", "entity_id")
);

CREATE INDEX "supplier_perf_supplier_idx" ON "supplier_performance"("supplier");
CREATE INDEX "supplier_perf_score_idx" ON "supplier_performance"("reliability_score");
CREATE INDEX "proc_intel_entity_idx" ON "procurement_intelligence"("entity_type", "entity_id");
CREATE INDEX "proc_intel_signal_idx" ON "procurement_intelligence"("signal_type");
CREATE INDEX "proc_intel_score_idx" ON "procurement_intelligence"("score" DESC);
