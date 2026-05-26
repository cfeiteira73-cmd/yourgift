CREATE TABLE "procurement_events" (
  "id" TEXT NOT NULL,
  "stream_id" TEXT NOT NULL,
  "stream_type" TEXT NOT NULL,
  "event_type" TEXT NOT NULL,
  "sequence_num" INTEGER NOT NULL,
  "payload" JSONB NOT NULL DEFAULT '{}',
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "applied_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "procurement_events_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "procurement_events_stream_seq_key" ON "procurement_events"("stream_id", "sequence_num");
CREATE INDEX "procurement_events_stream_applied_idx" ON "procurement_events"("stream_id", "applied_at");
CREATE INDEX "procurement_events_type_idx" ON "procurement_events"("stream_type", "event_type");
CREATE INDEX "procurement_events_applied_idx" ON "procurement_events"("applied_at");
