-- Migration: add_stripe_event_idempotency
-- Adds stripe_events table for webhook idempotency guard.
-- Prevents duplicate processing of Stripe webhook events on retries.

CREATE TABLE "stripe_events" (
    "id"           TEXT NOT NULL,
    "type"         TEXT NOT NULL,
    "processed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stripe_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "stripe_events_processed_at_idx" ON "stripe_events"("processed_at");
