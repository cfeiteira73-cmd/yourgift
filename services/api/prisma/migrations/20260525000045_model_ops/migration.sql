-- ─────────────────────────────────────────────
-- MODEL OPS / AI GOVERNANCE MIGRATION
-- ─────────────────────────────────────────────

-- ModelVersion
CREATE TABLE "model_versions" (
  "id"              TEXT        NOT NULL PRIMARY KEY,
  "model_id"        TEXT        NOT NULL,
  "name"            TEXT        NOT NULL,
  "provider"        TEXT        NOT NULL,
  "model_ref"       TEXT        NOT NULL,
  "purpose"         TEXT        NOT NULL,
  "status"          TEXT        NOT NULL DEFAULT 'candidate',
  "config"          JSONB       NOT NULL DEFAULT '{}',
  "promoted_at"     TIMESTAMPTZ,
  "retired_at"      TIMESTAMPTZ,
  "rolled_back_at"  TIMESTAMPTZ,
  "rollback_reason" TEXT,
  "created_by"      TEXT,
  "created_at"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX "model_versions_model_id_idx"  ON "model_versions"("model_id");
CREATE INDEX "model_versions_status_idx"    ON "model_versions"("status");
CREATE INDEX "model_versions_purpose_idx"   ON "model_versions"("purpose");

-- ModelDriftRecord
CREATE TABLE "model_drift_records" (
  "id"               TEXT        NOT NULL PRIMARY KEY,
  "model_version_id" TEXT        NOT NULL,
  "metric"           TEXT        NOT NULL,
  "expected_value"   DOUBLE PRECISION NOT NULL,
  "observed_value"   DOUBLE PRECISION NOT NULL,
  "drift_pct"        DOUBLE PRECISION NOT NULL,
  "severity"         TEXT        NOT NULL DEFAULT 'low',
  "window_start"     TIMESTAMPTZ NOT NULL,
  "window_end"       TIMESTAMPTZ NOT NULL,
  "sample_count"     INTEGER     NOT NULL,
  "tenant_id"        TEXT,
  "created_at"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "model_drift_records_model_version_id_fkey"
    FOREIGN KEY ("model_version_id") REFERENCES "model_versions"("id") ON DELETE CASCADE
);

CREATE INDEX "model_drift_records_model_version_id_idx" ON "model_drift_records"("model_version_id");
CREATE INDEX "model_drift_records_metric_idx"           ON "model_drift_records"("metric");
CREATE INDEX "model_drift_records_severity_idx"         ON "model_drift_records"("severity");
CREATE INDEX "model_drift_records_created_at_idx"       ON "model_drift_records"("created_at" DESC);

-- ModelOverrideRecord
CREATE TABLE "model_override_records" (
  "id"                      TEXT        NOT NULL PRIMARY KEY,
  "model_version_id"        TEXT        NOT NULL,
  "decision_id"             TEXT,
  "procurement_request_id"  TEXT,
  "tenant_id"               TEXT,
  "overridden_by"           TEXT        NOT NULL,
  "ai_recommendation"       TEXT        NOT NULL,
  "human_decision"          TEXT        NOT NULL,
  "override_reason"         TEXT,
  "outcome"                 TEXT,
  "outcome_notes"           TEXT,
  "financial_impact"        DOUBLE PRECISION,
  "created_at"              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "resolved_at"             TIMESTAMPTZ,
  CONSTRAINT "model_override_records_model_version_id_fkey"
    FOREIGN KEY ("model_version_id") REFERENCES "model_versions"("id") ON DELETE CASCADE
);

CREATE INDEX "model_override_records_model_version_id_idx" ON "model_override_records"("model_version_id");
CREATE INDEX "model_override_records_tenant_id_idx"        ON "model_override_records"("tenant_id");
CREATE INDEX "model_override_records_created_at_idx"       ON "model_override_records"("created_at" DESC);

-- ShadowDeployment
CREATE TABLE "shadow_deployments" (
  "id"                TEXT        NOT NULL PRIMARY KEY,
  "active_version_id" TEXT        NOT NULL,
  "shadow_version_id" TEXT        NOT NULL,
  "purpose"           TEXT        NOT NULL,
  "status"            TEXT        NOT NULL DEFAULT 'running',
  "total_requests"    INTEGER     NOT NULL DEFAULT 0,
  "agreement_rate"    DOUBLE PRECISION,
  "avg_latency_delta" DOUBLE PRECISION,
  "started_at"        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "ended_at"          TIMESTAMPTZ,
  "promotion_notes"   TEXT,
  "tenant_id"         TEXT
);

CREATE INDEX "shadow_deployments_status_idx"  ON "shadow_deployments"("status");
CREATE INDEX "shadow_deployments_purpose_idx" ON "shadow_deployments"("purpose");

-- Seed initial active model versions
INSERT INTO "model_versions" ("id", "model_id", "name", "provider", "model_ref", "purpose", "status", "config", "created_at", "updated_at")
VALUES
  (gen_random_uuid()::text, 'procurement-decision-v1', 'Procurement Decision Engine v1', 'anthropic', 'claude-opus-4-5', 'decision', 'active', '{"temperature":0,"maxTokens":2000}', NOW(), NOW()),
  (gen_random_uuid()::text, 'quote-analysis-v1', 'Quote Analysis Engine v1', 'anthropic', 'claude-sonnet-4-5', 'quote', 'active', '{"temperature":0,"maxTokens":1000}', NOW(), NOW()),
  (gen_random_uuid()::text, 'routing-intelligence-v1', 'Routing Intelligence v1', 'internal', 'rule-engine-v1', 'routing', 'active', '{}', NOW(), NOW());
