-- Migration: reliability_control_plane
-- Adds all models for distributed tracing, incident engine, financial reconciliation,
-- circuit breakers, data governance, reliability scoring, and deep health checks.

-- TraceSpan (OpenTelemetry export)
CREATE TABLE "trace_spans" (
    "id"              TEXT NOT NULL,
    "trace_id"        TEXT NOT NULL,
    "span_id"         TEXT NOT NULL,
    "parent_span_id"  TEXT,
    "name"            TEXT NOT NULL,
    "service"         TEXT NOT NULL,
    "kind"            INTEGER NOT NULL DEFAULT 0,
    "status_code"     INTEGER NOT NULL DEFAULT 0,
    "status_message"  TEXT,
    "start_time_ns"   BIGINT NOT NULL,
    "duration_ns"     BIGINT NOT NULL,
    "attributes"      JSONB NOT NULL DEFAULT '{}',
    "events"          JSONB NOT NULL DEFAULT '[]',
    "links"           JSONB NOT NULL DEFAULT '[]',
    "resource"        JSONB NOT NULL DEFAULT '{}',
    "tenant_id"       TEXT,
    "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "trace_spans_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "trace_spans_trace_id_idx"   ON "trace_spans"("trace_id");
CREATE INDEX "trace_spans_span_id_idx"    ON "trace_spans"("span_id");
CREATE INDEX "trace_spans_service_idx"    ON "trace_spans"("service");
CREATE INDEX "trace_spans_tenant_id_idx"  ON "trace_spans"("tenant_id");
CREATE INDEX "trace_spans_created_at_idx" ON "trace_spans"("created_at" DESC);

-- Incidents
CREATE TABLE "incidents" (
    "id"                   TEXT NOT NULL,
    "title"                TEXT NOT NULL,
    "severity"             TEXT NOT NULL DEFAULT 'SEV3',
    "status"               TEXT NOT NULL DEFAULT 'open',
    "blast_radius"         TEXT NOT NULL DEFAULT 'unknown',
    "affected_services"    TEXT[] NOT NULL DEFAULT '{}',
    "root_cause_candidate" TEXT,
    "description"          TEXT,
    "started_at"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "detected_at"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "mitigated_at"         TIMESTAMP(3),
    "resolved_at"          TIMESTAMP(3),
    "resolved_by"          TEXT,
    "mttr_minutes"         INTEGER,
    "tenant_id"            TEXT,
    "source"               TEXT NOT NULL DEFAULT 'system',
    "external_ref"         TEXT,
    "metadata"             JSONB NOT NULL DEFAULT '{}',
    "created_at"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "incidents_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "incidents_severity_status_idx" ON "incidents"("severity", "status");
CREATE INDEX "incidents_status_idx"          ON "incidents"("status");
CREATE INDEX "incidents_started_at_idx"      ON "incidents"("started_at" DESC);

CREATE TABLE "incident_events" (
    "id"          TEXT NOT NULL,
    "incident_id" TEXT NOT NULL,
    "event_type"  TEXT NOT NULL,
    "actor"       TEXT,
    "message"     TEXT NOT NULL,
    "metadata"    JSONB NOT NULL DEFAULT '{}',
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "incident_events_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "incident_events_incident_id_fkey" FOREIGN KEY ("incident_id") REFERENCES "incidents"("id") ON DELETE CASCADE
);
CREATE INDEX "incident_events_incident_id_idx" ON "incident_events"("incident_id", "occurred_at");

-- Financial Reconciliation
CREATE TABLE "reconciliation_runs" (
    "id"              TEXT NOT NULL,
    "run_type"        TEXT NOT NULL,
    "period_start"    TIMESTAMP(3) NOT NULL,
    "period_end"      TIMESTAMP(3) NOT NULL,
    "status"          TEXT NOT NULL DEFAULT 'running',
    "integrity_score" DECIMAL(5,2) NOT NULL DEFAULT 100,
    "total_checked"   INTEGER NOT NULL DEFAULT 0,
    "issues_found"    INTEGER NOT NULL DEFAULT 0,
    "issues_resolved" INTEGER NOT NULL DEFAULT 0,
    "duration_ms"     INTEGER,
    "error_message"   TEXT,
    "triggered_by"    TEXT NOT NULL DEFAULT 'scheduler',
    "started_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at"    TIMESTAMP(3),
    "tenant_id"       TEXT,
    CONSTRAINT "reconciliation_runs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "reconciliation_runs_status_idx"     ON "reconciliation_runs"("status");
CREATE INDEX "reconciliation_runs_started_at_idx" ON "reconciliation_runs"("started_at" DESC);

CREATE TABLE "reconciliation_issues" (
    "id"              TEXT NOT NULL,
    "run_id"          TEXT NOT NULL,
    "issue_type"      TEXT NOT NULL,
    "severity"        TEXT NOT NULL DEFAULT 'medium',
    "status"          TEXT NOT NULL DEFAULT 'open',
    "description"     TEXT NOT NULL,
    "reference_type"  TEXT,
    "reference_id"    TEXT,
    "expected_amount" DECIMAL(14,2),
    "actual_amount"   DECIMAL(14,2),
    "discrepancy"     DECIMAL(14,2),
    "currency"        TEXT NOT NULL DEFAULT 'EUR',
    "repair_action"   TEXT,
    "repaired_at"     TIMESTAMP(3),
    "repaired_by"     TEXT,
    "tenant_id"       TEXT,
    "metadata"        JSONB NOT NULL DEFAULT '{}',
    "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "reconciliation_issues_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "reconciliation_issues_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "reconciliation_runs"("id")
);
CREATE INDEX "reconciliation_issues_run_id_idx"    ON "reconciliation_issues"("run_id");
CREATE INDEX "reconciliation_issues_type_idx"      ON "reconciliation_issues"("issue_type");
CREATE INDEX "reconciliation_issues_status_idx"    ON "reconciliation_issues"("status");
CREATE INDEX "reconciliation_issues_severity_idx"  ON "reconciliation_issues"("severity");

-- Circuit Breakers
CREATE TABLE "circuit_breaker_states" (
    "id"               TEXT NOT NULL,
    "service"          TEXT NOT NULL,
    "state"            TEXT NOT NULL DEFAULT 'closed',
    "failure_count"    INTEGER NOT NULL DEFAULT 0,
    "success_count"    INTEGER NOT NULL DEFAULT 0,
    "last_failure_at"  TIMESTAMP(3),
    "last_success_at"  TIMESTAMP(3),
    "opened_at"        TIMESTAMP(3),
    "half_open_at"     TIMESTAMP(3),
    "next_retry_at"    TIMESTAMP(3),
    "threshold"        INTEGER NOT NULL DEFAULT 5,
    "cooldown_seconds" INTEGER NOT NULL DEFAULT 60,
    "metadata"         JSONB NOT NULL DEFAULT '{}',
    "updated_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "circuit_breaker_states_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "circuit_breaker_states_service_key" UNIQUE ("service")
);
CREATE INDEX "circuit_breaker_states_state_idx" ON "circuit_breaker_states"("state");

CREATE TABLE "retry_audits" (
    "id"               TEXT NOT NULL,
    "service"          TEXT NOT NULL,
    "operation"        TEXT NOT NULL,
    "attempt"          INTEGER NOT NULL DEFAULT 1,
    "success"          BOOLEAN NOT NULL DEFAULT false,
    "error_message"    TEXT,
    "duration_ms"      INTEGER,
    "backoff_ms"       INTEGER,
    "idempotency_key"  TEXT,
    "tenant_id"        TEXT,
    "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "retry_audits_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "retry_audits_service_op_idx"  ON "retry_audits"("service", "operation");
CREATE INDEX "retry_audits_created_at_idx"  ON "retry_audits"("created_at" DESC);

-- GDPR / Data Governance
CREATE TABLE "gdpr_requests" (
    "id"              TEXT NOT NULL,
    "request_type"    TEXT NOT NULL,
    "subject_email"   TEXT NOT NULL,
    "subject_id"      TEXT,
    "tenant_id"       TEXT,
    "status"          TEXT NOT NULL DEFAULT 'pending',
    "legal_basis"     TEXT,
    "notes"           TEXT,
    "requested_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledged_at" TIMESTAMP(3),
    "processed_at"    TIMESTAMP(3),
    "completed_at"    TIMESTAMP(3),
    "completed_by"    TEXT,
    "export_url"      TEXT,
    "metadata"        JSONB NOT NULL DEFAULT '{}',
    CONSTRAINT "gdpr_requests_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "gdpr_requests_status_idx"       ON "gdpr_requests"("status");
CREATE INDEX "gdpr_requests_type_idx"         ON "gdpr_requests"("request_type");
CREATE INDEX "gdpr_requests_email_idx"        ON "gdpr_requests"("subject_email");

CREATE TABLE "legal_holds" (
    "id"           TEXT NOT NULL,
    "request_id"   TEXT,
    "tenant_id"    TEXT,
    "subject_email" TEXT,
    "scope"        TEXT NOT NULL,
    "reason"       TEXT NOT NULL,
    "placed_by"    TEXT NOT NULL,
    "placed_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "released_at"  TIMESTAMP(3),
    "released_by"  TEXT,
    "expires_at"   TIMESTAMP(3),
    "is_active"    BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "legal_holds_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "legal_holds_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "gdpr_requests"("id")
);
CREATE INDEX "legal_holds_active_idx"    ON "legal_holds"("is_active");
CREATE INDEX "legal_holds_tenant_idx"    ON "legal_holds"("tenant_id");

CREATE TABLE "retention_policies" (
    "id"                   TEXT NOT NULL,
    "entity_type"          TEXT NOT NULL,
    "retention_days"       INTEGER NOT NULL,
    "anonymize_after_days" INTEGER,
    "delete_after_days"    INTEGER,
    "legal_basis"          TEXT NOT NULL,
    "is_active"            BOOLEAN NOT NULL DEFAULT true,
    "created_at"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "retention_policies_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "retention_policies_entity_type_key" UNIQUE ("entity_type")
);

-- Reliability Snapshots
CREATE TABLE "reliability_snapshots" (
    "id"                          TEXT NOT NULL,
    "snapshot_at"                 TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "overall_score"               DECIMAL(5,2) NOT NULL DEFAULT 100,
    "api_reliability"             DECIMAL(5,2) NOT NULL DEFAULT 100,
    "queue_reliability"           DECIMAL(5,2) NOT NULL DEFAULT 100,
    "procurement_correctness"     DECIMAL(5,2) NOT NULL DEFAULT 100,
    "supplier_stability"          DECIMAL(5,2) NOT NULL DEFAULT 100,
    "workflow_health"             DECIMAL(5,2) NOT NULL DEFAULT 100,
    "financial_integrity"         DECIMAL(5,2) NOT NULL DEFAULT 100,
    "auth_reliability"            DECIMAL(5,2) NOT NULL DEFAULT 100,
    "uptime_pct"                  DECIMAL(6,3) NOT NULL DEFAULT 100,
    "p50_ms"                      INTEGER NOT NULL DEFAULT 0,
    "p95_ms"                      INTEGER NOT NULL DEFAULT 0,
    "p99_ms"                      INTEGER NOT NULL DEFAULT 0,
    "error_rate_pct"              DECIMAL(5,2) NOT NULL DEFAULT 0,
    "queue_lag_seconds"           INTEGER NOT NULL DEFAULT 0,
    "open_incidents"              INTEGER NOT NULL DEFAULT 0,
    "open_reconciliation_issues"  INTEGER NOT NULL DEFAULT 0,
    "circuit_breakers_open"       INTEGER NOT NULL DEFAULT 0,
    "metadata"                    JSONB NOT NULL DEFAULT '{}',
    CONSTRAINT "reliability_snapshots_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "reliability_snapshots_snapshot_at_idx" ON "reliability_snapshots"("snapshot_at" DESC);

-- Deep Health Check Results
CREATE TABLE "health_check_results" (
    "id"          TEXT NOT NULL,
    "checked_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "overall"     TEXT NOT NULL DEFAULT 'healthy',
    "results"     JSONB NOT NULL DEFAULT '{}',
    "duration_ms" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "health_check_results_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "health_check_results_checked_at_idx" ON "health_check_results"("checked_at" DESC);

-- Seed default retention policies
INSERT INTO "retention_policies" ("id", "entity_type", "retention_days", "legal_basis", "is_active")
VALUES
  (gen_random_uuid()::text, 'orders',        2555, 'legal_obligation', true),   -- 7 years
  (gen_random_uuid()::text, 'invoices',      3650, 'legal_obligation', true),   -- 10 years
  (gen_random_uuid()::text, 'event_logs',    2555, 'legal_obligation', true),   -- 7 years
  (gen_random_uuid()::text, 'api_logs',       365, 'legitimate_interest', true),
  (gen_random_uuid()::text, 'notifications',  730, 'legitimate_interest', true),
  (gen_random_uuid()::text, 'trace_spans',     90, 'legitimate_interest', true),
  (gen_random_uuid()::text, 'health_checks',   30, 'legitimate_interest', true);

-- Seed default circuit breaker states for all critical services
INSERT INTO "circuit_breaker_states" ("id", "service", "state", "threshold", "cooldown_seconds")
VALUES
  (gen_random_uuid()::text, 'stripe',          'closed', 5, 120),
  (gen_random_uuid()::text, 'midocean',         'closed', 5, 60),
  (gen_random_uuid()::text, 'resend',           'closed', 3, 60),
  (gen_random_uuid()::text, 'supabase',         'closed', 3, 30),
  (gen_random_uuid()::text, 's3',               'closed', 5, 60),
  (gen_random_uuid()::text, 'bullmq',           'closed', 5, 30),
  (gen_random_uuid()::text, 'cloudflare',       'closed', 3, 60),
  (gen_random_uuid()::text, 'pf_concept',       'closed', 5, 60);
