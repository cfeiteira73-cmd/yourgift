-- ActiveSession (global session registry)
CREATE TABLE "active_sessions" (
  "id" TEXT NOT NULL,
  "client_id" TEXT NOT NULL,
  "device_id" TEXT,
  "ip" TEXT,
  "user_agent" TEXT,
  "provider" TEXT,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "revoked_at" TIMESTAMPTZ,
  "last_activity_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "active_sessions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "active_sessions_client_id_idx" ON "active_sessions"("client_id");
CREATE INDEX "active_sessions_is_active_idx" ON "active_sessions"("is_active");

-- AuthRiskEvent
CREATE TABLE "auth_risk_events" (
  "id" TEXT NOT NULL,
  "client_id" TEXT,
  "email" TEXT,
  "ip" TEXT,
  "device_id" TEXT,
  "risk_score" INTEGER NOT NULL,
  "risk_level" TEXT NOT NULL,
  "factors" JSONB NOT NULL DEFAULT '{}',
  "action" TEXT NOT NULL,
  "provider" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "auth_risk_events_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "auth_risk_events_client_id_idx" ON "auth_risk_events"("client_id");
CREATE INDEX "auth_risk_events_ip_idx" ON "auth_risk_events"("ip");
CREATE INDEX "auth_risk_events_created_at_idx" ON "auth_risk_events"("created_at");
