-- decision_cards: standardized decision output from the PDE
CREATE TABLE decision_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'default',
  trigger_type TEXT NOT NULL, -- 'order' | 'brief' | 'system_event' | 'manual' | 'scheduled'
  trigger_id TEXT,
  trigger_description TEXT,

  -- Core decision
  action TEXT NOT NULL,
  action_type TEXT NOT NULL, -- 'reroute_supplier' | 'adjust_price' | 'approve_workflow' | 'block' | 'escalate' | 'reorder' | 'expedite'

  -- Simulated financial impact
  margin_impact_eur DECIMAL(12,2),
  delivery_impact_days INT,
  risk_change_pct DECIMAL(5,2),
  final_cost DECIMAL(14,2),
  final_margin_eur DECIMAL(14,2),
  final_margin_pct DECIMAL(5,2),

  -- Risk classification
  risk_score DECIMAL(5,2) NOT NULL DEFAULT 50,  -- 0=safe, 100=critical
  confidence_score DECIMAL(5,2) NOT NULL DEFAULT 75,
  failure_probability DECIMAL(5,2) NOT NULL DEFAULT 10,
  risk_level TEXT NOT NULL DEFAULT 'medium', -- 'low' | 'medium' | 'high'

  -- AI content
  reasoning TEXT NOT NULL,
  alternatives JSONB NOT NULL DEFAULT '[]', -- [{action, marginImpact, deliveryDays, riskScore, confidence}]

  -- Execution state
  auto_executed BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'approved' | 'rejected' | 'auto_executed' | 'expired'
  decided_by TEXT,
  decided_at TIMESTAMPTZ,
  execution_result JSONB,
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours'),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_decision_cards_status ON decision_cards(status);
CREATE INDEX idx_decision_cards_risk ON decision_cards(risk_level, status);
CREATE INDEX idx_decision_cards_trigger ON decision_cards(trigger_type, trigger_id);
CREATE INDEX idx_decision_cards_created ON decision_cards(created_at DESC);

-- procurement_state_snapshots: unified system state graph (taken every 5 min)
CREATE TABLE procurement_state_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Orders
  total_open_orders INT NOT NULL DEFAULT 0,
  total_pending_value DECIMAL(14,2) NOT NULL DEFAULT 0,
  avg_margin_pct DECIMAL(5,2),
  total_at_risk_value DECIMAL(14,2) NOT NULL DEFAULT 0,
  -- Production
  orders_in_production INT NOT NULL DEFAULT 0,
  sla_breaches INT NOT NULL DEFAULT 0,
  bottleneck_stage TEXT,
  -- Suppliers
  supplier_health_score DECIMAL(5,1),
  degraded_suppliers INT NOT NULL DEFAULT 0,
  -- Decisions
  pending_decisions INT NOT NULL DEFAULT 0,
  auto_executed_today INT NOT NULL DEFAULT 0,
  blocked_decisions INT NOT NULL DEFAULT 0,
  -- System
  active_alerts INT NOT NULL DEFAULT 0,
  expansion_opportunities INT NOT NULL DEFAULT 0,
  overall_system_score DECIMAL(5,1), -- 0-100 composite health
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_state_snapshots_at ON procurement_state_snapshots(snapshot_at DESC);

-- simulation_runs: pre-computed scenario simulations (stored for audit + learning)
CREATE TABLE simulation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  context_type TEXT NOT NULL DEFAULT 'manual',
  context_id TEXT,
  -- Inputs
  product_cost DECIMAL(14,4),
  quantity INT,
  origin_country TEXT,
  destination_country TEXT,
  weight_kg DECIMAL(8,3),
  target_price DECIMAL(14,2),
  supplier_name TEXT,
  category TEXT,
  -- Shipping simulation
  shipping_cost DECIMAL(12,2),
  shipping_provider TEXT,
  shipping_days INT,
  -- Cost breakdown
  print_cost DECIMAL(12,2) DEFAULT 0,
  platform_fee DECIMAL(12,2),
  final_total_cost DECIMAL(14,2),
  final_margin_eur DECIMAL(14,2),
  final_margin_pct DECIMAL(5,2),
  -- Risk breakdown
  delivery_risk_score DECIMAL(5,2),
  supplier_risk_score DECIMAL(5,2),
  financial_risk_score DECIMAL(5,2),
  composite_risk_score DECIMAL(5,2),
  failure_probability DECIMAL(5,2),
  -- Output
  recommended_action TEXT,
  confidence_score DECIMAL(5,2),
  simulation_notes TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_simulation_runs_ctx ON simulation_runs(context_type, context_id);
CREATE INDEX idx_simulation_runs_created ON simulation_runs(created_at DESC);
