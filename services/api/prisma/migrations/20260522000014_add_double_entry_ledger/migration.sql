-- CHART OF ACCOUNTS
CREATE TABLE "ledger_accounts" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "code" TEXT NOT NULL UNIQUE,       -- e.g. "1100", "4000", "5000"
  "name" TEXT NOT NULL,
  "account_type" TEXT NOT NULL,      -- asset | liability | revenue | expense | equity
  "normal_balance" TEXT NOT NULL,    -- debit | credit
  "description" TEXT,
  "is_system" BOOLEAN NOT NULL DEFAULT true,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- LEDGER ENTRIES (immutable double-entry lines)
CREATE TABLE "ledger_entries" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "transaction_id" UUID NOT NULL,    -- groups debit+credit pair
  "account_code" TEXT NOT NULL,
  "entry_type" TEXT NOT NULL,        -- debit | credit
  "amount" FLOAT NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'EUR',
  "description" TEXT NOT NULL,
  "reference_type" TEXT,             -- order | allowance | refund | adjustment
  "reference_id" TEXT,
  "tenant_id" TEXT NOT NULL DEFAULT 'default',
  "posted_at" TIMESTAMP NOT NULL DEFAULT NOW()
  -- IMMUTABLE: no updates, no deletes
);

-- LEDGER TRANSACTION SUMMARY (one row per balanced transaction)
CREATE TABLE "ledger_transactions" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "description" TEXT NOT NULL,
  "reference_type" TEXT,
  "reference_id" TEXT,
  "total_amount" FLOAT NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'EUR',
  "tenant_id" TEXT NOT NULL DEFAULT 'default',
  "posted_at" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX "ledger_entries_transaction_idx" ON "ledger_entries"("transaction_id");
CREATE INDEX "ledger_entries_account_idx" ON "ledger_entries"("account_code");
CREATE INDEX "ledger_entries_ref_idx" ON "ledger_entries"("reference_type", "reference_id");
CREATE INDEX "ledger_entries_posted_idx" ON "ledger_entries"("posted_at");
CREATE INDEX "ledger_entries_tenant_idx" ON "ledger_entries"("tenant_id");
CREATE INDEX "ledger_tx_ref_idx" ON "ledger_transactions"("reference_type", "reference_id");

-- SEED CHART OF ACCOUNTS
INSERT INTO "ledger_accounts" ("code", "name", "account_type", "normal_balance", "description") VALUES
  ('1100', 'Accounts Receivable',       'asset',     'debit',  'Money owed by clients'),
  ('1200', 'Cash & Platform Clearing',  'asset',     'debit',  'Platform payment clearing'),
  ('2100', 'Accounts Payable',          'liability', 'credit', 'Money owed to suppliers'),
  ('4000', 'Revenue — Product Sales',   'revenue',   'credit', 'Primary product revenue'),
  ('4100', 'Revenue — Services',        'revenue',   'credit', 'Service and customization revenue'),
  ('5000', 'Cost of Goods Sold',        'expense',   'debit',  'Supplier cost of products'),
  ('5100', 'Platform Operating Cost',   'expense',   'debit',  'Internal platform costs'),
  ('5200', 'Fulfillment Cost',          'expense',   'debit',  'Shipping and handling'),
  ('6000', 'Gross Profit',              'equity',    'credit', 'Derived: Revenue minus COGS'),
  ('9000', 'Suspense Account',          'asset',     'debit',  'Temporary unclassified entries');
