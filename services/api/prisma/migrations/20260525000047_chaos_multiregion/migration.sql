-- Migration: chaos_multiregion
-- Adds ChaosDrill, RegionHealth, and FailoverEvent models for Chaos Engineering + Multi-region Resilience

-- ─────────────────────────────────────────────
-- chaos_drills
-- ─────────────────────────────────────────────
CREATE TABLE "chaos_drills" (
    "id"              TEXT NOT NULL,
    "drill_type"      TEXT NOT NULL,
    "target_service"  TEXT NOT NULL,
    "status"          TEXT NOT NULL DEFAULT 'scheduled',
    "config"          JSONB NOT NULL DEFAULT '{}',
    "scheduled_at"    TIMESTAMP(3) NOT NULL,
    "started_at"      TIMESTAMP(3),
    "completed_at"    TIMESTAMP(3),
    "triggered_by"    TEXT NOT NULL,
    "observations"    JSONB NOT NULL DEFAULT '[]',
    "mttr_minutes"    DOUBLE PRECISION,
    "rto_met"         BOOLEAN,
    "rpo_met"         BOOLEAN,
    "findings"        TEXT,
    "tenant_id"       TEXT,
    "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chaos_drills_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "chaos_drills_status_idx" ON "chaos_drills"("status");
CREATE INDEX "chaos_drills_drill_type_idx" ON "chaos_drills"("drill_type");
CREATE INDEX "chaos_drills_scheduled_at_idx" ON "chaos_drills"("scheduled_at" DESC);

-- ─────────────────────────────────────────────
-- region_health
-- ─────────────────────────────────────────────
CREATE TABLE "region_health" (
    "id"                  TEXT NOT NULL,
    "region"              TEXT NOT NULL,
    "role"                TEXT NOT NULL DEFAULT 'primary',
    "status"              TEXT NOT NULL DEFAULT 'healthy',
    "db_latency_ms"       INTEGER,
    "redis_latency_ms"    INTEGER,
    "api_latency_p95_ms"  INTEGER,
    "last_sync_at"        TIMESTAMP(3),
    "lag_seconds"         INTEGER,
    "checked_at"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "region_health_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "region_health_region_checked_at_idx" ON "region_health"("region", "checked_at" DESC);
CREATE INDEX "region_health_status_idx" ON "region_health"("status");

-- ─────────────────────────────────────────────
-- failover_events
-- ─────────────────────────────────────────────
CREATE TABLE "failover_events" (
    "id"               TEXT NOT NULL,
    "from_region"      TEXT NOT NULL,
    "to_region"        TEXT NOT NULL,
    "trigger"          TEXT NOT NULL,
    "status"           TEXT NOT NULL DEFAULT 'initiated',
    "rto_minutes"      DOUBLE PRECISION,
    "rpo_minutes"      DOUBLE PRECISION,
    "rto_target_met"   BOOLEAN,
    "rpo_target_met"   BOOLEAN,
    "initiated_by"     TEXT NOT NULL,
    "notes"            TEXT,
    "started_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at"     TIMESTAMP(3),

    CONSTRAINT "failover_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "failover_events_status_idx" ON "failover_events"("status");
CREATE INDEX "failover_events_started_at_idx" ON "failover_events"("started_at" DESC);

-- ─────────────────────────────────────────────
-- Seed initial region health records
-- ─────────────────────────────────────────────
INSERT INTO "region_health" ("id", "region", "role", "status", "checked_at")
VALUES
  (gen_random_uuid()::text, 'eu-west-1', 'primary', 'healthy', NOW()),
  (gen_random_uuid()::text, 'eu-west-2', 'secondary', 'healthy', NOW()),
  (gen_random_uuid()::text, 'eu-central-1', 'dr', 'healthy', NOW());
