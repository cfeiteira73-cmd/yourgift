-- Customer success health scores (per-company procurement health)
CREATE TABLE cs_health_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL DEFAULT 'default',
  health_score NUMERIC(5,1) NOT NULL DEFAULT 50.0,     -- 0-100
  churn_risk TEXT NOT NULL DEFAULT 'low',               -- 'low'|'medium'|'high'|'critical'
  engagement_score NUMERIC(5,1) NOT NULL DEFAULT 50.0,  -- order frequency
  spend_trend TEXT NOT NULL DEFAULT 'stable',            -- 'growing'|'stable'|'declining'
  last_order_days_ago INT,
  orders_last_30d INT NOT NULL DEFAULT 0,
  orders_last_90d INT NOT NULL DEFAULT 0,
  total_lifetime_spend NUMERIC(14,2) NOT NULL DEFAULT 0,
  avg_monthly_spend NUMERIC(12,2) NOT NULL DEFAULT 0,
  expansion_probability NUMERIC(4,3) NOT NULL DEFAULT 0, -- 0-1
  health_factors JSONB NOT NULL DEFAULT '{}',            -- breakdown of score components
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(company_id, tenant_id)
);

-- Expansion opportunity signals (upsell/cross-sell detection)
CREATE TABLE expansion_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL DEFAULT 'default',
  signal_type TEXT NOT NULL,     -- 'upsell'|'cross_sell'|'volume_increase'|'new_category'|'onboarding_gap'
  opportunity_value NUMERIC(12,2),
  confidence NUMERIC(4,3) NOT NULL DEFAULT 0.5,   -- 0-1
  description TEXT NOT NULL,
  recommended_action TEXT NOT NULL,
  is_actioned BOOLEAN NOT NULL DEFAULT false,
  actioned_at TIMESTAMPTZ,
  actioned_by TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Inventory depletion forecasts
CREATE TABLE inventory_forecasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id TEXT NOT NULL,
  variant_id TEXT,
  current_stock INT NOT NULL DEFAULT 0,
  avg_daily_consumption NUMERIC(8,2) NOT NULL DEFAULT 0,
  days_until_depletion INT,
  reorder_point INT NOT NULL DEFAULT 10,
  reorder_quantity INT NOT NULL DEFAULT 100,
  forecasted_demand_30d INT NOT NULL DEFAULT 0,
  confidence NUMERIC(4,3) NOT NULL DEFAULT 0.5,
  is_alert_active BOOLEAN NOT NULL DEFAULT false,
  alert_severity TEXT NOT NULL DEFAULT 'low',    -- 'low'|'medium'|'high'|'critical'
  last_computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(product_id, variant_id)
);

-- Indexes
CREATE INDEX idx_cs_health_scores_company ON cs_health_scores(company_id);
CREATE INDEX idx_cs_health_scores_churn ON cs_health_scores(churn_risk);
CREATE INDEX idx_expansion_signals_company ON expansion_signals(company_id);
CREATE INDEX idx_expansion_signals_actioned ON expansion_signals(is_actioned);
CREATE INDEX idx_inventory_forecasts_depletion ON inventory_forecasts(days_until_depletion) WHERE days_until_depletion IS NOT NULL;
CREATE INDEX idx_inventory_forecasts_alert ON inventory_forecasts(is_alert_active);
