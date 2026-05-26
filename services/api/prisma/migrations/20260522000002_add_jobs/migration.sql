CREATE TABLE "jobs" (
  "id" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "payload" JSONB NOT NULL DEFAULT '{}',
  "status" TEXT NOT NULL DEFAULT 'pending',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "max_attempts" INTEGER NOT NULL DEFAULT 3,
  "error" TEXT,
  "scheduled_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "started_at" TIMESTAMP(3),
  "completed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "jobs_status_scheduled_at_idx" ON "jobs"("status", "scheduled_at");
CREATE INDEX "jobs_type_idx" ON "jobs"("type");
