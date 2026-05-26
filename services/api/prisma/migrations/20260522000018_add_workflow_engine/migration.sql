-- DAG Workflow Definitions
CREATE TABLE workflow_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  version INT NOT NULL DEFAULT 1,
  trigger_event TEXT NOT NULL,        -- e.g. 'order.created'
  dag JSONB NOT NULL DEFAULT '[]',    -- array of WorkflowStep definitions
  is_active BOOLEAN NOT NULL DEFAULT true,
  timeout_seconds INT NOT NULL DEFAULT 3600,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Running workflow instances
CREATE TABLE workflow_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  definition_id UUID NOT NULL REFERENCES workflow_definitions(id),
  definition_name TEXT NOT NULL,
  trigger_payload JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'running',  -- 'running' | 'completed' | 'failed' | 'compensating'
  current_step TEXT,
  context JSONB NOT NULL DEFAULT '{}',     -- accumulated step outputs
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  error TEXT
);

-- Individual step execution states
CREATE TABLE workflow_step_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID NOT NULL REFERENCES workflow_instances(id) ON DELETE CASCADE,
  step_id TEXT NOT NULL,
  step_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',  -- 'pending' | 'running' | 'completed' | 'failed' | 'compensated' | 'skipped'
  attempt INT NOT NULL DEFAULT 1,
  max_attempts INT NOT NULL DEFAULT 3,
  input JSONB NOT NULL DEFAULT '{}',
  output JSONB NOT NULL DEFAULT '{}',
  error TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  UNIQUE(instance_id, step_id)
);

-- Learning outcomes (close the autonomous loop)
CREATE TABLE learning_outcomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outcome_type TEXT NOT NULL,             -- 'supplier_delivery' | 'order_completion' | 'workflow_execution'
  reference_type TEXT NOT NULL,
  reference_id TEXT NOT NULL,
  supplier_id TEXT,
  metric_name TEXT NOT NULL,              -- 'delivery_time_days' | 'defect_rate' | 'satisfaction_score'
  actual_value NUMERIC(10,4) NOT NULL,
  expected_value NUMERIC(10,4),
  delta NUMERIC(10,4),                    -- actual - expected
  weight NUMERIC(4,3) NOT NULL DEFAULT 1.0,
  incorporated_at TIMESTAMPTZ,            -- when this was used to update a model
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_workflow_instances_definition ON workflow_instances(definition_id);
CREATE INDEX idx_workflow_instances_status ON workflow_instances(status);
CREATE INDEX idx_workflow_step_states_instance ON workflow_step_states(instance_id);
CREATE INDEX idx_learning_outcomes_supplier ON learning_outcomes(supplier_id) WHERE supplier_id IS NOT NULL;
CREATE INDEX idx_learning_outcomes_type ON learning_outcomes(outcome_type);

-- Seed default Order Fulfillment DAG
INSERT INTO workflow_definitions (name, description, trigger_event, dag) VALUES (
  'order_fulfillment',
  'End-to-end order fulfillment: validate → route → fulfill → notify',
  'order.created',
  '[
    {"id":"validate","name":"Validate Order","action":"order.validate","nextOnSuccess":"route","nextOnFail":null,"canCompensate":false,"maxAttempts":2,"timeoutSeconds":30},
    {"id":"route","name":"Route to Supplier","action":"order.route_supplier","nextOnSuccess":"fulfill","nextOnFail":"notify_routing_fail","canCompensate":true,"compensateAction":"order.unroute","maxAttempts":3,"timeoutSeconds":60},
    {"id":"fulfill","name":"Send to Supplier","action":"order.fulfill","nextOnSuccess":"notify_client","nextOnFail":"compensate_route","canCompensate":true,"compensateAction":"order.cancel_fulfillment","maxAttempts":3,"timeoutSeconds":300},
    {"id":"notify_client","name":"Notify Client","action":"notification.send_confirmation","nextOnSuccess":null,"nextOnFail":null,"canCompensate":false,"maxAttempts":2,"timeoutSeconds":30},
    {"id":"notify_routing_fail","name":"Alert Routing Failure","action":"notification.send_alert","nextOnSuccess":null,"nextOnFail":null,"canCompensate":false,"maxAttempts":1,"timeoutSeconds":30},
    {"id":"compensate_route","name":"Compensate Route","action":"order.unroute","nextOnSuccess":null,"nextOnFail":null,"canCompensate":false,"maxAttempts":1,"timeoutSeconds":30}
  ]'::jsonb
);

-- Seed approval workflow
INSERT INTO workflow_definitions (name, description, trigger_event, dag) VALUES (
  'order_approval',
  'High-value order approval: review → approve/reject → notify',
  'order.flagged',
  '[
    {"id":"review","name":"Admin Review","action":"order.queue_review","nextOnSuccess":"await_decision","nextOnFail":null,"canCompensate":false,"maxAttempts":1,"timeoutSeconds":60},
    {"id":"await_decision","name":"Await Decision","action":"order.await_approval","nextOnSuccess":"notify_approved","nextOnFail":"notify_rejected","canCompensate":false,"maxAttempts":1,"timeoutSeconds":86400},
    {"id":"notify_approved","name":"Notify Approved","action":"notification.send_approval","nextOnSuccess":null,"nextOnFail":null,"canCompensate":false,"maxAttempts":2,"timeoutSeconds":30},
    {"id":"notify_rejected","name":"Notify Rejected","action":"notification.send_rejection","nextOnSuccess":null,"nextOnFail":null,"canCompensate":false,"maxAttempts":2,"timeoutSeconds":30}
  ]'::jsonb
);
