-- AuthAttempt (idempotency lock)
CREATE TABLE "auth_attempts" (
  "id" TEXT NOT NULL,
  "attempt_id" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "client_id" TEXT,
  "completed_at" TIMESTAMPTZ,
  "expires_at" TIMESTAMPTZ NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "auth_attempts_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "auth_attempts_attempt_id_key" ON "auth_attempts"("attempt_id");
CREATE INDEX "auth_attempts_created_at_idx" ON "auth_attempts"("created_at");

-- DeviceSession (fingerprint binding)
CREATE TABLE "device_sessions" (
  "id" TEXT NOT NULL,
  "client_id" TEXT NOT NULL,
  "device_id" TEXT NOT NULL,
  "user_agent" TEXT,
  "ip" TEXT,
  "last_seen_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "device_sessions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "device_sessions_client_device_key" ON "device_sessions"("client_id", "device_id");
CREATE INDEX "device_sessions_client_id_idx" ON "device_sessions"("client_id");

-- Cleanup old auth attempts (TTL via cron in production)
