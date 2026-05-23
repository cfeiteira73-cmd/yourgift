-- system_health_snapshots: periodic snapshots of key operational metrics
CREATE TABLE system_health_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Event platform
  total_events BIGINT NOT NULL DEFAULT 0,
  events_last_hour INT NOT NULL DEFAULT 0,
  dlq_size INT NOT NULL DEFAULT 0,
  max_consumer_lag INT NOT NULL DEFAULT 0,
  -- Orders
  orders_today INT NOT NULL DEFAULT 0,
  orders_in_production INT NOT NULL DEFAULT 0,
  -- Financial
  revenue_today DECIMAL(14,2) NOT NULL DEFAULT 0,
  -- Workflows
  active_workflows INT NOT NULL DEFAULT 0,
  failed_workflows INT NOT NULL DEFAULT 0,
  -- Anomalies
  open_anomalies INT NOT NULL DEFAULT 0,
  -- System
  api_p50_ms INT NOT NULL DEFAULT 0,
  api_p95_ms INT NOT NULL DEFAULT 0,
  api_p99_ms INT NOT NULL DEFAULT 0,
  error_rate_pct DECIMAL(5,2) NOT NULL DEFAULT 0,
  db_pool_size INT NOT NULL DEFAULT 0,
  memory_mb INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_system_health_snapshots_snapshot_at ON system_health_snapshots(snapshot_at DESC);

-- api_request_logs: individual API request performance tracking
CREATE TABLE api_request_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  method TEXT NOT NULL,
  path TEXT NOT NULL,
  status_code INT NOT NULL,
  duration_ms INT NOT NULL,
  user_id TEXT,
  tenant_id TEXT,
  request_size_bytes INT,
  response_size_bytes INT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_api_request_logs_created_at ON api_request_logs(created_at DESC);
CREATE INDEX idx_api_request_logs_path ON api_request_logs(path);
CREATE INDEX idx_api_request_logs_status_code ON api_request_logs(status_code);

-- event_processing_metrics: track event handler performance
CREATE TABLE event_processing_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  handler TEXT NOT NULL,
  duration_ms INT NOT NULL,
  success BOOLEAN NOT NULL DEFAULT true,
  error_message TEXT,
  consumer_group TEXT,
  sequence_num BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_event_processing_metrics_event_type ON event_processing_metrics(event_type);
CREATE INDEX idx_event_processing_metrics_created_at ON event_processing_metrics(created_at DESC);

-- system_alerts: operational alerts (not budget anomalies — those are in budget_anomalies)
CREATE TABLE system_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  severity TEXT NOT NULL DEFAULT 'warning', -- info | warning | critical
  category TEXT NOT NULL, -- 'event_lag' | 'dlq_spike' | 'api_latency' | 'error_rate' | 'workflow_failure' | 'memory'
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  metric_value DECIMAL(14,2),
  threshold_value DECIMAL(14,2),
  is_resolved BOOLEAN NOT NULL DEFAULT false,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_system_alerts_is_resolved ON system_alerts(is_resolved);
CREATE INDEX idx_system_alerts_severity ON system_alerts(severity);
