-- Migration: tenant_economics
-- Creates: usage_metering_events, tenant_usage_summaries, tenant_quotas, tenant_resource_allocations

-- ─── usage_metering_events ────────────────────────────────────────────────────

CREATE TABLE "usage_metering_events" (
  "id"          TEXT NOT NULL,
  "tenant_id"   TEXT NOT NULL,
  "event_type"  TEXT NOT NULL,
  "resource_id" TEXT,
  "units"       DOUBLE PRECISION NOT NULL DEFAULT 1,
  "unit_type"   TEXT NOT NULL,
  "cost_eur"    DOUBLE PRECISION NOT NULL DEFAULT 0,
  "provider"    TEXT,
  "model_ref"   TEXT,
  "duration_ms" INTEGER,
  "tenant_plan" TEXT NOT NULL,
  "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "usage_metering_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "usage_metering_events_tenant_id_occurred_at_idx"
  ON "usage_metering_events" ("tenant_id", "occurred_at" DESC);

CREATE INDEX "usage_metering_events_event_type_idx"
  ON "usage_metering_events" ("event_type");

CREATE INDEX "usage_metering_events_occurred_at_idx"
  ON "usage_metering_events" ("occurred_at" DESC);

-- ─── tenant_usage_summaries ───────────────────────────────────────────────────

CREATE TABLE "tenant_usage_summaries" (
  "id"               TEXT NOT NULL,
  "tenant_id"        TEXT NOT NULL,
  "period_start"     TIMESTAMP(3) NOT NULL,
  "period_end"       TIMESTAMP(3) NOT NULL,
  "period_type"      TEXT NOT NULL,
  "ai_call_count"    INTEGER NOT NULL DEFAULT 0,
  "ai_tokens_used"   BIGINT NOT NULL DEFAULT 0,
  "ai_cost_eur"      DOUBLE PRECISION NOT NULL DEFAULT 0,
  "api_call_count"   INTEGER NOT NULL DEFAULT 0,
  "procurement_count" INTEGER NOT NULL DEFAULT 0,
  "simulation_count" INTEGER NOT NULL DEFAULT 0,
  "queue_job_count"  INTEGER NOT NULL DEFAULT 0,
  "storage_bytes"    BIGINT NOT NULL DEFAULT 0,
  "total_cost_eur"   DOUBLE PRECISION NOT NULL DEFAULT 0,
  "computed_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "tenant_usage_summaries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tenant_usage_summaries_tenant_id_period_start_period_type_key"
  ON "tenant_usage_summaries" ("tenant_id", "period_start", "period_type");

CREATE INDEX "tenant_usage_summaries_tenant_id_period_type_idx"
  ON "tenant_usage_summaries" ("tenant_id", "period_type");

CREATE INDEX "tenant_usage_summaries_period_start_idx"
  ON "tenant_usage_summaries" ("period_start" DESC);

-- ─── tenant_quotas ────────────────────────────────────────────────────────────

CREATE TABLE "tenant_quotas" (
  "id"                        TEXT NOT NULL,
  "tenant_id"                 TEXT NOT NULL,
  "max_ai_calls_per_day"      INTEGER NOT NULL DEFAULT 1000,
  "max_ai_tokens_per_day"     BIGINT NOT NULL DEFAULT 1000000,
  "max_procurements_per_month" INTEGER NOT NULL DEFAULT 500,
  "max_simulations_per_day"   INTEGER NOT NULL DEFAULT 200,
  "max_api_calls_per_minute"  INTEGER NOT NULL DEFAULT 200,
  "max_storage_gb"            DOUBLE PRECISION NOT NULL DEFAULT 10,
  "max_queue_jobs_per_hour"   INTEGER NOT NULL DEFAULT 1000,
  "ai_cost_budget_eur_month"  DOUBLE PRECISION,
  "alert_threshold_pct"       INTEGER NOT NULL DEFAULT 80,
  "soft_enforcement"          BOOLEAN NOT NULL DEFAULT true,
  "updated_at"                TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "tenant_quotas_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tenant_quotas_tenant_id_key"
  ON "tenant_quotas" ("tenant_id");

-- Default quota profiles (applied per-tenant at creation time via TenantQuotaService):
--
-- starter plan:   max_ai_calls_per_day=200,  max_ai_tokens_per_day=200000,  max_procurements_per_month=100,  max_simulations_per_day=50,  max_storage_gb=2,   max_queue_jobs_per_hour=200
-- growth plan:    max_ai_calls_per_day=1000, max_ai_tokens_per_day=1000000, max_procurements_per_month=500,  max_simulations_per_day=200, max_storage_gb=10,  max_queue_jobs_per_hour=1000
-- enterprise plan: max_ai_calls_per_day=10000, max_ai_tokens_per_day=10000000, max_procurements_per_month=5000, max_simulations_per_day=2000, max_storage_gb=100, max_queue_jobs_per_hour=10000, ai_cost_budget_eur_month=500

-- ─── tenant_resource_allocations ─────────────────────────────────────────────

CREATE TABLE "tenant_resource_allocations" (
  "id"            TEXT NOT NULL,
  "tenant_id"     TEXT NOT NULL,
  "resource_type" TEXT NOT NULL,
  "weight"        DOUBLE PRECISION NOT NULL DEFAULT 1.0,
  "priority"      INTEGER NOT NULL DEFAULT 5,
  "updated_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "tenant_resource_allocations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tenant_resource_allocations_tenant_id_resource_type_key"
  ON "tenant_resource_allocations" ("tenant_id", "resource_type");

CREATE INDEX "tenant_resource_allocations_resource_type_weight_idx"
  ON "tenant_resource_allocations" ("resource_type", "weight");
