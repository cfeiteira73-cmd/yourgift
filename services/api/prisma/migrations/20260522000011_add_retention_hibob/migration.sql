-- Client procurement cycle tracking
CREATE TABLE "client_procurement_cycles" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "client_id" TEXT NOT NULL UNIQUE,
  "company_id" TEXT,
  "first_order_at" TIMESTAMP,
  "last_order_at" TIMESTAMP,
  "order_count" INT NOT NULL DEFAULT 0,
  "avg_days_between_orders" FLOAT,
  "predicted_next_order_at" TIMESTAMP,
  "churn_risk_score" FLOAT NOT NULL DEFAULT 0,  -- 0.0 to 1.0
  "churn_risk_level" TEXT NOT NULL DEFAULT 'low',  -- low | medium | high
  "days_since_last_order" INT,
  "onboarding_completed" BOOLEAN NOT NULL DEFAULT false,
  "updated_at" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Demand forecast per product/category
CREATE TABLE "demand_forecasts" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "entity_type" TEXT NOT NULL,  -- product | category | company
  "entity_id" TEXT NOT NULL,
  "forecast_month" TEXT NOT NULL,   -- 'YYYY-MM'
  "predicted_quantity" INT NOT NULL DEFAULT 0,
  "predicted_revenue" FLOAT NOT NULL DEFAULT 0,
  "confidence_score" FLOAT NOT NULL DEFAULT 0.5,
  "historical_orders" INT NOT NULL DEFAULT 0,
  "computed_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE("entity_type", "entity_id", "forecast_month")
);

-- HiBob employee sync log
CREATE TABLE "hibob_sync_events" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "employee_id" TEXT NOT NULL,
  "employee_email" TEXT NOT NULL,
  "event_type" TEXT NOT NULL,  -- employee.onboarded | employee.updated | employee.offboarded
  "payload" JSONB NOT NULL DEFAULT '{}',
  "processed_at" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX "procurement_cycles_client_idx" ON "client_procurement_cycles"("client_id");
CREATE INDEX "procurement_cycles_company_idx" ON "client_procurement_cycles"("company_id");
CREATE INDEX "procurement_cycles_churn_idx" ON "client_procurement_cycles"("churn_risk_level");
CREATE INDEX "demand_forecasts_entity_idx" ON "demand_forecasts"("entity_type", "entity_id");
CREATE INDEX "demand_forecasts_month_idx" ON "demand_forecasts"("forecast_month");
CREATE INDEX "hibob_sync_email_idx" ON "hibob_sync_events"("employee_email");
