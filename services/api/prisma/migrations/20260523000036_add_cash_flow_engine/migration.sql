-- Sprint 21: Cash Flow Reality Engine

CREATE TABLE "cash_flow_invoices" (
  "id"                         TEXT          NOT NULL DEFAULT gen_random_uuid()::text,
  "tenant_id"                  TEXT          NOT NULL DEFAULT 'default',
  "order_id"                   TEXT,
  "supplier_id"                TEXT,
  "supplier_name"              TEXT,
  "invoice_ref"                TEXT          NOT NULL,
  "invoice_date"               TIMESTAMPTZ   NOT NULL,
  "due_date"                   TIMESTAMPTZ   NOT NULL,
  "paid_date"                  TIMESTAMPTZ,
  "amount_eur"                 DECIMAL(14,2) NOT NULL,
  "paid_amount_eur"            DECIMAL(14,2) NOT NULL DEFAULT 0,
  "status"                     TEXT          NOT NULL DEFAULT 'pending',
  "order_date"                 TIMESTAMPTZ,
  "delivery_date"              TIMESTAMPTZ,
  "days_payable_outstanding"   INTEGER,
  "cash_conversion_days"       INTEGER,
  "category"                   TEXT,
  "notes"                      TEXT,
  "created_at"                 TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  "updated_at"                 TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT "cash_flow_invoices_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "cash_flow_invoices_tenant_id_idx" ON "cash_flow_invoices"("tenant_id");
CREATE INDEX "cash_flow_invoices_status_idx" ON "cash_flow_invoices"("status");
CREATE INDEX "cash_flow_invoices_due_date_idx" ON "cash_flow_invoices"("due_date");

CREATE TABLE "working_capital_snapshots" (
  "id"                              TEXT          NOT NULL DEFAULT gen_random_uuid()::text,
  "tenant_id"                       TEXT          NOT NULL DEFAULT 'default',
  "total_payables_eur"              DECIMAL(14,2) NOT NULL DEFAULT 0,
  "overdue_payables_eur"            DECIMAL(14,2) NOT NULL DEFAULT 0,
  "avg_days_payable_outstanding"    DECIMAL(5,2)  NOT NULL DEFAULT 30,
  "cash_conversion_cycle_days"      DECIMAL(5,2)  NOT NULL DEFAULT 45,
  "liquidity_risk_score"            DECIMAL(5,2)  NOT NULL DEFAULT 50,
  "working_capital_at_risk_eur"     DECIMAL(14,2) NOT NULL DEFAULT 0,
  "thirty_day_forecast_eur"         DECIMAL(14,2) NOT NULL DEFAULT 0,
  "sixty_day_forecast_eur"          DECIMAL(14,2) NOT NULL DEFAULT 0,
  "ninety_day_forecast_eur"         DECIMAL(14,2) NOT NULL DEFAULT 0,
  "snapshot_at"                     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT "working_capital_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "working_capital_snapshots_tenant_id_idx" ON "working_capital_snapshots"("tenant_id");

-- Seed: realistic invoice data for the last 90 days
INSERT INTO "cash_flow_invoices" (
  "tenant_id", "invoice_ref", "invoice_date", "due_date", "paid_date",
  "amount_eur", "paid_amount_eur", "status",
  "order_date", "delivery_date", "days_payable_outstanding", "cash_conversion_days",
  "supplier_name", "category"
) VALUES
  -- March 2026 (all paid)
  ('default', 'INV-2026-0301', '2026-03-01', '2026-03-31', '2026-03-28', 8400.00, 8400.00, 'paid', '2026-02-20', '2026-03-05', 30, 7, 'TechSupply NL', 'Electronics'),
  ('default', 'INV-2026-0308', '2026-03-08', '2026-04-07', '2026-04-05', 3200.00, 3200.00, 'paid', '2026-02-28', '2026-03-12', 30, 4, 'GiftWorld PL', 'Gifts'),
  ('default', 'INV-2026-0315', '2026-03-15', '2026-04-14', '2026-04-12', 12600.00, 12600.00, 'paid', '2026-03-05', '2026-03-20', 30, 5, 'TechSupply NL', 'Electronics'),
  ('default', 'INV-2026-0322', '2026-03-22', '2026-04-21', '2026-04-19', 5800.00, 5800.00, 'paid', '2026-03-12', '2026-03-26', 30, 4, 'TextilePro DE', 'Textiles'),
  ('default', 'INV-2026-0329', '2026-03-29', '2026-04-28', '2026-04-25', 9100.00, 9100.00, 'paid', '2026-03-18', '2026-04-02', 30, 5, 'HomeDecor ES', 'Home'),
  -- April 2026 (mixed)
  ('default', 'INV-2026-0405', '2026-04-05', '2026-05-05', '2026-05-03', 14200.00, 14200.00, 'paid', '2026-03-25', '2026-04-09', 30, 4, 'TechSupply NL', 'Electronics'),
  ('default', 'INV-2026-0412', '2026-04-12', '2026-05-12', '2026-05-10', 6700.00, 6700.00, 'paid', '2026-04-01', '2026-04-16', 30, 4, 'GiftWorld PL', 'Gifts'),
  ('default', 'INV-2026-0419', '2026-04-19', '2026-05-19', NULL, 11300.00, 0.00, 'pending', '2026-04-08', '2026-04-23', NULL, NULL, 'TechSupply NL', 'Electronics'),
  ('default', 'INV-2026-0426', '2026-04-26', '2026-05-26', NULL, 4500.00, 0.00, 'pending', '2026-04-15', '2026-04-30', NULL, NULL, 'TextilePro DE', 'Textiles'),
  -- May 2026 (recent, mostly pending)
  ('default', 'INV-2026-0503', '2026-05-03', '2026-06-02', NULL, 18900.00, 0.00, 'pending', '2026-04-22', '2026-05-07', NULL, NULL, 'TechSupply NL', 'Electronics'),
  ('default', 'INV-2026-0510', '2026-05-10', '2026-06-09', NULL, 7800.00, 0.00, 'pending', '2026-04-29', '2026-05-14', NULL, NULL, 'GiftWorld PL', 'Gifts'),
  ('default', 'INV-2026-0517', '2026-05-17', '2026-06-16', NULL, 13400.00, 0.00, 'pending', '2026-05-06', '2026-05-21', NULL, NULL, 'HomeDecor ES', 'Home'),
  ('default', 'INV-2026-0510B', '2026-05-10', '2026-05-18', NULL, 2800.00, 0.00, 'overdue', '2026-04-28', '2026-05-12', NULL, NULL, 'OldSupplier CN', 'Electronics'),
  ('default', 'INV-2026-0501', '2026-05-01', '2026-05-15', NULL, 1600.00, 0.00, 'overdue', '2026-04-20', '2026-05-05', NULL, NULL, 'OldSupplier CN', 'Textiles');

-- Working capital snapshot (current state)
INSERT INTO "working_capital_snapshots" (
  "tenant_id", "total_payables_eur", "overdue_payables_eur",
  "avg_days_payable_outstanding", "cash_conversion_cycle_days",
  "liquidity_risk_score", "working_capital_at_risk_eur",
  "thirty_day_forecast_eur", "sixty_day_forecast_eur", "ninety_day_forecast_eur"
) VALUES
  ('default', 60300.00, 4400.00, 30.0, 34.0, 28.5, 4400.00, 60300.00, 38200.00, 22100.00);
