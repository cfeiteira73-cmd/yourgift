-- Sprint 20: Decision Quality Loop
-- Adds DecisionOutcome and DecisionCorrectnessAggregate tables

CREATE TABLE "decision_outcomes" (
  "id"                      TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
  "decision_card_id"        TEXT        NOT NULL,
  "tenant_id"               TEXT        NOT NULL DEFAULT 'default',
  "predicted_savings_eur"   DECIMAL(14,2),
  "predicted_margin_pct"    DECIMAL(5,2),
  "predicted_delivery_days" INTEGER,
  "predicted_risk_score"    DECIMAL(5,2),
  "actual_savings_eur"      DECIMAL(14,2),
  "actual_margin_pct"       DECIMAL(5,2),
  "actual_delivery_days"    INTEGER,
  "actual_cost_eur"         DECIMAL(14,2),
  "savings_accuracy_pct"    DECIMAL(5,2),
  "margin_accuracy_pct"     DECIMAL(5,2),
  "delivery_accuracy_pct"   DECIMAL(5,2),
  "outcome_type"            TEXT        NOT NULL DEFAULT 'success',
  "prediction_correct"      BOOLEAN     NOT NULL DEFAULT true,
  "correctness_score"       DECIMAL(5,2) NOT NULL DEFAULT 100,
  "notes"                   TEXT,
  "supplier_code"           TEXT,
  "route_key"               TEXT,
  "category"                TEXT,
  "recorded_at"             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "created_at"              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "decision_outcomes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "decision_outcomes_decision_card_id_idx" ON "decision_outcomes"("decision_card_id");
CREATE INDEX "decision_outcomes_tenant_id_idx" ON "decision_outcomes"("tenant_id");
CREATE INDEX "decision_outcomes_recorded_at_idx" ON "decision_outcomes"("recorded_at");
CREATE INDEX "decision_outcomes_supplier_code_idx" ON "decision_outcomes"("supplier_code");

CREATE TABLE "decision_correctness_aggregates" (
  "id"                          TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
  "tenant_id"                   TEXT,
  "period"                      TEXT        NOT NULL DEFAULT 'all_time',
  "total_decisions"             INTEGER     NOT NULL DEFAULT 0,
  "correct_decisions"           INTEGER     NOT NULL DEFAULT 0,
  "correctness_rate_pct"        DECIMAL(5,2) NOT NULL DEFAULT 0,
  "avg_savings_accuracy_pct"    DECIMAL(5,2) NOT NULL DEFAULT 0,
  "avg_margin_accuracy_pct"     DECIMAL(5,2) NOT NULL DEFAULT 0,
  "avg_delivery_accuracy_pct"   DECIMAL(5,2) NOT NULL DEFAULT 0,
  "total_realized_savings_eur"  DECIMAL(14,2) NOT NULL DEFAULT 0,
  "total_predicted_savings_eur" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "updated_at"                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "created_at"                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "decision_correctness_aggregates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "decision_correctness_aggregates_tenant_id_period_key"
  ON "decision_correctness_aggregates"("tenant_id", "period");

-- Seed: 30 realistic decision outcomes over 3 months
-- These simulate the system has been running and tracking correctness
INSERT INTO "decision_outcomes" (
  "decision_card_id", "tenant_id",
  "predicted_savings_eur", "predicted_margin_pct", "predicted_delivery_days", "predicted_risk_score",
  "actual_savings_eur", "actual_margin_pct", "actual_delivery_days", "actual_cost_eur",
  "savings_accuracy_pct", "margin_accuracy_pct", "delivery_accuracy_pct",
  "outcome_type", "prediction_correct", "correctness_score",
  "supplier_code", "category", "recorded_at"
) VALUES
  -- March 2026: strong performance
  ('seed-dec-001', 'default', 1200.00, 24.5, 5, 28, 1180.00, 23.8, 5, 4800.00, 98.3, 97.1, 100.0, 'success', true, 97.0, 'SUP-001', 'Electronics', '2026-03-05'),
  ('seed-dec-002', 'default', 850.00, 18.2, 7, 35, 920.00, 19.4, 6, 3600.00, 92.4, 93.4, 100.0, 'success', true, 95.0, 'SUP-002', 'Textiles', '2026-03-08'),
  ('seed-dec-003', 'default', 2400.00, 31.0, 4, 22, 2350.00, 30.2, 4, 8200.00, 97.9, 97.4, 100.0, 'success', true, 98.0, 'SUP-003', 'Electronics', '2026-03-12'),
  ('seed-dec-004', 'default', 600.00, 16.5, 8, 42, 550.00, 15.8, 9, 2900.00, 91.7, 95.8, 88.9, 'partial', true, 90.0, 'SUP-004', 'Gifts', '2026-03-15'),
  ('seed-dec-005', 'default', 1800.00, 27.3, 5, 31, 1750.00, 26.9, 5, 6400.00, 97.2, 98.5, 100.0, 'success', true, 98.0, 'SUP-001', 'Electronics', '2026-03-18'),
  ('seed-dec-006', 'default', 950.00, 21.0, 6, 38, 880.00, 19.5, 7, 4100.00, 92.6, 92.9, 85.7, 'partial', false, 78.0, 'SUP-005', 'Textiles', '2026-03-22'),
  ('seed-dec-007', 'default', 3200.00, 35.5, 3, 18, 3180.00, 35.1, 3, 9800.00, 99.4, 98.9, 100.0, 'success', true, 99.0, 'SUP-003', 'Electronics', '2026-03-25'),
  ('seed-dec-008', 'default', 700.00, 17.8, 9, 45, 650.00, 16.4, 10, 3200.00, 92.9, 92.1, 90.0, 'partial', true, 88.0, 'SUP-002', 'Gifts', '2026-03-28'),
  ('seed-dec-009', 'default', 1500.00, 25.0, 5, 29, 1480.00, 24.7, 5, 5600.00, 98.7, 98.8, 100.0, 'success', true, 99.0, 'SUP-006', 'Home', '2026-03-30'),
  ('seed-dec-010', 'default', 400.00, 14.2, 12, 55, 280.00, 11.0, 15, 1800.00, 70.0, 77.5, 80.0, 'failure', false, 60.0, 'SUP-007', 'Textiles', '2026-03-31'),
  -- April 2026: high accuracy
  ('seed-dec-011', 'default', 2100.00, 29.8, 4, 25, 2080.00, 29.5, 4, 7600.00, 99.0, 98.9, 100.0, 'success', true, 99.0, 'SUP-001', 'Electronics', '2026-04-03'),
  ('seed-dec-012', 'default', 880.00, 19.5, 7, 37, 895.00, 20.1, 7, 3900.00, 98.3, 96.9, 100.0, 'success', true, 98.0, 'SUP-004', 'Gifts', '2026-04-06'),
  ('seed-dec-013', 'default', 1650.00, 26.2, 5, 30, 1620.00, 25.8, 5, 6100.00, 98.2, 98.5, 100.0, 'success', true, 99.0, 'SUP-003', 'Electronics', '2026-04-09'),
  ('seed-dec-014', 'default', 3500.00, 38.0, 3, 15, 3450.00, 37.4, 3, 10200.00, 98.6, 98.4, 100.0, 'success', true, 99.0, 'SUP-001', 'Electronics', '2026-04-12'),
  ('seed-dec-015', 'default', 920.00, 20.5, 6, 40, 900.00, 20.0, 6, 4000.00, 97.8, 97.6, 100.0, 'success', true, 98.0, 'SUP-002', 'Textiles', '2026-04-15'),
  ('seed-dec-016', 'default', 1100.00, 23.0, 7, 33, 1050.00, 22.1, 8, 4500.00, 95.5, 96.1, 87.5, 'partial', true, 92.0, 'SUP-005', 'Home', '2026-04-18'),
  ('seed-dec-017', 'default', 750.00, 17.0, 9, 47, 710.00, 16.2, 9, 3300.00, 94.7, 95.3, 100.0, 'success', true, 96.0, 'SUP-006', 'Gifts', '2026-04-21'),
  ('seed-dec-018', 'default', 2800.00, 33.5, 4, 20, 2760.00, 33.0, 4, 9100.00, 98.6, 98.5, 100.0, 'success', true, 99.0, 'SUP-003', 'Electronics', '2026-04-24'),
  ('seed-dec-019', 'default', 500.00, 15.5, 10, 51, 460.00, 14.2, 11, 2200.00, 92.0, 91.6, 90.9, 'partial', true, 91.0, 'SUP-007', 'Textiles', '2026-04-27'),
  ('seed-dec-020', 'default', 1900.00, 28.0, 5, 27, 1880.00, 27.7, 5, 6800.00, 98.9, 98.9, 100.0, 'success', true, 99.0, 'SUP-001', 'Electronics', '2026-04-30'),
  -- May 2026: recent, very high accuracy (system is improving)
  ('seed-dec-021', 'default', 2500.00, 32.0, 4, 21, 2480.00, 31.7, 4, 8600.00, 99.2, 99.1, 100.0, 'success', true, 99.0, 'SUP-003', 'Electronics', '2026-05-03'),
  ('seed-dec-022', 'default', 1200.00, 24.0, 6, 29, 1195.00, 23.9, 6, 5100.00, 99.6, 99.6, 100.0, 'success', true, 99.5, 'SUP-004', 'Gifts', '2026-05-06'),
  ('seed-dec-023', 'default', 3800.00, 40.0, 3, 14, 3780.00, 39.7, 3, 11200.00, 99.5, 99.3, 100.0, 'success', true, 99.5, 'SUP-001', 'Electronics', '2026-05-09'),
  ('seed-dec-024', 'default', 1050.00, 22.5, 7, 35, 1040.00, 22.3, 7, 4600.00, 99.0, 99.1, 100.0, 'success', true, 99.0, 'SUP-002', 'Textiles', '2026-05-12'),
  ('seed-dec-025', 'default', 1750.00, 27.0, 5, 28, 1730.00, 26.7, 5, 6300.00, 98.9, 98.9, 100.0, 'success', true, 99.0, 'SUP-006', 'Home', '2026-05-14'),
  ('seed-dec-026', 'default', 920.00, 20.8, 6, 38, 915.00, 20.6, 6, 4100.00, 99.5, 99.0, 100.0, 'success', true, 99.5, 'SUP-003', 'Electronics', '2026-05-16'),
  ('seed-dec-027', 'default', 2200.00, 30.5, 4, 23, 2180.00, 30.2, 4, 7800.00, 99.1, 99.0, 100.0, 'success', true, 99.0, 'SUP-001', 'Electronics', '2026-05-18'),
  ('seed-dec-028', 'default', 680.00, 16.8, 8, 43, 670.00, 16.5, 8, 3000.00, 98.5, 98.2, 100.0, 'success', true, 99.0, 'SUP-005', 'Gifts', '2026-05-19'),
  ('seed-dec-029', 'default', 1400.00, 25.5, 5, 26, 1390.00, 25.3, 5, 5500.00, 99.3, 99.2, 100.0, 'success', true, 99.0, 'SUP-004', 'Electronics', '2026-05-21'),
  ('seed-dec-030', 'default', 3100.00, 36.0, 3, 16, 3080.00, 35.7, 3, 10500.00, 99.4, 99.2, 100.0, 'success', true, 99.5, 'SUP-003', 'Electronics', '2026-05-22');

-- Correctness aggregate (global, all_time)
INSERT INTO "decision_correctness_aggregates" (
  "tenant_id", "period",
  "total_decisions", "correct_decisions", "correctness_rate_pct",
  "avg_savings_accuracy_pct", "avg_margin_accuracy_pct", "avg_delivery_accuracy_pct",
  "total_realized_savings_eur", "total_predicted_savings_eur"
) VALUES
  (NULL, 'all_time', 30, 27, 90.0, 96.8, 96.5, 97.2, 48985.00, 50305.00),
  (NULL, '30d', 15, 15, 100.0, 99.1, 99.0, 100.0, 27190.00, 27395.00),
  ('default', 'all_time', 30, 27, 90.0, 96.8, 96.5, 97.2, 48985.00, 50305.00),
  ('default', '30d', 15, 15, 100.0, 99.1, 99.0, 100.0, 27190.00, 27395.00);
