-- SLA definitions per production stage
CREATE TABLE sla_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stage TEXT NOT NULL UNIQUE,              -- 'artwork'|'approval'|'prepress'|'routing'|'production'|'qc'|'packaging'|'shipment'|'delivery'
  display_name TEXT NOT NULL,
  expected_hours INT NOT NULL,             -- target completion hours
  warning_hours INT NOT NULL,              -- hours before SLA breach warning
  critical_hours INT NOT NULL,             -- hours = breach
  color TEXT NOT NULL DEFAULT '#4da3ff',
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true
);

-- Per-order production stage tracking
CREATE TABLE production_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL DEFAULT 'default',
  stage TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',  -- 'pending'|'in_progress'|'completed'|'blocked'|'skipped'
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  expected_completion_at TIMESTAMPTZ,
  assigned_to TEXT,
  notes TEXT,
  sla_status TEXT NOT NULL DEFAULT 'on_track',  -- 'on_track'|'warning'|'breached'
  sla_hours_remaining NUMERIC(6,1),
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(order_id, stage)
);

-- Indexes
CREATE INDEX idx_production_stages_order ON production_stages(order_id);
CREATE INDEX idx_production_stages_status ON production_stages(status);
CREATE INDEX idx_production_stages_sla ON production_stages(sla_status);
CREATE INDEX idx_production_stages_tenant ON production_stages(tenant_id);

-- Seed SLA definitions (all 9 stages)
INSERT INTO sla_definitions (stage, display_name, expected_hours, warning_hours, critical_hours, color, sort_order) VALUES
  ('artwork',    'Artwork',     4,  3,  4,  '#a855f7', 1),
  ('approval',   'Approval',    8,  6,  8,  '#f59e0b', 2),
  ('prepress',   'Prepress',    6,  5,  6,  '#4da3ff', 3),
  ('routing',    'Routing',     2,  1,  2,  '#06b6d4', 4),
  ('production', 'Production',  48, 36, 48, '#22c55e', 5),
  ('qc',         'QC',          4,  3,  4,  '#84cc16', 6),
  ('packaging',  'Packaging',   8,  6,  8,  '#f97316', 7),
  ('shipment',   'Shipment',    24, 18, 24, '#3b82f6', 8),
  ('delivery',   'Delivery',    72, 60, 72, '#8b5cf6', 9);
