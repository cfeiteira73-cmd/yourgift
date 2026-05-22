-- Automation rules
CREATE TABLE automation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'default',
  name TEXT NOT NULL,
  description TEXT,
  trigger_event TEXT NOT NULL,          -- e.g. 'order.created', 'order.paid'
  conditions JSONB NOT NULL DEFAULT '{}', -- {"field": "totalAmount", "op": "gt", "value": 5000}
  action_type TEXT NOT NULL,            -- 'send_notification' | 'create_job' | 'update_status' | 'flag_review'
  action_config JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  priority INT NOT NULL DEFAULT 0,
  execution_count INT NOT NULL DEFAULT 0,
  last_executed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Execution log (immutable)
CREATE TABLE automation_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID NOT NULL REFERENCES automation_rules(id),
  trigger_event TEXT NOT NULL,
  trigger_payload JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'success',   -- 'success' | 'failed' | 'skipped'
  result JSONB NOT NULL DEFAULT '{}',
  error TEXT,
  executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Supplier routing matrix
CREATE TABLE supplier_routing_matrix (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id TEXT NOT NULL,
  supplier_name TEXT NOT NULL,
  category TEXT NOT NULL,               -- product category
  base_score NUMERIC(5,2) NOT NULL DEFAULT 50,
  reliability_score NUMERIC(5,2) NOT NULL DEFAULT 50,
  price_score NUMERIC(5,2) NOT NULL DEFAULT 50,
  lead_time_days INT NOT NULL DEFAULT 7,
  min_order_value NUMERIC(12,2) NOT NULL DEFAULT 0,
  max_order_value NUMERIC(12,2),
  supported_regions TEXT[] NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_automation_rules_trigger ON automation_rules(trigger_event) WHERE is_active = true;
CREATE INDEX idx_automation_executions_rule ON automation_executions(rule_id);
CREATE INDEX idx_automation_executions_at ON automation_executions(executed_at DESC);
CREATE INDEX idx_supplier_routing_category ON supplier_routing_matrix(category) WHERE is_active = true;

-- Seed default automation rules
INSERT INTO automation_rules (name, description, trigger_event, conditions, action_type, action_config, priority) VALUES
  ('Flag High-Value Orders', 'Flag orders over €5,000 for manual review', 'order.created', '{"field":"totalAmount","op":"gt","value":5000}', 'flag_review', '{"reason":"high_value","threshold":5000}', 100),
  ('Auto-Approve Small Orders', 'Auto-approve orders under €500', 'order.created', '{"field":"totalAmount","op":"lt","value":500}', 'update_status', '{"newStatus":"approved"}', 90),
  ('Notify on Payment', 'Send notification when order is paid', 'order.paid', '{}', 'send_notification', '{"channel":"admin","message":"Order payment received"}', 80),
  ('Trigger Fulfillment on Approval', 'Start fulfillment job when order approved', 'order.approved', '{}', 'create_job', '{"jobType":"order.fulfill"}', 70),
  ('Alert on Cancellation', 'Alert admin when order is cancelled', 'order.cancelled', '{}', 'send_notification', '{"channel":"admin","message":"Order cancelled — check AR reversal"}', 60);

-- Seed supplier routing matrix
INSERT INTO supplier_routing_matrix (supplier_id, supplier_name, category, base_score, reliability_score, price_score, lead_time_days, min_order_value, supported_regions) VALUES
  ('midocean', 'Midocean', 'promotional', 85, 88, 75, 5, 0, ARRAY['EU', 'PT', 'ES']),
  ('pf-concept', 'PF Concept', 'promotional', 80, 82, 80, 7, 0, ARRAY['EU', 'PT', 'ES', 'FR']),
  ('midocean', 'Midocean', 'apparel', 75, 85, 70, 6, 100, ARRAY['EU']),
  ('pf-concept', 'PF Concept', 'apparel', 78, 80, 78, 8, 50, ARRAY['EU']);
