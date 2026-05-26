-- Dead Letter Queue: events that failed processing after all retries
CREATE TABLE event_dlq (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id TEXT NOT NULL,
  stream_type TEXT NOT NULL,
  event_type TEXT NOT NULL,
  event_id TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  failure_reason TEXT NOT NULL,
  failure_category TEXT NOT NULL DEFAULT 'unknown',  -- 'transient' | 'permanent' | 'schema_mismatch' | 'timeout' | 'unknown'
  consumer_group TEXT NOT NULL DEFAULT 'default',
  attempt_count INT NOT NULL DEFAULT 1,
  first_failed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_failed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  replayed_at TIMESTAMPTZ,
  replayed_by TEXT,
  status TEXT NOT NULL DEFAULT 'failed',             -- 'failed' | 'replaying' | 'resolved' | 'discarded'
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Consumer group offset tracking (Kafka-style)
CREATE TABLE event_consumer_offsets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consumer_group TEXT NOT NULL,
  stream_type TEXT,                                   -- null = global consumer
  last_sequence_num INT NOT NULL DEFAULT 0,
  last_event_id TEXT,
  last_processed_at TIMESTAMPTZ,
  events_processed INT NOT NULL DEFAULT 0,
  errors INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(consumer_group, stream_type)
);

-- Idempotency keys: exactly-once event processing
CREATE TABLE event_idempotency_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key TEXT NOT NULL UNIQUE,
  consumer_group TEXT NOT NULL DEFAULT 'default',
  event_type TEXT NOT NULL,
  stream_id TEXT NOT NULL,
  sequence_num INT NOT NULL,
  result JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days')
);

-- Indexes
CREATE INDEX idx_event_dlq_stream ON event_dlq(stream_id, stream_type);
CREATE INDEX idx_event_dlq_status ON event_dlq(status);
CREATE INDEX idx_event_dlq_category ON event_dlq(failure_category);
CREATE INDEX idx_event_consumer_offsets_group ON event_consumer_offsets(consumer_group);
CREATE INDEX idx_event_idempotency_keys_key ON event_idempotency_keys(idempotency_key);
CREATE INDEX idx_event_idempotency_keys_expires ON event_idempotency_keys(expires_at);

-- Seed default consumer groups
INSERT INTO event_consumer_offsets (consumer_group, stream_type, is_active) VALUES
  ('projections', 'order', true),
  ('ledger', 'order', true),
  ('automation', null, true),
  ('workflows', null, true),
  ('learning', 'order', true);
