-- ClientFinancialSnapshot: materialized unit economics per client
CREATE TABLE "client_financial_snapshots" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "client_id" TEXT NOT NULL,
  "company_id" TEXT,
  "period_month" TEXT NOT NULL,           -- 'YYYY-MM'
  "total_revenue" FLOAT NOT NULL DEFAULT 0,
  "total_cost" FLOAT NOT NULL DEFAULT 0,
  "gross_margin" FLOAT NOT NULL DEFAULT 0,
  "gross_margin_pct" FLOAT NOT NULL DEFAULT 0,
  "order_count" INT NOT NULL DEFAULT 0,
  "avg_order_value" FLOAT NOT NULL DEFAULT 0,
  "ltv_cumulative" FLOAT NOT NULL DEFAULT 0,
  "cac_proxy" FLOAT NOT NULL DEFAULT 0,   -- placeholder, updated from campaigns
  "cohort_month" TEXT NOT NULL,           -- 'YYYY-MM' of first order
  "computed_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE("client_id", "period_month")
);

-- CompanyCohortAnalysis: monthly cohort retention/spending
CREATE TABLE "company_cohort_analysis" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "company_id" TEXT NOT NULL,
  "cohort_month" TEXT NOT NULL,    -- 'YYYY-MM' first order month
  "period_month" TEXT NOT NULL,    -- 'YYYY-MM' analysis month
  "active_clients" INT NOT NULL DEFAULT 0,
  "total_orders" INT NOT NULL DEFAULT 0,
  "total_revenue" FLOAT NOT NULL DEFAULT 0,
  "avg_revenue_per_client" FLOAT NOT NULL DEFAULT 0,
  "computed_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE("company_id", "cohort_month", "period_month")
);

CREATE INDEX "client_fin_client_idx" ON "client_financial_snapshots"("client_id");
CREATE INDEX "client_fin_company_idx" ON "client_financial_snapshots"("company_id");
CREATE INDEX "client_fin_period_idx" ON "client_financial_snapshots"("period_month");
CREATE INDEX "client_fin_cohort_idx" ON "client_financial_snapshots"("cohort_month");
CREATE INDEX "cohort_company_idx" ON "company_cohort_analysis"("company_id");
CREATE INDEX "cohort_period_idx" ON "company_cohort_analysis"("period_month");
