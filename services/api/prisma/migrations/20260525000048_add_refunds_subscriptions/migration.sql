-- Migration: add_refunds_subscriptions
-- Adds Refund and Subscription models for commerce + financial completeness

-- ─────────────────────────────────────────────
-- refunds
-- ─────────────────────────────────────────────
CREATE TABLE "refunds" (
    "id"                TEXT NOT NULL,
    "order_id"          TEXT NOT NULL,
    "stripe_refund_id"  TEXT NOT NULL,
    "amount"            DECIMAL(12,2) NOT NULL,
    "currency"          TEXT NOT NULL DEFAULT 'EUR',
    "reason"            TEXT,
    "status"            TEXT NOT NULL DEFAULT 'succeeded',
    "refunded_by"       TEXT,
    "ledger_tx_id"      TEXT,
    "metadata"          JSONB,
    "created_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refunds_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "refunds_stripe_refund_id_key" ON "refunds"("stripe_refund_id");
CREATE INDEX "refunds_order_id_idx" ON "refunds"("order_id");
CREATE INDEX "refunds_status_idx" ON "refunds"("status");
CREATE INDEX "refunds_created_at_idx" ON "refunds"("created_at" DESC);

ALTER TABLE "refunds" ADD CONSTRAINT "refunds_order_id_fkey"
    FOREIGN KEY ("order_id") REFERENCES "orders"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─────────────────────────────────────────────
-- subscriptions
-- ─────────────────────────────────────────────
CREATE TABLE "subscriptions" (
    "id"                      TEXT NOT NULL,
    "tenant_id"               TEXT NOT NULL,
    "stripe_subscription_id"  TEXT NOT NULL,
    "stripe_customer_id"      TEXT NOT NULL,
    "stripe_price_id"         TEXT NOT NULL,
    "plan_id"                 TEXT NOT NULL,
    "status"                  TEXT NOT NULL DEFAULT 'active',
    "current_period_start"    TIMESTAMP(3) NOT NULL,
    "current_period_end"      TIMESTAMP(3) NOT NULL,
    "cancel_at_period_end"    BOOLEAN NOT NULL DEFAULT false,
    "trial_end"               TIMESTAMP(3),
    "metadata"                JSONB,
    "created_at"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "subscriptions_stripe_subscription_id_key" ON "subscriptions"("stripe_subscription_id");
CREATE INDEX "subscriptions_tenant_id_idx" ON "subscriptions"("tenant_id");
CREATE INDEX "subscriptions_status_idx" ON "subscriptions"("status");
CREATE INDEX "subscriptions_stripe_subscription_id_idx" ON "subscriptions"("stripe_subscription_id");

ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─────────────────────────────────────────────
-- stripe_events idempotency table
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "stripe_events" (
    "id"            TEXT NOT NULL,
    "type"          TEXT NOT NULL,
    "processed_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stripe_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "stripe_events_type_idx" ON "stripe_events"("type");
CREATE INDEX IF NOT EXISTS "stripe_events_processed_at_idx" ON "stripe_events"("processed_at" DESC);
