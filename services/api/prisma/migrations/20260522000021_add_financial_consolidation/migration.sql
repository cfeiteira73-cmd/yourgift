-- Financial consolidations: multi-tenant aggregated P&L snapshots
CREATE TABLE financial_consolidations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_label TEXT NOT NULL,           -- 'Q1-2026', 'M05-2026', 'YTD-2026'
  period_type TEXT NOT NULL,            -- 'monthly' | 'quarterly' | 'ytd' | 'custom'
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,

  -- P&L aggregates (all tenants combined)
  total_revenue NUMERIC(16,2) NOT NULL DEFAULT 0,
  total_cogs NUMERIC(16,2) NOT NULL DEFAULT 0,
  gross_profit NUMERIC(16,2) NOT NULL DEFAULT 0,
  gross_margin_pct NUMERIC(6,2) NOT NULL DEFAULT 0,
  total_opex NUMERIC(16,2) NOT NULL DEFAULT 0,
  ebitda NUMERIC(16,2) NOT NULL DEFAULT 0,
  ebitda_margin_pct NUMERIC(6,2) NOT NULL DEFAULT 0,

  -- Tenant breakdown (JSONB array)
  tenant_breakdown JSONB NOT NULL DEFAULT '[]',

  -- Dimension breakdown
  by_supplier JSONB NOT NULL DEFAULT '{}',
  by_category JSONB NOT NULL DEFAULT '{}',
  by_department JSONB NOT NULL DEFAULT '{}',

  -- Metadata
  tenant_count INT NOT NULL DEFAULT 0,
  order_count INT NOT NULL DEFAULT 0,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  computed_by TEXT NOT NULL DEFAULT 'system',
  notes TEXT
);

-- Budget anomaly detection
CREATE TABLE budget_anomalies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'default',
  company_id TEXT,
  department TEXT,
  anomaly_type TEXT NOT NULL,           -- 'overspend' | 'underspend' | 'spike' | 'unusual_supplier' | 'freq_increase'
  severity TEXT NOT NULL DEFAULT 'low', -- 'low' | 'medium' | 'high' | 'critical'
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  expected_value NUMERIC(14,2),
  actual_value NUMERIC(14,2) NOT NULL,
  deviation_pct NUMERIC(6,2),
  description TEXT NOT NULL,
  is_acknowledged BOOLEAN NOT NULL DEFAULT false,
  acknowledged_by TEXT,
  acknowledged_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'
);

-- Indexes
CREATE INDEX idx_financial_consolidations_period ON financial_consolidations(period_start, period_end);
CREATE INDEX idx_financial_consolidations_type ON financial_consolidations(period_type);
CREATE INDEX idx_budget_anomalies_tenant ON budget_anomalies(tenant_id);
CREATE INDEX idx_budget_anomalies_severity ON budget_anomalies(severity);
CREATE INDEX idx_budget_anomalies_type ON budget_anomalies(anomaly_type);
CREATE INDEX idx_budget_anomalies_ack ON budget_anomalies(is_acknowledged);
