-- margin_rules: defines minimum acceptable margins per context
CREATE TABLE margin_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'default',
  name TEXT NOT NULL,
  scope TEXT NOT NULL DEFAULT 'global', -- 'global' | 'supplier' | 'category' | 'tenant'
  scope_value TEXT, -- supplier name or category name (null for global)
  min_margin_pct DECIMAL(5,2) NOT NULL DEFAULT 15.00, -- hard floor %
  warning_threshold_pct DECIMAL(5,2) NOT NULL DEFAULT 20.00, -- warn when margin < this
  action TEXT NOT NULL DEFAULT 'warn', -- 'warn' | 'block' | 'flag'
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed with 4 default rules
INSERT INTO margin_rules (name, scope, min_margin_pct, warning_threshold_pct, action) VALUES
  ('Global Minimum Margin', 'global', 12.00, 18.00, 'warn'),
  ('Premium Supplier Floor', 'supplier', 15.00, 22.00, 'block'),
  ('High-Value Orders Floor', 'category', 18.00, 25.00, 'warn'),
  ('Promotional Items', 'category', 8.00, 12.00, 'flag');

-- margin_alerts: triggered when a quote/order violates margin rules
CREATE TABLE margin_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID REFERENCES margin_rules(id),
  reference_id TEXT NOT NULL, -- order/quote id
  reference_type TEXT NOT NULL DEFAULT 'order', -- 'order' | 'quote' | 'brief'
  tenant_id TEXT NOT NULL DEFAULT 'default',
  supplier_name TEXT,
  category TEXT,
  sale_price DECIMAL(14,2) NOT NULL,
  total_cost DECIMAL(14,2) NOT NULL, -- product + shipping + fulfillment
  expected_margin_pct DECIMAL(5,2) NOT NULL,
  actual_margin_pct DECIMAL(5,2) NOT NULL,
  margin_gap_pct DECIMAL(5,2) NOT NULL, -- how far below floor
  severity TEXT NOT NULL DEFAULT 'warning', -- 'info' | 'warning' | 'critical'
  action_taken TEXT NOT NULL DEFAULT 'flagged', -- 'blocked' | 'flagged' | 'warned'
  is_resolved BOOLEAN NOT NULL DEFAULT false,
  resolution_note TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_margin_alerts_is_resolved ON margin_alerts(is_resolved);
CREATE INDEX idx_margin_alerts_severity ON margin_alerts(severity);
CREATE INDEX idx_margin_alerts_created ON margin_alerts(created_at DESC);

-- cost_snapshots: historical cost snapshots for drift detection
CREATE TABLE cost_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_name TEXT NOT NULL,
  category TEXT NOT NULL,
  product_ref TEXT, -- specific product or null for category aggregate
  unit_cost DECIMAL(12,4) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'EUR',
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  source TEXT NOT NULL DEFAULT 'manual', -- 'sync' | 'manual' | 'order'
  change_pct_vs_prior DECIMAL(7,2), -- % change vs previous snapshot
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(supplier_name, category, product_ref, snapshot_date)
);
CREATE INDEX idx_cost_snapshots_supplier ON cost_snapshots(supplier_name);
CREATE INDEX idx_cost_snapshots_date ON cost_snapshots(snapshot_date DESC);

-- profitability_simulations: saved P&L simulations
CREATE TABLE profitability_simulations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'default',
  name TEXT,
  sale_price DECIMAL(14,2) NOT NULL,
  product_cost DECIMAL(14,2) NOT NULL,
  shipping_cost DECIMAL(14,2) NOT NULL DEFAULT 0,
  print_cost DECIMAL(14,2) NOT NULL DEFAULT 0,
  platform_fee_pct DECIMAL(5,2) NOT NULL DEFAULT 8.00,
  fulfillment_pct DECIMAL(5,2) NOT NULL DEFAULT 12.00,
  quantity INT NOT NULL DEFAULT 1,
  currency TEXT NOT NULL DEFAULT 'EUR',
  -- Computed fields (stored for reporting)
  gross_revenue DECIMAL(14,2),
  total_cost DECIMAL(14,2),
  gross_margin DECIMAL(14,2),
  gross_margin_pct DECIMAL(5,2),
  platform_fee DECIMAL(14,2),
  fulfillment_fee DECIMAL(14,2),
  net_margin DECIMAL(14,2),
  net_margin_pct DECIMAL(5,2),
  is_viable BOOLEAN,
  risk_level TEXT, -- 'safe' | 'warning' | 'critical'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_profitability_simulations_created ON profitability_simulations(created_at DESC);
