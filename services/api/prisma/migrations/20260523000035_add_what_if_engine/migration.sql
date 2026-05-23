-- Sprint 21: What-If Simulation Engine

CREATE TABLE "what_if_scenario_runs" (
  "id"                TEXT         NOT NULL DEFAULT gen_random_uuid()::text,
  "tenant_id"         TEXT         NOT NULL DEFAULT 'default',
  "decision_card_id"  TEXT,
  "base_product_cost" DECIMAL(14,2) NOT NULL,
  "base_sale_price"   DECIMAL(14,2) NOT NULL,
  "base_quantity"     INTEGER      NOT NULL,
  "base_origin"       TEXT         NOT NULL,
  "base_destination"  TEXT         NOT NULL,
  "base_weight_kg"    DECIMAL(8,3) NOT NULL,
  "base_supplier_name" TEXT,
  "base_margin_eur"   DECIMAL(14,2),
  "base_margin_pct"   DECIMAL(5,2),
  "base_shipping_cost" DECIMAL(14,2),
  "base_risk_score"   DECIMAL(5,2),
  "base_delivery_days" INTEGER,
  "scenarios"         JSONB        NOT NULL DEFAULT '[]',
  "optimal_scenario"  TEXT,
  "optimal_reasoning" TEXT,
  "max_savings_eur"   DECIMAL(14,2),
  "created_at"        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT "what_if_scenario_runs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "what_if_scenario_runs_tenant_id_idx" ON "what_if_scenario_runs"("tenant_id");
CREATE INDEX "what_if_scenario_runs_decision_card_id_idx" ON "what_if_scenario_runs"("decision_card_id");
CREATE INDEX "what_if_scenario_runs_created_at_idx" ON "what_if_scenario_runs"("created_at");
